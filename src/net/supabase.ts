/**
 * Transport hébergé : les salons passent par les canaux temps réel de
 * Supabase, et les joueurs peuvent donc être sur des appareils différents.
 *
 * On n'utilise QUE la diffusion de messages (« broadcast ») : aucune table,
 * aucune donnée stockée, rien à configurer côté projet. Deux canaux :
 *
 *  - `camino-salons` : le hall. Les hôtes y annoncent leur salon, ceux qui
 *    arrivent demandent « qui est là ? » et reçoivent les réponses. C'est ce
 *    qui remplace la liste partagée du transport local.
 *  - `camino-salon-<id>` : un canal par salon, pour la partie elle-même.
 *
 * Le client officiel est chargé à la demande : tant qu'on ne joue pas en
 * ligne, il n'est même pas téléchargé.
 */
import type { EtatLiaison, Message, Salon, SalonResume, Transport } from './salon.ts'
import { estPerime, resume } from './salon.ts'
import { SUPABASE_ANON_KEY, SUPABASE_URL } from './config.ts'

type Client = import('@supabase/supabase-js').SupabaseClient
type Canal = import('@supabase/supabase-js').RealtimeChannel

const HALL = 'camino-salons'
/** Les hôtes réannoncent leur salon à ce rythme : un salon muet disparaît. */
const ANNONCE_MS = 4000

let client: Client | null = null

/** Charge le client une seule fois, et seulement si on en a besoin. */
async function getClient(): Promise<Client> {
  if (client) return client
  const { createClient } = await import('@supabase/supabase-js')
  client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false },
    realtime: { params: { eventsPerSecond: 20 } },
  })
  return client
}

/** Ce qui circule dans le hall, en plus des messages de salon. */
type MessageHall =
  | { t: 'annonce'; salon: SalonResume; vuA: number }
  | { t: 'qui'; }
  | { t: 'ferme'; id: string }

export class TransportSupabase implements Transport {
  readonly nom = 'supabase'
  private hall: Canal | null = null
  private canal: Canal | null = null
  private connus = new Map<string, SalonResume & { vuA: number }>()
  private monSalon: Salon | null = null
  private annonceur: number | null = null
  private onMessage: ((msg: Message) => void) | null = null
  private etat: EtatLiaison = 'connexion'
  private surEtatCb: ((e: EtatLiaison) => void) | null = null

  /** L'état de la liaison intéresse l'interface : muette, elle semble en panne. */
  surEtat(cb: (etat: EtatLiaison) => void): () => void {
    this.surEtatCb = cb
    cb(this.etat)
    return () => {
      if (this.surEtatCb === cb) this.surEtatCb = null
    }
  }

  private majEtat(e: EtatLiaison) {
    if (this.etat === e) return
    this.etat = e
    this.surEtatCb?.(e)
  }

  // ------------------------------------------------------------------ hall
  salons(onChange: (liste: SalonResume[]) => void): () => void {
    let vivant = true
    const pousser = () => {
      const maintenant = Date.now()
      for (const [id, s] of this.connus) {
        // deux annonces manquées : l'hôte a fermé son onglet
        if (maintenant - s.vuA > ANNONCE_MS * 3 || estPerime(s, maintenant)) this.connus.delete(id)
      }
      onChange([...this.connus.values()].sort((a, b) => a.numero - b.numero))
    }

    this.majEtat('connexion')
    void (async () => {
      const c = await getClient()
      if (!vivant) return
      this.hall = c.channel(HALL, { config: { broadcast: { self: false } } })
      this.hall.on('broadcast', { event: 'hall' }, ({ payload }) => {
        const m = payload as MessageHall
        if (m.t === 'annonce') {
          this.connus.set(m.salon.id, { ...m.salon, vuA: Date.now() })
          pousser()
        } else if (m.t === 'ferme') {
          this.connus.delete(m.id)
          pousser()
        } else if (m.t === 'qui' && this.monSalon) {
          // quelqu'un vient d'arriver : on lui montre notre salon sans attendre
          this.annoncer()
        }
      })
      this.hall.subscribe((statut) => {
        if (statut === 'SUBSCRIBED') {
          this.majEtat('ok')
          this.envoyerHall({ t: 'qui' })
        } else if (statut === 'CHANNEL_ERROR' || statut === 'TIMED_OUT') {
          this.majEtat('erreur')
        }
      })
    })()

    const menage = window.setInterval(pousser, 2000)
    return () => {
      vivant = false
      window.clearInterval(menage)
      void this.hall?.unsubscribe()
      this.hall = null
    }
  }

  private envoyerHall(m: MessageHall) {
    void this.hall?.send({ type: 'broadcast', event: 'hall', payload: m })
  }

  private annoncer() {
    if (!this.monSalon) return
    this.envoyerHall({ t: 'annonce', salon: resume(this.monSalon), vuA: Date.now() })
  }

  // ---------------------------------------------------------------- salons
  private async brancher(salonId: string) {
    this.quitterCanal()
    const c = await getClient()
    const canal = c.channel(`camino-salon-${salonId}`, {
      config: { broadcast: { self: false } },
    })
    canal.on('broadcast', { event: 'msg' }, ({ payload }) => {
      this.onMessage?.(payload as Message)
    })
    await new Promise<void>((resolve) => {
      canal.subscribe((statut) => {
        if (statut === 'SUBSCRIBED') resolve()
      })
      // On n'attend pas indéfiniment : mieux vaut une interface qui répond
      // qu'un écran figé si le réseau boude.
      window.setTimeout(resolve, 4000)
    })
    this.canal = canal
  }

  async ouvrir(salon: Salon): Promise<void> {
    await this.brancher(salon.id)
    this.monSalon = salon
    this.annoncer()
    if (this.annonceur) window.clearInterval(this.annonceur)
    this.annonceur = window.setInterval(() => this.annoncer(), ANNONCE_MS)
  }

  async rejoindre(salonId: string): Promise<void> {
    // On se branche seulement : c'est l'appelant qui se signale, une fois
    // qu'il écoute — sinon il manquerait la réponse de l'hôte.
    await this.brancher(salonId)
  }

  envoyer(msg: Message): void {
    void this.canal?.send({ type: 'broadcast', event: 'msg', payload: msg })
  }

  ecouter(onMessage: (msg: Message) => void): () => void {
    this.onMessage = onMessage
    return () => {
      if (this.onMessage === onMessage) this.onMessage = null
    }
  }

  publier(salon: Salon): void {
    this.monSalon = salon
    this.annoncer()
    // Une partie lancée ou finie sort de la liste des salons à rejoindre.
    if (salon.phase !== 'attente') this.envoyerHall({ t: 'ferme', id: salon.id })
  }

  private quitterCanal() {
    if (this.canal) void this.canal.unsubscribe()
    this.canal = null
  }

  quitter(): void {
    if (this.monSalon) this.envoyerHall({ t: 'ferme', id: this.monSalon.id })
    if (this.annonceur) window.clearInterval(this.annonceur)
    this.annonceur = null
    this.monSalon = null
    this.quitterCanal()
  }
}
