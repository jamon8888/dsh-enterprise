import { beforeEach, describe, expect, it } from 'vitest'
import {
  addBudgetSpend,
  adjustBudgetReservations,
  applicableBudgets,
  clearBudgetCache,
  clearBudgetDefs,
  clearSpendCounters,
  hardBudgetBlock,
  registerBudgetDef,
  reserveHardBudgets,
  spendCounters,
} from '../src/budgets.ts'
import type { BudgetState } from '../src/types.ts'

function makeState(overrides: Partial<BudgetState> & { id?: string } = {}): BudgetState {
  const def = {
    id: overrides.id ?? 'bud_test',
    scope: 'org' as const,
    orgId: 'org1',
    enabled: true,
    period: 'day' as const,
    limitCents: 1000,
    ...overrides.def,
  }
  if (overrides.id) def.id = overrides.id
  return {
    def,
    windowStart: overrides.windowStart ?? '2026-08-27',
    spentCents: overrides.spentCents ?? 0,
    remaining: overrides.remaining ?? def.limitCents - (overrides.spentCents ?? 0),
  }
}

describe('hardBudgetBlock', () => {
  it('returns null when under limit', () => {
    const s = makeState({ spentCents: 500 })
    expect(hardBudgetBlock([s])).toBeNull()
  })

  it('blocks when spent+estimated > limit', () => {
    const s = makeState({ spentCents: 900 })
    // 900 + 200 = 1100 > 1000
    expect(hardBudgetBlock([s], 200)?.def.id).toBe('bud_test')
  })

  it('does not block when exactly at limit without estimate', () => {
    const s = makeState({ spentCents: 1000 })
    // 1000 + 0 = 1000 not > 1000
    expect(hardBudgetBlock([s])).toBeNull()
  })

  it('blocks when spent already over limit', () => {
    const s = makeState({ spentCents: 1100 })
    expect(hardBudgetBlock([s])?.def.id).toBe('bud_test')
  })

  it('returns first breached budget', () => {
    const a = makeState({ id: 'a', spentCents: 200 })
    const b = makeState({ id: 'b', spentCents: 900 })
    expect(hardBudgetBlock([a, b], 200)?.def.id).toBe('b')
  })
})

describe('reserveHardBudgets increments counter', () => {
  beforeEach(() => {
    clearSpendCounters()
    clearBudgetCache()
    clearBudgetDefs()
  })

  it('increments spendCounters and returns reservations', async () => {
    const s = makeState({ id: 'bud1', windowStart: '2026-08-27', spentCents: 100 })
    spendCounters.set('bud1:2026-08-27', 100)
    const rsv = await reserveHardBudgets([s], { orgId: 'org1' }, 50)
    expect(rsv).toHaveLength(1)
    expect(rsv[0]).toEqual({ budgetId: 'bud1', windowStart: '2026-08-27', estimatedCents: 50 })
    expect(spendCounters.get('bud1:2026-08-27')).toBe(150)
    expect(s.spentCents).toBe(150)
  })

  it('supports (db, states, key, estimatedCents) overload', async () => {
    const s = makeState({ id: 'bud2', windowStart: '2026-08-27', spentCents: 0 })
    const rsv = await reserveHardBudgets(null, [s], { orgId: 'org1' }, 30)
    expect(rsv[0]?.budgetId).toBe('bud2')
    expect(spendCounters.get('bud2:2026-08-27')).toBe(30)
  })

  it('no-op when estimatedCents <=0', async () => {
    const s = makeState({ id: 'bud3' })
    const rsv = await reserveHardBudgets([s], { orgId: 'org1' }, 0)
    expect(rsv).toHaveLength(0)
  })
})

describe('adjustBudgetReservations', () => {
  beforeEach(() => clearSpendCounters())

  it('adjusts counters by delta', async () => {
    spendCounters.set('bud1:2026-08-27', 150)
    await adjustBudgetReservations([{ budgetId: 'bud1', windowStart: '2026-08-27', estimatedCents: 50 }], -20)
    expect(spendCounters.get('bud1:2026-08-27')).toBe(130)
  })

  it('supports (db, reservations, delta) overload', async () => {
    spendCounters.set('bud1:2026-08-27', 100)
    await adjustBudgetReservations(null, [{ budgetId: 'bud1', windowStart: '2026-08-27', estimatedCents: 10 }], 5)
    expect(spendCounters.get('bud1:2026-08-27')).toBe(105)
  })

  it('no-op when delta 0', async () => {
    spendCounters.set('bud1:2026-08-27', 100)
    await adjustBudgetReservations([{ budgetId: 'bud1', windowStart: '2026-08-27', estimatedCents: 10 }], 0)
    expect(spendCounters.get('bud1:2026-08-27')).toBe(100)
  })

  it('reconcile: addBudgetSpend increments counter', async () => {
    const s = makeState({ id: 'bud1', windowStart: '2026-08-27', spentCents: 100 })
    spendCounters.set('bud1:2026-08-27', 100)
    await addBudgetSpend(s, { orgId: 'org1' }, 25)
    expect(spendCounters.get('bud1:2026-08-27')).toBe(125)
  })
})

describe('applicableBudgets', () => {
  beforeEach(() => {
    clearSpendCounters()
    clearBudgetCache()
    clearBudgetDefs()
  })

  it('returns states with remaining', async () => {
    registerBudgetDef({ id: 'b1', scope: 'org', orgId: 'org1', enabled: true, period: 'day', limitCents: 1000 })
    spendCounters.set('b1:2026-08-27', 200)
    const states = await applicableBudgets({ orgId: 'org1' }, new Date('2026-08-27T12:00:00Z'))
    expect(states).toHaveLength(1)
    expect(states[0]?.remaining).toBe(800)
  })

  it('supports (db, key, now) overload', async () => {
    registerBudgetDef({ id: 'b2', scope: 'org', orgId: 'org1', enabled: true, period: 'day', limitCents: 500 })
    const states = await applicableBudgets(null, { orgId: 'org1' }, new Date('2026-08-27T12:00:00Z'))
    expect(states[0]?.def.id).toBe('b2')
  })
})
