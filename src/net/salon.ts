/**
 * Les salons de jeu en ligne : types et protocole.
 *
 * Le principe tient en une phrase : le moteur étant déterministe, une partie
 * n'est rien d'autre qu'une graine et une liste d'actions. On ne synchronise
 * donc jamais un état de jeu — seulement des actions numérotées, que chaque
 * appareil rejoue de son côté. Une partie complète à six joueurs pèse 4 Ko.
 *
 * Ce fichier ne connaît aucun réseau : il décrit ce qui circule. Les
 * transports (deux onglets d'un même navigateur, service hébergé…) implémentent
 * `Transport` et sont interchangeables.
 */
import type { GameOptions, Move } from '../engine/index.ts'
import type { BoardColor } from '../engine/index.ts'

/** Un joueur dans un salon, avant que la partie ne commence. */
export interface JoueurSalon {
  /** Identifiant de l'appareil, tiré une fois et gardé en mémoire locale. */
  id: string
  nom: string
  /** Plateau choisi ; deux joueurs ne peuvent pas prendre le même. */
  boardColor: BoardColor | null
  /** Siège attribué au lancement — l'ordre du tour de table. */
  siege?: number
  /** Faux quand l'appareil a cessé de donner signe de vie. */
  present: boolean
}

export type PhaseSalon = 'attente' | 'en-cours' | 'terminee'

export interface Salon {
  id: string
  /** « Camino 01 », « Camino 02 »… le plus petit numéro libre à l'ouverture. */
  nom: string
  numero: number
  /** Identifiant du joueur qui a ouvert le salon : lui seul lance la partie. */
  hote: string
  joueurs: JoueurSalon[]
  phase: PhaseSalon
  /** Réglages choisis par l'hôte — variantes comprises. */
  options: GameOptions
  /** Horodatage de la dernière activité, pour faire le ménage. */
  vuA: number
}

/** Résumé d'un salon pour la liste — sans les détails. */
export interface SalonResume {
  id: string
  nom: string
  numero: number
  phase: PhaseSalon
  joueurs: number
  /** Noms des joueurs présents, pour donner envie de rejoindre. */
  noms: string[]
}

// ---------------------------------------------------------------------------
// Protocole : ce qui circule entre les appareils d'un même salon.
// ---------------------------------------------------------------------------

/** Une action de jeu, numérotée : c'est l'unité de synchronisation. */
export type Action =
  | { k: 'coup'; move: Move }
  | { k: 'verso'; tileId: number }
  | { k: 'repioche' }

export type Message =
  /** J'arrive (ou je reviens) dans le salon. */
  | { t: 'bonjour'; joueur: JoueurSalon }
  /** L'hôte publie l'état complet du salon : c'est lui qui fait foi. */
  | { t: 'salon'; salon: Salon }
  /** Je choisis (ou je libère) un plateau. */
  | { t: 'plateau'; joueurId: string; boardColor: BoardColor | null }
  /** L'hôte change les réglages de la partie. */
  | { t: 'options'; options: GameOptions }
  /** L'hôte lance : le salon se ferme aux nouveaux venus. */
  | { t: 'debut'; salon: Salon }
  /** Une action de jeu, à sa place dans le journal. */
  | { t: 'action'; n: number; action: Action }
  /** Je n'ai pas tout : renvoyez-moi le journal depuis ce numéro. */
  | { t: 'rejoue'; depuis: number }
  /** Voici le journal complet. */
  | { t: 'journal'; actions: Action[] }
  /** La partie est finie : le salon se referme. */
  | { t: 'fin' }
  /** Je m'en vais. */
  | { t: 'aurevoir'; joueurId: string }

/**
 * Un transport achemine les messages d'un salon et tient la liste des salons
 * ouverts. Tout ce que l'interface de jeu sait du réseau est ici — brancher un
 * service hébergé, c'est écrire une deuxième implémentation, rien d'autre.
 */
export interface Transport {
  /** Nom affiché du transport, pour le diagnostic. */
  readonly nom: string
  /** Liste des salons ouverts, rafraîchie tant qu'on écoute. */
  salons(onChange: (liste: SalonResume[]) => void): () => void
  /** Ouvre un salon et s'y place comme hôte. */
  ouvrir(salon: Salon): Promise<void>
  /** Rejoint un salon existant. */
  rejoindre(salonId: string, joueur: JoueurSalon): Promise<void>
  /** Publie un message à tous les autres membres du salon. */
  envoyer(msg: Message): void
  /** S'abonne aux messages du salon courant. */
  ecouter(onMessage: (msg: Message) => void): () => void
  /** Met à jour le résumé publié dans la liste (hôte uniquement). */
  publier(salon: Salon): void
  /** Quitte le salon courant. */
  quitter(): void
  /**
   * S'abonne à l'état de la liaison. Sans réseau à établir (salon local),
   * l'implémentation peut ne rien fournir : on considère alors la liaison
   * comme acquise.
   */
  surEtat?(cb: (etat: EtatLiaison) => void): () => void
}

/** Où en est la liaison avec le service. */
export type EtatLiaison = 'connexion' | 'ok' | 'erreur'

// ---------------------------------------------------------------------------
// Aides communes à tous les transports.
// ---------------------------------------------------------------------------

/** Le plus petit numéro libre : le premier salon ouvert est « Camino 01 ». */
export function prochainNumero(ouverts: { numero: number }[]): number {
  const pris = new Set(ouverts.map((s) => s.numero))
  let n = 1
  while (pris.has(n)) n++
  return n
}

export function nomDeSalon(numero: number): string {
  return `Camino ${String(numero).padStart(2, '0')}`
}

export function resume(salon: Salon): SalonResume {
  return {
    id: salon.id,
    nom: salon.nom,
    numero: salon.numero,
    phase: salon.phase,
    joueurs: salon.joueurs.filter((j) => j.present).length,
    noms: salon.joueurs.filter((j) => j.present).map((j) => j.nom),
  }
}

/** Un salon sans joueur depuis dix minutes n'intéresse plus personne. */
export const PEREMPTION_MS = 10 * 60 * 1000

export function estPerime(salon: { vuA: number; phase: PhaseSalon }, maintenant: number): boolean {
  return salon.phase === 'terminee' || maintenant - salon.vuA > PEREMPTION_MS
}
