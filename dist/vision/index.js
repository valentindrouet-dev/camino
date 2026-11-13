/**
 * La lecture d'un plateau photographié, en un seul point d'entrée.
 *
 * `lecture.ts` sait lire : repère, échantillonnage, reconnaissance des tuiles,
 * cases douteuses. `detection.ts` sait trouver le plateau tout seul et caler
 * les coins. Ni l'un ni l'autre ne connaît le navigateur : ils reçoivent des
 * pixels RGBA, une largeur, une hauteur, et rendent des cases.
 *
 * C'est cette porte que le paquet `@bbg/camino-scoring/vision` expose.
 */
export * from "./lecture.js";
export * from "./detection.js";
