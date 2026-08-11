/**
 * Transport local : les onglets d'un même navigateur.
 *
 * Il ne sert pas qu'à la mise au point. C'est lui qui permet de valider toute
 * la mécanique — ouverture d'un salon, arrivée d'un joueur, choix des
 * plateaux, ordre des coups, reconnexion — sans dépendre d'un réseau, et il
 * reste utile pour jouer à plusieurs sur le même poste.
 *
 * La liste des salons vit dans `localStorage` (partagé par les onglets), les
 * messages passent par `BroadcastChannel` (instantané, sans réseau).
 */
import type { Message, Salon, SalonResume, Transport } from './salon.ts'
import { estPerime, resume } from './salon.ts'

const CLE_SALONS = 'camino.salons.v1'
const CANAL_LISTE = 'camino-salons'

function lireSalons(): SalonResume[] {
  try {
    const brut = localStorage.getItem(CLE_SALONS)
    const tout = brut ? (JSON.parse(brut) as Record<string, SalonResume & { vuA: number }>) : {}
    const maintenant = Date.now()
    return Object.values(tout).filter((s) => !estPerime(s, maintenant))
  } catch {
    return []
  }
}

function ecrireSalon(salon: Salon | null, id?: string) {
  try {
    const brut = localStorage.getItem(CLE_SALONS)
    const tout = brut ? (JSON.parse(brut) as Record<string, unknown>) : {}
    const maintenant = Date.now()
    // au passage, on jette les salons périmés : personne d'autre ne le fera
    for (const [k, v] of Object.entries(tout)) {
      if (estPerime(v as { vuA: number; phase: Salon['phase'] }, maintenant)) delete tout[k]
    }
    if (salon) tout[salon.id] = { ...resume(salon), vuA: salon.vuA }
    else if (id) delete tout[id]
    localStorage.setItem(CLE_SALONS, JSON.stringify(tout))
  } catch {
    /* quota ou navigation privée : la liste sera simplement vide */
  }
}

export class TransportLocal implements Transport {
  readonly nom = 'local'
  private canal: BroadcastChannel | null = null
  private liste = new BroadcastChannel(CANAL_LISTE)

  salons(onChange: (liste: SalonResume[]) => void): () => void {
    const pousser = () => onChange(lireSalons())
    pousser()
    const surMessage = () => pousser()
    this.liste.addEventListener('message', surMessage)
    // `storage` prévient les autres onglets ; le nôtre se rafraîchit tout seul
    const surStorage = (e: StorageEvent) => {
      if (e.key === CLE_SALONS) pousser()
    }
    window.addEventListener('storage', surStorage)
    const battement = window.setInterval(pousser, 3000)
    return () => {
      this.liste.removeEventListener('message', surMessage)
      window.removeEventListener('storage', surStorage)
      window.clearInterval(battement)
    }
  }

  private brancher(salonId: string) {
    this.quitter()
    this.canal = new BroadcastChannel(`camino-salon-${salonId}`)
  }

  async ouvrir(salon: Salon): Promise<void> {
    this.brancher(salon.id)
    this.publier(salon)
  }

  async rejoindre(salonId: string): Promise<void> {
    // On se branche seulement : c'est l'appelant qui se signale, une fois
    // qu'il écoute — sinon il manquerait la réponse de l'hôte.
    this.brancher(salonId)
  }

  envoyer(msg: Message): void {
    this.canal?.postMessage(msg)
  }

  ecouter(onMessage: (msg: Message) => void): () => void {
    const canal = this.canal
    if (!canal) return () => {}
    const surMessage = (e: MessageEvent) => onMessage(e.data as Message)
    canal.addEventListener('message', surMessage)
    return () => canal.removeEventListener('message', surMessage)
  }

  publier(salon: Salon): void {
    ecrireSalon({ ...salon, vuA: Date.now() })
    this.liste.postMessage('maj')
  }

  quitter(): void {
    this.canal?.close()
    this.canal = null
  }

  /** Retire un salon de la liste (l'hôte, à la fin de la partie). */
  fermer(salonId: string): void {
    ecrireSalon(null, salonId)
    this.liste.postMessage('maj')
  }
}
