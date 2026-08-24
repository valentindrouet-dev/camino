/**
 * Ce que voit quelqu'un qui ouvre le lien pour la PREMIÈRE fois — sur son
 * ordinateur, son téléphone, depuis un partage.
 *
 * Dès qu'il touche à quoi que ce soit, sa configuration est mémorisée dans son
 * navigateur et rechargée à la place de celle-ci : ceci ne sert qu'au tout
 * premier chargement. C'est le pendant de `REGLAGES_DEFAUT`, qui décide non
 * pas de ce qui est coché mais de ce qui est proposé.
 */

import { clearVariants, defaultOptions, defaultPlayers, randomSeed } from '../engine/index.ts'
import type { GameOptions, PlayerConfig } from '../engine/index.ts'

/**
 * Une table de deux : un humain contre le bot Confirmé. De quoi jouer une
 * partie complète tout de suite, sans avoir à trouver un adversaire ni à
 * comprendre un réglage.
 */
export function tableDepart(): PlayerConfig[] {
  const [un, deux] = defaultPlayers(2)
  return [un, { ...deux, kind: 'bot-smart' }]
}

/**
 * Score et Points par Zone visibles, premier joueur tiré au sort. Ni indices,
 * ni dernière tuile, ni graine à la main — et aucune variante : la règle de
 * base, telle qu'elle est dans la boîte.
 */
export function optionsDepart(): GameOptions {
  return { ...clearVariants(defaultOptions(randomSeed())), randomFirst: true }
}
