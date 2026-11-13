/**
 * Point de vue d'un joueur sur une partie.
 *
 * En hot-seat, un seul écran montre tout : c'est voulu, les joueurs sont
 * autour de la même table. En ligne, chacun a son appareil et son propre
 * état — il ne doit donc jamais recevoir ce qu'il n'a pas le droit de voir.
 * Le masquage se fait ICI, avant l'envoi, et pas à l'affichage : une donnée
 * partie sur le réseau est une donnée lisible dans la console du voisin.
 */
import type { GameState } from './types.js';
/**
 * L'état tel que `joueurId` a le droit de le voir. Son propre joueur est
 * intact ; les autres perdent leurs informations cachées.
 *
 * `swapCard` (variante Échange de plateaux) reste masquée pour tout le monde
 * tant que la manche de révélation n'est pas atteinte — y compris pour l'hôte,
 * sinon il lirait la réponse dans son propre état.
 */
export declare function viewFor(state: GameState, joueurId: number, swapRevealed?: boolean): GameState;
/** Vrai si l'état ne porte plus aucune information cachée d'autrui. */
export declare function isMasked(state: GameState, joueurId: number): boolean;
