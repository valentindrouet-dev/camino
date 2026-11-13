/** Ce qu'un joueur ne doit pas connaître de ses adversaires. */
function masquerJoueur(p) {
    const out = { ...p };
    // Couleur secrète et couleurs interdites : elles ne se révèlent qu'au décompte.
    delete out.secretColor;
    delete out.forbiddenColors;
    // Carte mission personnelle : chacun garde la sienne pour soi.
    delete out.cardId;
    // Tuile personnelle : on sait qu'il lui en reste une, pas laquelle.
    if (out.personalTileId !== undefined)
        delete out.personalTileId;
    return out;
}
/**
 * L'état tel que `joueurId` a le droit de le voir. Son propre joueur est
 * intact ; les autres perdent leurs informations cachées.
 *
 * `swapCard` (variante Échange de plateaux) reste masquée pour tout le monde
 * tant que la manche de révélation n'est pas atteinte — y compris pour l'hôte,
 * sinon il lirait la réponse dans son propre état.
 */
export function viewFor(state, joueurId, swapRevealed = false) {
    return {
        ...state,
        players: state.players.map((p) => (p.id === joueurId ? p : masquerJoueur(p))),
        ...(state.swapCard && !swapRevealed ? { swapCard: undefined } : {}),
    };
}
/** Vrai si l'état ne porte plus aucune information cachée d'autrui. */
export function isMasked(state, joueurId) {
    return state.players.every((p) => p.id === joueurId ||
        (p.secretColor === undefined &&
            p.forbiddenColors === undefined &&
            p.cardId === undefined &&
            p.personalTileId === undefined));
}
