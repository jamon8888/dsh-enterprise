/**
 * CES result LRU cache for the iitGuards plugin.
 * @module @deepseek-ai/dsh-enterprise-guards-iit/cache
 */

import type { GuardResult } from './types.js'

export const CACHE_MAX_SIZE = 1000

export class CesCache {
  readonly #map = new Map<string, GuardResult>()

  static #inputKey(tpm: unknown, state: number): string {
    return JSON.stringify({ tpm, state })
  }

  get(tpm: unknown, state: number): GuardResult | undefined {
    const key = CesCache.#inputKey(tpm, state)
    const val = this.#map.get(key)
    if (val !== undefined) {
      this.#map.delete(key)
      this.#map.set(key, val)
    }
    return val
  }

  set(tpm: unknown, state: number, result: GuardResult): void {
    const key = CesCache.#inputKey(tpm, state)
    if (this.#map.has(key)) {
      this.#map.delete(key)
    } else if (this.#map.size >= CACHE_MAX_SIZE) {
      const first = this.#map.keys().next().value as string
      this.#map.delete(first)
    }
    this.#map.set(key, result)
  }

  size(): number {
    return this.#map.size
  }
}
