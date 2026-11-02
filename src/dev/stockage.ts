/**
 * Où vit la liste de développement : dans le navigateur de chacun.
 *
 * C'est la même mémoire que les réglages et la configuration de table — ce
 * qu'on coche ici reste ici. Pour la partager, on passe par un lien ou un
 * fichier (voir `modele.ts`) : la liste voyage entière, et celui qui la reçoit
 * décide de remplacer la sienne.
 *
 * Si un jour la liste devait vivre sur un service partagé, c'est ce fichier
 * qu'on remplacerait — rien d'autre ne sait où elle est rangée.
 */
import { analyser, fusionnerNouveautes, serialiser } from './modele.ts'
import type { Liste } from './modele.ts'
import { listeDOrigine } from './contenu.ts'

const CLE = 'camino.developpement.v1'

/**
 * La liste à afficher : celle qu'on a mémorisée, complétée des points que la
 * mise à jour de l'application a pu apporter depuis — ou la liste d'origine
 * pour qui l'ouvre pour la première fois. Dit aussi combien de points sont
 * nouveaux, pour le signaler.
 */
export function chargerListe(): { liste: Liste; nouveaux: number } {
  let memorisee: Liste | null = null
  try {
    const brut = localStorage.getItem(CLE)
    if (brut) memorisee = analyser(brut)
  } catch {
    /* navigation privée, quota : on repart de l'origine */
  }
  if (!memorisee) return { liste: listeDOrigine(), nouveaux: 0 }
  const { liste, ajoutes } = fusionnerNouveautes(memorisee, listeDOrigine())
  if (ajoutes) enregistrerListe(liste)
  return { liste, nouveaux: ajoutes }
}

export function enregistrerListe(liste: Liste): void {
  try {
    localStorage.setItem(CLE, serialiser(liste))
  } catch {
    /* tant pis : la liste reste en mémoire le temps de la session */
  }
}

export function effacerListe(): void {
  try {
    localStorage.removeItem(CLE)
  } catch {
    /* sans importance */
  }
}
