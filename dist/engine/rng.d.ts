/**
 * Générateur pseudo-aléatoire déterministe (mulberry32).
 * Une graine identique rejoue exactement la même partie : indispensable pour
 * comparer deux stratégies ou reproduire un bug de playtest.
 */
export declare class Rng {
    private state;
    constructor(seed: string | number);
    next(): number;
    int(maxExclusive: number): number;
    pick<T>(arr: readonly T[]): T;
    shuffle<T>(arr: T[]): T[];
}
export declare function hashString(s: string): number;
export declare function randomSeed(): string;
