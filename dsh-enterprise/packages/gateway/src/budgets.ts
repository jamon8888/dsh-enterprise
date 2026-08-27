/**
 * Budgets — port of facility/services/gateway/src/budgets.ts (9941 B @ b150d96).
 * Divergence: in-memory Map for budgetDefCache (10k) + spendCounters (Map<string,number>).
 * Postgres migration 002_enterprise_budgets will add real spend_counters table; until then P0 is in-memory.
 * @module @deepseek-ai/dsh-enterprise-gateway/budgets
 */
// ponytail: in-memory spendCounters, Postgres when watchtower lands

import type { BudgetDef, BudgetKey, BudgetReservation, BudgetState } from './types.js'

// -- budget def store (P0 in-memory; facility queries `budgets` table) ----------------

const budgetDefs = new Map<string, BudgetDef>()

export function registerBudgetDef(def: BudgetDef): void {
  budgetDefs.set(def.id, def)
  // invalidate cache entries that might have cached this org/project slice
  // simplest: clear affected prefix — for P0 just clear all (bounded 10k, cheap)
  budgetDefCache.clear()
}

export function clearBudgetDefs(): void {
  budgetDefs.clear()
  budgetDefCache.clear()
}

// -- budgetDefCache (10k, 30s TTL) ----------------------------------------------------
// Mirrors facility's budgetDefCache: Map<cacheKey,{expiresAt,defs}>
const BUDGET_DEF_CACHE_MAX = 10_000
const budgetDefCache = new Map<string, { expiresAt: number; defs: BudgetDef[] }>()
const BUDGET_TTL_MS = 30_000

function cacheBudgetDefs(cacheKey: string, value: { expiresAt: number; defs: BudgetDef[] }) {
  if (budgetDefCache.size >= BUDGET_DEF_CACHE_MAX) {
    const nowMs = Date.now()
    for (const [k, v] of budgetDefCache) if (v.expiresAt <= nowMs) budgetDefCache.delete(k)
    if (budgetDefCache.size >= BUDGET_DEF_CACHE_MAX) budgetDefCache.clear()
  }
  budgetDefCache.set(cacheKey, value)
}

export function clearBudgetCache(): void {
  budgetDefCache.clear()
}

// -- spendCounters: Map<budgetId:windowStart, spentCents> -----------------------------
// Mirrors facility's spendCounters table (budget_id, window_start) unique index.
// P0 is in-memory; see ponytail note.
export const spendCounters = new Map<string, number>()

export function clearSpendCounters(): void {
  spendCounters.clear()
}

function counterKey(budgetId: string, windowStart: string): string {
  return `${budgetId}:${windowStart}`
}

// -- windowStart ----------------------------------------------------------------------

export function windowStart(period: BudgetDef['period'] | string, now: Date): string {
  const d = new Date(now)
  if (period === 'hour') {
    d.setUTCMinutes(0, 0, 0)
    return d.toISOString().slice(0, 13) + ':00:00.000Z'
  }
  if (period === 'day') {
    d.setUTCHours(0, 0, 0, 0)
    return d.toISOString().slice(0, 10)
  }
  if (period === 'month') {
    d.setUTCDate(1)
    d.setUTCHours(0, 0, 0, 0)
    return d.toISOString().slice(0, 7)
  }
  d.setUTCHours(0, 0, 0, 0)
  return d.toISOString().slice(0, 10)
}

// -- applicableBudgets ---------------------------------------------------------------
// Task spec: applicableBudgets(db,key,now) — db is ignored for P0 (in-memory).
// Also supports applicableBudgets(key,now) as used by plugin.ts.
// Overload: applicableBudgets(key, now) | applicableBudgets(db, key, now)
export async function applicableBudgets(
  arg1: unknown,
  arg2: unknown,
  arg3?: unknown,
): Promise<BudgetState[]> {
  let key: BudgetKey
  let now: Date
  if (arg3 instanceof Date) {
    // (db, key, now)
    key = arg2 as BudgetKey
    now = arg3
  } else if (arg2 instanceof Date) {
    // (key, now)
    key = arg1 as BudgetKey
    now = arg2 as Date
  } else if (arg1 && typeof (arg1 as BudgetKey).orgId === 'string') {
    key = arg1 as BudgetKey
    now = (arg2 as Date) ?? new Date()
  } else {
    throw new Error('applicableBudgets: invalid args')
  }

  const cacheKey = `${key.orgId}:${key.projectId ?? 'none'}`
  let cached = budgetDefCache.get(cacheKey)
  if (!cached || cached.expiresAt <= Date.now()) {
    const defs = [...budgetDefs.values()].filter(
      (d) => d.enabled && d.orgId === key.orgId && (d.scope === 'org' || (d.scope === 'project' && d.projectId === key.projectId)),
    )
    cached = { expiresAt: Date.now() + BUDGET_TTL_MS, defs }
    cacheBudgetDefs(cacheKey, cached)
  }
  if (cached.defs.length === 0) return []

  return cached.defs.map((def) => {
    const ws = windowStart(def.period, now)
    const spent = spendCounters.get(counterKey(def.id, ws)) ?? 0
    return {
      def,
      windowStart: ws,
      spentCents: spent,
      remaining: def.limitCents - spent,
    }
  })
}

// -- hardBudgetBlock ---------------------------------------------------------------
// Task: hardBudgetBlock(states)->BudgetState|null (hard block when spent+estimated > limit)
// Facility impl: states.find(s => s.mode==='hard' && s.spentCents >= s.limitCents)
// Here BudgetState has def.limitCents + spentCents; we treat all budgets as hard for P0
// and support optional estimatedCents param for the spent+estimated check.
export function hardBudgetBlock(states: BudgetState[], estimatedCents = 0): BudgetState | null {
  return states.find((s) => s.spentCents + estimatedCents > s.def.limitCents) ?? null
}

// -- reserveHardBudgets ------------------------------------------------------------
// Task: reserveHardBudgets(db,states,key,estimatedCents)->BudgetReservation[] (insert spendCounters)
// Supports both (states,key,estimatedCents) and (db,states,key,estimatedCents).
export async function reserveHardBudgets(
  arg1: unknown,
  arg2: unknown,
  arg3: unknown,
  arg4?: unknown,
): Promise<BudgetReservation[]> {
  let states: BudgetState[]
  let estimatedCents: number
  if (Array.isArray(arg1) && arg4 === undefined && typeof arg2 === 'object' && typeof arg3 === 'number') {
    // (states, key, estimatedCents)
    states = arg1 as BudgetState[]
    estimatedCents = arg3 as number
  } else if (Array.isArray(arg2) && typeof arg4 === 'number') {
    // (db, states, key, estimatedCents)
    states = arg2 as BudgetState[]
    estimatedCents = arg4 as number
  } else if (Array.isArray(arg1) && typeof arg3 === 'number') {
    // fallback: (states, key, estimatedCents) where key is arg2
    states = arg1 as BudgetState[]
    estimatedCents = arg3 as number
  } else {
    throw new Error('reserveHardBudgets: invalid args')
  }
  if (estimatedCents <= 0) return []
  const reservations: BudgetReservation[] = []
  for (const state of states) {
    const key = counterKey(state.def.id, state.windowStart)
    const cur = spendCounters.get(key) ?? state.spentCents
    const next = cur + estimatedCents
    spendCounters.set(key, next)
    // keep state.spentCents in sync for callers that reuse the array
    state.spentCents = next
    state.remaining = state.def.limitCents - next
    reservations.push({ budgetId: state.def.id, windowStart: state.windowStart, estimatedCents })
  }
  return reservations
}

// -- adjustBudgetReservations ------------------------------------------------------
export async function adjustBudgetReservations(
  reservations: BudgetReservation[],
  deltaCents: number,
): Promise<void>
export async function adjustBudgetReservations(
  _db: unknown,
  reservations: BudgetReservation[],
  deltaCents: number,
): Promise<void>
export async function adjustBudgetReservations(
  arg1: unknown,
  arg2?: unknown,
  arg3?: unknown,
): Promise<void> {
  let reservations: BudgetReservation[]
  let deltaCents: number
  if (Array.isArray(arg1) && typeof arg2 === 'number') {
    reservations = arg1 as BudgetReservation[]
    deltaCents = arg2 as number
  } else if (Array.isArray(arg2) && typeof arg3 === 'number') {
    reservations = arg2 as BudgetReservation[]
    deltaCents = arg3 as number
  } else {
    throw new Error('adjustBudgetReservations: invalid args — expected (reservations, deltaCents) or (db, reservations, deltaCents)')
  }
  if (deltaCents === 0) return
  for (const r of reservations) {
    const key = counterKey(r.budgetId, r.windowStart)
    const cur = spendCounters.get(key) ?? 0
    spendCounters.set(key, cur + deltaCents)
  }
}

// -- addBudgetSpend ---------------------------------------------------------------
export async function addBudgetSpend(
  budget: BudgetState,
  _key: BudgetKey,
  costCents: number,
): Promise<void>
export async function addBudgetSpend(
  _db: unknown,
  budget: BudgetState,
  _key: unknown,
  costCents: number,
): Promise<void>
export async function addBudgetSpend(arg1: unknown, arg2: unknown, arg3: unknown, arg4?: unknown): Promise<void> {
  let budget: BudgetState
  let costCents: number
  if (arg4 !== undefined) {
    // (db, budget, key, costCents)
    budget = arg2 as BudgetState
    costCents = arg4 as number
  } else {
    // (budget, key, costCents)
    budget = arg1 as BudgetState
    costCents = arg3 as number
  }
  if (costCents === 0) return
  const key = counterKey(budget.def.id, budget.windowStart)
  const cur = spendCounters.get(key) ?? budget.spentCents
  spendCounters.set(key, cur + costCents)
  budget.spentCents = cur + costCents
  budget.remaining = budget.def.limitCents - budget.spentCents
}
