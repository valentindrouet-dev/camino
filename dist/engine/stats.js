import { placedCount } from "./board.js";
import { applyCards, cardTable, playerCardIds, rulesetForPlayer } from "./cards.js";
import { Rng } from "./rng.js";
import { scoreBoard } from "./scoring.js";
import { BLACK, PATH_COLORS } from "./types.js";
import { bestMove } from "./ai.js";
import { applyMove, createGame, currentPlayer } from "./game.js";
export function playerStats(state) {
    const raw = state.players.map((player) => {
        const ruleset = rulesetForPlayer(state, player.id);
        const base = scoreBoard(player.board, ruleset, player);
        const cards = playerCardIds(state, player.id);
        const breakdown = cards.length
            ? applyCards(base, {
                playerId: player.id,
                board: player.board,
                boardColor: player.boardColor,
                ruleset,
                table: cardTable(state.players, ruleset),
            }, cards, state.cardColors, state.cardAxes, state.cardSeuils)
            : base;
        // `scoring` porte le drapeau : en scoring inversé un chemin qui compte a
        // des points négatifs, il n'en reste pas moins un chemin qui compte.
        const scoring = breakdown.zones.filter((z) => z.scoring);
        const wasted = breakdown.zones
            .filter((z) => z.color !== BLACK && !z.scoring && z.points === 0)
            .reduce((n, z) => n + z.span, 0);
        const picks = state.log.filter((l) => l.playerId === player.id);
        // Meilleure couleur : la plus grosse en valeur absolue, pour rester juste
        // quand le scoring est inversé et que tous les chemins sont négatifs.
        let bestColor = null;
        let bestPts = 0;
        for (const c of PATH_COLORS) {
            if (Math.abs(breakdown.byColor[c].points) > Math.abs(bestPts)) {
                bestPts = breakdown.byColor[c].points;
                bestColor = c;
            }
        }
        return {
            player,
            breakdown,
            rank: 0,
            tilesPlaced: placedCount(player.board),
            scoringPaths: scoring.length,
            longestPath: scoring.reduce((m, z) => Math.max(m, z.span), 0),
            bestColor,
            wastedPotential: wasted,
            avgPickOrder: picks.length
                ? picks.reduce((n, p) => n + p.pickOrder, 0) / picks.length
                : 0,
        };
    });
    const order = raw.slice().sort((a, b) => b.breakdown.total - a.breakdown.total);
    order.forEach((s, i) => {
        s.rank = i > 0 && order[i - 1].breakdown.total === s.breakdown.total ? order[i - 1].rank : i + 1;
    });
    // Mort subite : celui qui a composé le chemin gagne, quel que soit le score.
    // Les autres gardent leur ordre relatif, décalé d'un rang.
    if (state.suddenWinner != null) {
        for (const s of raw) {
            if (s.player.id === state.suddenWinner)
                s.rank = 1;
            else
                s.rank += 1;
        }
    }
    return raw;
}
export function ranking(stats) {
    return stats.slice().sort((a, b) => a.rank - b.rank || b.breakdown.total - a.breakdown.total);
}
/** Joue une partie entière avec des bots et renvoie ses résultats bruts. */
export function playOneGame(config, seed) {
    let state = createGame({ ...config, options: { ...config.options, seed } });
    const rng = new Rng(`${seed}-ai`);
    let guard = 0;
    while (state.phase === 'playing' && guard++ < 10000) {
        const kind = currentPlayer(state).kind;
        const move = bestMove(state, kind === 'human' ? 'bot-smart' : kind, rng);
        if (!move)
            break;
        state = applyMove(state, move);
    }
    const stats = playerStats(state);
    const totals = stats.map((s) => s.breakdown.total);
    const best = Math.max(...totals);
    const winners = totals.filter((t) => t === best).length;
    // Courbe moyenne de la table : le score moyen après chaque manche.
    const rounds = state.scoreHistory[0]?.length ?? 0;
    const curve = Array.from({ length: rounds }, (_, r) => {
        let sum = 0;
        for (const h of state.scoreHistory)
            sum += h[r] ?? 0;
        return sum / (state.scoreHistory.length || 1);
    });
    return {
        seed,
        rounds,
        curve,
        results: stats.map((s) => ({
            seat: s.player.id,
            kind: s.player.kind,
            total: s.breakdown.total,
            colorPoints: s.breakdown.colorPoints,
            blackZones: s.breakdown.blackZones,
            blackPoints: s.breakdown.blackPoints,
            scoringPaths: s.scoringPaths,
            longestPath: s.longestPath,
            byColor: Object.fromEntries(PATH_COLORS.map((c) => [c, s.breakdown.byColor[c].points])),
            spans: s.breakdown.zones.filter((z) => z.scoring).map((z) => z.span),
            win: s.breakdown.total === best ? 1 / winners : 0,
            rank: s.rank,
            starPoints: s.breakdown.starPoints,
            cloverPoints: s.breakdown.cloverPoints,
            crystalPoints: s.breakdown.crystalPoints,
            secretPoints: s.breakdown.secretPoints,
            cardPoints: s.breakdown.cardPoints,
            basePoints: s.breakdown.basePoints,
            cardDone: s.breakdown.cardPoints > 0 ? 1 : 0,
            wasted: s.wastedPotential,
            pickOrder: s.avgPickOrder,
        })),
    };
}
/** Agrège des parties déjà jouées — sert à la simulation incrémentale de l'UI. */
export function aggregate(records, seats, durationMs = 0) {
    const scores = [];
    const byColor = {};
    for (const c of PATH_COLORS)
        byColor[c] = 0;
    byColor[BLACK] = 0;
    const spanHistogram = {};
    const winsBySeat = new Array(seats).fill(0);
    const sumBySeat = new Array(seats).fill(0);
    const winsByKind = {};
    const sumByKind = {};
    const countByKind = {};
    let blackZones = 0;
    let blackPoints = 0;
    let paths = 0;
    let longest = 0;
    let spreadSum = 0;
    let players = 0;
    // sources de points
    let starSum = 0;
    let cloverSum = 0;
    let crystalSum = 0;
    let secretSum = 0;
    let cardSum = 0;
    let baseSum = 0;
    let colorSum = 0;
    let cardDone = 0;
    let wasted = 0;
    let winnerSum = 0;
    let lastSum = 0;
    let close = 0;
    let ties = 0;
    let roundsSum = 0;
    const rankBySeat = Array.from({ length: seats }, () => new Array(seats).fill(0));
    const curveSum = [];
    const curveCount = [];
    for (const g of records) {
        const totals = g.results.map((r) => r.total);
        const best = Math.max(...totals);
        const worst = Math.min(...totals);
        spreadSum += best - worst;
        winnerSum += best;
        lastSum += worst;
        if (best - worst <= 5)
            close++;
        if (totals.filter((t) => t === best).length > 1)
            ties++;
        roundsSum += g.rounds;
        g.curve.forEach((v, i) => {
            curveSum[i] = (curveSum[i] ?? 0) + v;
            curveCount[i] = (curveCount[i] ?? 0) + 1;
        });
        for (const r of g.results) {
            if (r.seat < seats && r.rank >= 1 && r.rank <= seats)
                rankBySeat[r.seat][r.rank - 1]++;
            starSum += r.starPoints;
            cloverSum += r.cloverPoints;
            crystalSum += r.crystalPoints;
            secretSum += r.secretPoints;
            cardSum += r.cardPoints;
            baseSum += r.basePoints;
            colorSum += r.colorPoints;
            cardDone += r.cardDone;
            wasted += r.wasted;
            players++;
            scores.push(r.total);
            sumBySeat[r.seat] += r.total;
            winsBySeat[r.seat] += r.win;
            countByKind[r.kind] = (countByKind[r.kind] ?? 0) + 1;
            sumByKind[r.kind] = (sumByKind[r.kind] ?? 0) + r.total;
            winsByKind[r.kind] = (winsByKind[r.kind] ?? 0) + r.win;
            for (const c of PATH_COLORS)
                byColor[c] += r.byColor[c];
            byColor[BLACK] += r.blackPoints;
            blackZones += r.blackZones;
            blackPoints += r.blackPoints;
            paths += r.scoringPaths;
            longest += r.longestPath;
            for (const s of r.spans)
                spanHistogram[s] = (spanHistogram[s] ?? 0) + 1;
        }
    }
    const div = players || 1;
    const nb = records.length || 1;
    const sorted = scores.slice().sort((a, b) => a - b);
    const mean = scores.reduce((a, b) => a + b, 0) / div;
    const variance = scores.reduce((a, b) => a + (b - mean) ** 2, 0) / div;
    // Une source qui ne rapporte jamais rien (variante éteinte) n'encombre pas
    // le graphique : on ne garde que ce qui pèse.
    const sources = [
        { key: 'colors', label: 'Chemins', value: colorSum / div, color: '#40AE49' },
        { key: 'black', label: 'Zones noires', value: blackPoints / div, color: '#4A4A4A' },
        { key: 'stars', label: 'Étoiles', value: starSum / div, color: '#FFD23F' },
        { key: 'clovers', label: 'Trèfles', value: cloverSum / div, color: '#2F8F3C' },
        { key: 'crystals', label: 'Cristaux', value: crystalSum / div, color: '#9FE8FF' },
        { key: 'secret', label: 'Couleur secrète', value: secretSum / div, color: '#8E6BB5' },
        { key: 'cards', label: 'Cartes missions', value: cardSum / div, color: '#F9B515' },
        { key: 'base', label: 'Points de départ', value: baseSum / div, color: '#C9B8A0' },
    ].filter((x) => Math.abs(x.value) > 0.001);
    return {
        games: records.length,
        scores,
        min: sorted[0] ?? 0,
        max: sorted[sorted.length - 1] ?? 0,
        mean,
        median: sorted.length
            ? sorted.length % 2
                ? sorted[(sorted.length - 1) / 2]
                : (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
            : 0,
        stdev: Math.sqrt(variance),
        byColor: Object.fromEntries(Object.entries(byColor).map(([k, v]) => [k, v / div])),
        avgBlackZones: blackZones / div,
        avgBlackPoints: blackPoints / div,
        spanHistogram,
        avgScoringPaths: paths / div,
        avgLongestPath: longest / div,
        winsBySeat,
        meanBySeat: sumBySeat.map((s) => s / nb),
        winsByKind,
        meanByKind: Object.fromEntries(Object.keys(sumByKind).map((k) => [k, sumByKind[k] / (countByKind[k] || 1)])),
        countByKind,
        avgSpread: spreadSum / nb,
        durationMs,
        sources,
        winnerMean: winnerSum / nb,
        lastMean: lastSum / nb,
        closeRate: close / nb,
        tieRate: ties / nb,
        avgWasted: wasted / div,
        avgRounds: roundsSum / nb,
        curve: curveSum.map((v, i) => v / (curveCount[i] || 1)),
        cardRate: cardDone / div,
        avgCardPoints: cardSum / div,
        rankBySeat: rankBySeat.map((row) => row.map((n) => n / nb)),
    };
}
export function simulate(config, games, onProgress) {
    const t0 = Date.now();
    const records = [];
    for (let g = 0; g < games; g++) {
        records.push(playOneGame(config, `${config.options.seed}#${g}`));
        onProgress?.(g + 1, games);
    }
    return aggregate(records, config.players.length, Date.now() - t0);
}
/** Histogramme des scores, prêt à être tracé. */
export function histogram(values, bucket = 5) {
    if (!values.length)
        return [];
    const min = Math.floor(Math.min(...values) / bucket) * bucket;
    const max = Math.ceil(Math.max(...values) / bucket) * bucket;
    const buckets = [];
    for (let x = min; x <= max; x += bucket)
        buckets.push({ x, n: 0 });
    for (const v of values) {
        const i = Math.min(buckets.length - 1, Math.floor((v - min) / bucket));
        buckets[i].n++;
    }
    return buckets;
}
