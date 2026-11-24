/**
 * Où vit la liste de développement.
 *
 * Depuis la version 1.90, elle vit sur le serveur, partagée entre tous les
 * appareils (voir `synchro.ts`) ; la mémoire du navigateur ne sert plus que
 * de cache et de file d'attente. Ce fichier fournit cette mémoire, et
 * construit la synchronisation avec le bon serveur : celui du projet
 * Supabase quand le jeu en ligne est configuré, aucun sinon — la liste reste
 * alors sur l'appareil, comme avant.
 */
import { enLigneDisponible } from '../net/config.ts'
import { ServeurSupabase } from './serveur.ts'
import { Synchro } from './synchro.ts'
import type { Memoire } from './synchro.ts'

/** La mémoire du navigateur, qui peut manquer (navigation privée, quota). */
export const memoireNavigateur: Memoire = {
  lire(cle) {
    try {
      return localStorage.getItem(cle)
    } catch {
      return null
    }
  },
  ecrire(cle, valeur) {
    try {
      localStorage.setItem(cle, valeur)
    } catch {
      /* tant pis : la liste reste en mémoire le temps de la session */
    }
  },
  effacer(cle) {
    try {
      localStorage.removeItem(cle)
    } catch {
      /* sans importance */
    }
  },
}

/** La synchronisation de cet appareil, prête à démarrer. */
export function creerSynchro(): Synchro {
  return new Synchro(enLigneDisponible() ? new ServeurSupabase() : null, memoireNavigateur)
}
