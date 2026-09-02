import { describe, it, expect } from 'vitest'
import { CesCache, CACHE_MAX_SIZE } from '../src/cache.js'
import type { GuardResult } from '../src/types.js'

const makeResult = (phi: number, cesHash: string): GuardResult => ({
  disposition: 'pass',
  phi,
  cesHash,
})

const tpm = { a: 1, b: 2 }
const state = 42

describe('CesCache', () => {
  it('get returns undefined on empty cache (miss)', () => {
    const cache = new CesCache()
    expect(cache.get(tpm, state)).toBeUndefined()
  })

  it('set stores a result', () => {
    const cache = new CesCache()
    const result = makeResult(0.5, 'abc123')
    cache.set(tpm, state, result)
    expect(cache.size()).toBe(1)
  })

  it('get returns stored result (hit)', () => {
    const cache = new CesCache()
    const result = makeResult(0.5, 'abc123')
    cache.set(tpm, state, result)
    expect(cache.get(tpm, state)).toEqual(result)
  })

  it('LRU eviction when cache exceeds 1000 entries', () => {
    const cache = new CesCache()
    for (let i = 0; i < CACHE_MAX_SIZE; i++) {
      cache.set({ i }, i, makeResult(i / 1000, `hash-${i}`))
    }
    expect(cache.size()).toBe(CACHE_MAX_SIZE)
    cache.set({ i: 9999 }, 9999, makeResult(999, 'hash-new'))
    expect(cache.size()).toBe(CACHE_MAX_SIZE)
    expect(cache.get({ i: 0 }, 0)).toBeUndefined()
    expect(cache.get({ i: 9999 }, 9999)?.cesHash).toBe('hash-new')
  })

  it('recently-used entry is NOT evicted when cache is full', () => {
    const cache = new CesCache()
    for (let i = 0; i < CACHE_MAX_SIZE; i++) {
      cache.set({ i }, i, makeResult(i / 1000, `hash-${i}`))
    }
    cache.get({ i: 0 }, 0)
    cache.set({ i: 9999 }, 9999, makeResult(999, 'hash-new'))
    expect(cache.get({ i: 0 }, 0)).toBeDefined()
    expect(cache.get({ i: 1 }, 1)).toBeUndefined()
    expect(cache.get({ i: 9999 }, 9999)?.cesHash).toBe('hash-new')
  })

  it('overwrite replaces the stored value', () => {
    const cache = new CesCache()
    cache.set(tpm, state, makeResult(0.1, 'hash-a'))
    expect(cache.get(tpm, state)?.cesHash).toBe('hash-a')
    cache.set(tpm, state, makeResult(0.3, 'hash-c'))
    expect(cache.get(tpm, state)?.phi).toBe(0.3)
    expect(cache.get(tpm, state)?.cesHash).toBe('hash-c')
  })
})
