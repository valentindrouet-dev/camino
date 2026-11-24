/**
 * Le serveur de la liste de développement partagée : une table Supabase,
 * `developpement`, où l'on ajoute des lignes et où l'on n'en retire jamais.
 *
 * La table et ses droits se créent une fois, dans l'éditeur SQL du projet :
 * voir `supabase/developpement.sql` et `docs/developpement-partage-supabase.md`.
 * Tant qu'elle n'existe pas, `ServeurNonConfigure` le dit, et l'application
 * garde la liste sur l'appareil, comme avant.
 *
 * La clé « anon » du projet est publique par conception (voir net/config.ts) :
 * elle ne permet que ce que les politiques de la table autorisent — lire, et
 * ajouter. Ni modifier, ni effacer.
 */
import { clientSupabase } from '../net/supabase.ts'
import { Doublon, ServeurNonConfigure } from './synchro.ts'
import type { Ligne, NouvelleLigne, Serveur } from './synchro.ts'

type Canal = import('@supabase/supabase-js').RealtimeChannel

const TABLE = 'developpement'
const CANAL = 'camino-developpement'
const COLONNES = 'id,cree,genre,auteur,jusqua,contenu'

interface ErreurPostgrest {
  code?: string
  message?: string
}

function traduire(e: ErreurPostgrest): Error {
  // PGRST205 : table inconnue du cache de schéma ; 42P01 : relation inexistante.
  if (e.code === 'PGRST205' || e.code === '42P01') {
    return new ServeurNonConfigure('La table « developpement » n’existe pas encore dans le projet Supabase.')
  }
  // 42501 : la politique de sécurité refuse — la table est là, pas ses droits.
  if (e.code === '42501') {
    return new ServeurNonConfigure('La table « developpement » existe mais refuse l’accès : ses politiques manquent.')
  }
  if (e.code === '23505') return new Doublon()
  return new Error(e.message ?? 'Erreur du serveur')
}

function ligne(brut: Record<string, unknown>): Ligne {
  return {
    id: Number(brut.id),
    cree: String(brut.cree ?? ''),
    genre: brut.genre === 'instantane' ? 'instantane' : 'op',
    auteur: typeof brut.auteur === 'string' ? brut.auteur : '',
    jusqua: typeof brut.jusqua === 'number' ? brut.jusqua : brut.jusqua == null ? null : Number(brut.jusqua),
    contenu: brut.contenu,
  }
}

export class ServeurSupabase implements Serveur {
  private canal: Canal | null = null

  async lire(depuis: number, limite: number, avant?: number): Promise<Ligne[]> {
    const c = await clientSupabase()
    let q = c.from(TABLE).select(COLONNES).gt('id', depuis).order('id', { ascending: true }).limit(limite)
    if (avant !== undefined) q = q.lt('id', avant)
    const { data, error } = await q
    if (error) throw traduire(error)
    return (data as Record<string, unknown>[]).map(ligne)
  }

  async dernierInstantane(jusquaMax?: number): Promise<Ligne | null> {
    const c = await clientSupabase()
    let q = c.from(TABLE).select(COLONNES).eq('genre', 'instantane').order('jusqua', { ascending: false }).limit(1)
    if (jusquaMax !== undefined) q = q.lte('jusqua', jusquaMax)
    const { data, error } = await q
    if (error) throw traduire(error)
    const premiere = (data as Record<string, unknown>[])[0]
    return premiere ? ligne(premiere) : null
  }

  async dernieresOperations(limite: number): Promise<Ligne[]> {
    const c = await clientSupabase()
    const { data, error } = await c
      .from(TABLE)
      .select(COLONNES)
      .eq('genre', 'op')
      .order('id', { ascending: false })
      .limit(limite)
    if (error) throw traduire(error)
    return (data as Record<string, unknown>[]).map(ligne)
  }

  async ecrire(lignes: NouvelleLigne[]): Promise<Ligne[]> {
    const c = await clientSupabase()
    const { data, error } = await c
      .from(TABLE)
      .insert(lignes.map((l) => ({ genre: l.genre, auteur: l.auteur, appareil: l.appareil, jusqua: l.jusqua ?? null, contenu: l.contenu })))
      .select(COLONNES)
    if (error) throw traduire(error)
    return (data as Record<string, unknown>[]).map(ligne)
  }

  ecouter(cb: () => void): () => void {
    let vivant = true
    void (async () => {
      const c = await clientSupabase()
      if (!vivant) return
      const canal = c.channel(CANAL, { config: { broadcast: { self: false } } })
      canal.on('broadcast', { event: 'maj' }, () => cb())
      canal.subscribe()
      this.canal = canal
    })()
    return () => {
      vivant = false
      if (this.canal) void this.canal.unsubscribe()
      this.canal = null
    }
  }

  signaler(): void {
    void this.canal?.send({ type: 'broadcast', event: 'maj', payload: {} })
  }
}
