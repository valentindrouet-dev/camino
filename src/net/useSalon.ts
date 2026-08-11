/**
 * La vie d'un salon, côté application.
 *
 * Ce hook ne connaît qu'un `Transport` : il marche donc à l'identique entre
 * deux onglets d'un même navigateur et, demain, entre deux appareils reliés
 * par un service hébergé.
 *
 * Deux principes :
 *  - l'hôte fait foi sur la composition du salon (qui est là, quel plateau) ;
 *  - une fois la partie lancée, plus personne ne fait foi : chacun rejoue le
 *    même journal d'actions numérotées, et le moteur étant déterministe, tout
 *    le monde aboutit au même état.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  applyMove,
  createGame,
  defaultOptions,
  flipTile,
  randomSeed,
  redrawLastTile,
} from '../engine/index.ts'
import type { BoardColor, GameConfig, GameState } from '../engine/index.ts'
import { BOARD_COLOR_HEX, BOARD_COLOR_NAMES } from '../engine/index.ts'
import type { Action, JoueurSalon, Message, Salon, SalonResume, Transport } from './salon.ts'
import { nomDeSalon, prochainNumero } from './salon.ts'

const CLE_ID = 'camino.joueur.v1'
const CLE_NOM = 'camino.nom.v1'

/**
 * Qui suis-je dans un salon.
 *
 * L'identifiant vit dans `sessionStorage`, c'est-à-dire PAR ONGLET : deux
 * onglets d'un même navigateur sont deux joueurs distincts — c'est ce qui
 * permet de jouer à deux sur le même poste — et un rafraîchissement conserve
 * l'identité, donc la place à table.
 *
 * Le nom, lui, est une préférence : il vit dans `localStorage` et se retrouve
 * d'une session à l'autre.
 */
export function monIdentite(): { id: string; nom: string } {
  let id = ''
  try {
    id = sessionStorage.getItem(CLE_ID) ?? ''
    if (!id) {
      id = randomSeed()
      sessionStorage.setItem(CLE_ID, id)
    }
  } catch {
    // navigation privée : une identité le temps du chargement, sans plus
    id = id || randomSeed()
  }
  let nom = ''
  try {
    nom = localStorage.getItem(CLE_NOM) ?? ''
  } catch {
    /* sans importance */
  }
  return { id, nom }
}

export function enregistrerNom(nom: string) {
  try {
    localStorage.setItem(CLE_NOM, nom)
  } catch {
    /* sans importance */
  }
}

/** Rejoue le journal depuis le début : c'est ce qui rend la reconnexion gratuite. */
export function rejouer(config: GameConfig, actions: Action[]): GameState {
  let etat = createGame(config)
  for (const a of actions) {
    if (a.k === 'coup') etat = applyMove(etat, a.move)
    else if (a.k === 'verso') etat = flipTile(etat, a.tileId)
    else if (a.k === 'repioche') etat = redrawLastTile(etat)
  }
  return etat
}

/** Configuration de partie déduite d'un salon prêt à démarrer. */
export function configDuSalon(salon: Salon): GameConfig {
  const assis = salon.joueurs
    .filter((j) => j.present && j.boardColor)
    .sort((a, b) => (a.siege ?? 0) - (b.siege ?? 0))
  return {
    players: assis.map((j) => ({
      name: j.nom,
      kind: 'human' as const,
      boardColor: j.boardColor as BoardColor,
    })),
    options: salon.options,
  }
}

export interface EtatSalon {
  /** Salon courant, ou null tant qu'on n'en a rejoint aucun. */
  salon: Salon | null
  /** Liste des salons ouverts, pour l'écran « Rejoindre ». */
  liste: SalonResume[]
  /** Suis-je celui qui a ouvert le salon ? */
  suisHote: boolean
  /** Mon siège une fois la partie lancée, sinon null. */
  monSiege: number | null
  /** Partie en cours, rejouée depuis le journal. */
  partie: GameState | null
  ouvrir: (nom: string) => Promise<void>
  rejoindre: (id: string, nom: string) => Promise<void>
  choisirPlateau: (couleur: BoardColor | null) => void
  changerOptions: (options: Salon['options']) => void
  commencer: () => void
  jouer: (action: Action) => void
  quitter: () => void
}

export function useSalon(transport: Transport): EtatSalon {
  const moi = useMemo(monIdentite, [])
  const [liste, setListe] = useState<SalonResume[]>([])
  const [salon, setSalon] = useState<Salon | null>(null)
  const [actions, setActions] = useState<Action[]>([])

  // Miroirs : les gestionnaires de messages ne doivent pas dépendre d'une
  // valeur figée au moment de l'abonnement.
  const salonRef = useRef<Salon | null>(null)
  salonRef.current = salon
  const actionsRef = useRef<Action[]>(actions)
  actionsRef.current = actions

  const suisHote = salon?.hote === moi.id

  // --- liste des salons ouverts
  useEffect(() => transport.salons(setListe), [transport])

  /** L'hôte publie l'état du salon : c'est la seule source de vérité. */
  const diffuser = useCallback(
    (maj: Salon) => {
      setSalon(maj)
      transport.publier(maj)
      transport.envoyer({ t: 'salon', salon: maj })
    },
    [transport],
  )

  /*
   * Réception des messages.
   *
   * L'abonnement est calé sur l'IDENTITÉ du salon, pas sur son contenu :
   * sinon il se referait à chaque message reçu, et un message tombant dans
   * l'intervalle serait perdu.
   *
   * Une fois abonné — et pas avant — on se signale à l'hôte. Annoncer son
   * arrivée sans écouter, c'est risquer de manquer sa réponse et de rester
   * seul dans un salon qui, lui, nous a bien vu.
   */
  useEffect(() => {
    if (!salon) return
    const arret = transport.ecouter((msg: Message) => {
      const courant = salonRef.current
      if (!courant) return
      const hote = courant.hote === moi.id

      switch (msg.t) {
        case 'bonjour': {
          if (!hote) return
          // Un revenant reprend sa place ; un nouveau s'ajoute, si la partie
          // n'a pas commencé et qu'il reste de la place.
          const deja = courant.joueurs.find((j) => j.id === msg.joueur.id)
          if (!deja && (courant.phase !== 'attente' || courant.joueurs.length >= 6)) return
          const joueurs = deja
            ? courant.joueurs.map((j) => (j.id === deja.id ? { ...j, present: true } : j))
            : [...courant.joueurs, { ...msg.joueur, present: true }]
          diffuser({ ...courant, joueurs, vuA: Date.now() })
          break
        }
        case 'salon':
          // Seul l'hôte diffuse ; on lui fait confiance.
          if (!hote) setSalon(msg.salon)
          break
        case 'plateau': {
          if (!hote) return
          // Deux joueurs ne peuvent pas prendre le même plateau.
          if (
            msg.boardColor &&
            courant.joueurs.some((j) => j.id !== msg.joueurId && j.boardColor === msg.boardColor)
          ) {
            return
          }
          diffuser({
            ...courant,
            joueurs: courant.joueurs.map((j) =>
              j.id === msg.joueurId ? { ...j, boardColor: msg.boardColor } : j,
            ),
            vuA: Date.now(),
          })
          break
        }
        case 'options':
          if (!hote) setSalon({ ...courant, options: msg.options })
          break
        case 'debut':
          setActions([])
          setSalon(msg.salon)
          break
        case 'action': {
          // Le numéro dit où l'action se range : un trou signale qu'on a raté
          // quelque chose, on redemande le journal plutôt que de deviner.
          const attendu = actionsRef.current.length
          if (msg.n === attendu) setActions((prev) => [...prev, msg.action])
          else if (msg.n > attendu) transport.envoyer({ t: 'rejoue', depuis: attendu })
          break
        }
        case 'rejoue':
          transport.envoyer({ t: 'journal', actions: actionsRef.current })
          break
        case 'journal':
          if (msg.actions.length > actionsRef.current.length) setActions(msg.actions)
          break
        case 'fin':
          setSalon({ ...courant, phase: 'terminee' })
          break
        case 'aurevoir': {
          if (!hote) return
          diffuser({
            ...courant,
            joueurs:
              courant.phase === 'attente'
                ? courant.joueurs.filter((j) => j.id !== msg.joueurId)
                : courant.joueurs.map((j) =>
                    j.id === msg.joueurId ? { ...j, present: false } : j,
                  ),
            vuA: Date.now(),
          })
          break
        }
      }
    })
    const courant = salonRef.current
    if (courant && courant.hote !== moi.id) {
      const moiSalon = courant.joueurs.find((j) => j.id === moi.id)
      transport.envoyer({
        t: 'bonjour',
        joueur: moiSalon ?? { id: moi.id, nom: moi.nom, boardColor: null, present: true },
      })
    }
    return arret
    // eslint-disable-next-line react-hooks/exhaustive-deps -- l'identité du salon suffit
  }, [transport, salon?.id, moi.id, moi.nom, diffuser])

  // --- actions du joueur
  const ouvrir = useCallback(
    async (nom: string) => {
      enregistrerNom(nom)
      const numero = prochainNumero(liste)
      const neuf: Salon = {
        id: `${randomSeed()}-${numero}`,
        nom: nomDeSalon(numero),
        numero,
        hote: moi.id,
        joueurs: [{ id: moi.id, nom, boardColor: 'O', present: true }],
        phase: 'attente',
        options: defaultOptions(randomSeed()),
        vuA: Date.now(),
      }
      await transport.ouvrir(neuf)
      setSalon(neuf)
      setActions([])
    },
    [transport, liste, moi.id],
  )

  const rejoindre = useCallback(
    async (id: string, nom: string) => {
      enregistrerNom(nom)
      const joueur: JoueurSalon = { id: moi.id, nom, boardColor: null, present: true }
      // On se place dans un salon « en attente de l'hôte » : sa première
      // diffusion remplacera cet état provisoire.
      const provisoire: Salon = {
        id,
        nom: liste.find((s) => s.id === id)?.nom ?? 'Camino',
        numero: liste.find((s) => s.id === id)?.numero ?? 0,
        hote: '',
        joueurs: [joueur],
        phase: 'attente',
        options: defaultOptions(randomSeed()),
        vuA: Date.now(),
      }
      setActions([])
      await transport.rejoindre(id, joueur)
      setSalon(provisoire)
    },
    [transport, liste, moi.id],
  )

  const choisirPlateau = useCallback(
    (couleur: BoardColor | null) => {
      const courant = salonRef.current
      if (!courant) return
      if (courant.hote === moi.id) {
        if (
          couleur &&
          courant.joueurs.some((j) => j.id !== moi.id && j.boardColor === couleur)
        ) {
          return
        }
        diffuser({
          ...courant,
          joueurs: courant.joueurs.map((j) =>
            j.id === moi.id ? { ...j, boardColor: couleur } : j,
          ),
          vuA: Date.now(),
        })
      } else {
        transport.envoyer({ t: 'plateau', joueurId: moi.id, boardColor: couleur })
      }
    },
    [transport, moi.id, diffuser],
  )

  const changerOptions = useCallback(
    (options: Salon['options']) => {
      const courant = salonRef.current
      if (!courant || courant.hote !== moi.id) return
      const maj = { ...courant, options, vuA: Date.now() }
      setSalon(maj)
      transport.envoyer({ t: 'options', options })
    },
    [transport, moi.id],
  )

  const commencer = useCallback(() => {
    const courant = salonRef.current
    if (!courant || courant.hote !== moi.id) return
    // Les sièges sont figés au lancement : c'est l'ordre du tour de table.
    const assis = courant.joueurs.filter((j) => j.present && j.boardColor)
    const maj: Salon = {
      ...courant,
      phase: 'en-cours',
      joueurs: assis.map((j, i) => ({ ...j, siege: i })),
      vuA: Date.now(),
    }
    setActions([])
    setSalon(maj)
    transport.publier(maj)
    transport.envoyer({ t: 'debut', salon: maj })
  }, [transport, moi.id])

  const jouer = useCallback(
    (action: Action) => {
      const n = actionsRef.current.length
      setActions((prev) => [...prev, action])
      transport.envoyer({ t: 'action', n, action })
    },
    [transport],
  )

  const quitter = useCallback(() => {
    const courant = salonRef.current
    if (courant) transport.envoyer({ t: 'aurevoir', joueurId: moi.id })
    transport.quitter()
    setSalon(null)
    setActions([])
  }, [transport, moi.id])

  // --- la partie, rejouée depuis le journal
  const partie = useMemo(() => {
    if (!salon || salon.phase === 'attente') return null
    const config = configDuSalon(salon)
    if (!config.players.length) return null
    return rejouer(config, actions)
  }, [salon, actions])

  const monSiege = useMemo(() => {
    const j = salon?.joueurs.find((x) => x.id === moi.id)
    return j?.siege ?? null
  }, [salon, moi.id])

  // Fin de partie : l'hôte referme le salon, il disparaît de la liste.
  useEffect(() => {
    if (!suisHote || !salon || partie?.phase !== 'finished' || salon.phase === 'terminee') return
    transport.envoyer({ t: 'fin' })
    const ferme = { ...salon, phase: 'terminee' as const, vuA: Date.now() }
    setSalon(ferme)
    transport.publier(ferme)
  }, [suisHote, salon, partie?.phase, transport])

  return {
    salon,
    liste,
    suisHote,
    monSiege,
    partie,
    ouvrir,
    rejoindre,
    choisirPlateau,
    changerOptions,
    commencer,
    jouer,
    quitter,
  }
}

/** Couleurs de plateau déjà prises par les autres. */
export function plateauxPris(salon: Salon, sauf: string): BoardColor[] {
  return salon.joueurs
    .filter((j) => j.id !== sauf && j.boardColor)
    .map((j) => j.boardColor as BoardColor)
}

export { BOARD_COLOR_HEX, BOARD_COLOR_NAMES }
