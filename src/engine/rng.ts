/**
 * Générateur pseudo-aléatoire déterministe (mulberry32).
 * Une graine identique rejoue exactement la même partie : indispensable pour
 * comparer deux stratégies ou reproduire un bug de playtest.
 */
export class Rng {
  private state: number

  constructor(seed: string | number) {
    this.state = typeof seed === 'number' ? seed >>> 0 : hashString(seed)
  }

  next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0
    let t = this.state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }

  int(maxExclusive: number): number {
    return Math.floor(this.next() * maxExclusive)
  }

  pick<T>(arr: readonly T[]): T {
    return arr[this.int(arr.length)]
  }

  shuffle<T>(arr: T[]): T[] {
    const out = arr.slice()
    for (let i = out.length - 1; i > 0; i--) {
      const j = this.int(i + 1)
      ;[out[i], out[j]] = [out[j], out[i]]
    }
    return out
  }
}

export function hashString(s: string): number {
  let h = 2166136261 >>> 0
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

const WORDS = [
  'camino',
  'sentier',
  'chemin',
  'sierra',
  'mesa',
  'rio',
  'sol',
  'luna',
  'verde',
  'azul',
  'rojo',
  'oro',
]

export function randomSeed(): string {
  const w = WORDS[Math.floor(Math.random() * WORDS.length)]
  return `${w}-${Math.floor(Math.random() * 9000 + 1000)}`
}
