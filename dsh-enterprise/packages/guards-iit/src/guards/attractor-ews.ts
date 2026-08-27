/**
 * attractor-ews guard — warns (not blocks) when EWS variance/ac1 exceed limits.
 * Per SPEC 4.1 warning severity → emits `audit` event, never throws.
 * Bridges to Rust `attractor.rs` WASM `ews_variance` / `ews_ac1`, JS fallback when absent.
 * @module @deepseek-ai/dsh-enterprise-guards-iit/guards/attractor-ews
 */

import z from '@deepseek-ai/schemastery'

export const attractorEwsGuard = {
  id: 'attractor-ews' as const,
  Config: z.object({ varianceLimit: z.number().default(2.0), acLimit: z.number().default(0.7) }),
  async run(
    ctx: unknown,
    cfg: { varianceLimit: number; acLimit: number },
    event: { trajectory: number[] },
  ): Promise<{ disposition: 'pass' | 'warn'; variance: number; ac1: number }> {
    let v: number | undefined
    let ac1: number | undefined

    try {
      const mod = await import('@deepseek-ai/dsh-enterprise-iit-core/pkg') as {
        ews_variance?: (traj: number[]) => number
        ews_ac1?: (traj: number[]) => number
      }
      if (typeof mod.ews_variance === 'function' && typeof mod.ews_ac1 === 'function') {
        v = mod.ews_variance(event.trajectory)
        ac1 = mod.ews_ac1(event.trajectory)
      }
    } catch {
      // WASM not available — JS fallback
    }

    if (v === undefined || ac1 === undefined) {
      v = ewsVarianceJs(event.trajectory)
      ac1 = ewsAc1Js(event.trajectory)
    }

    if ((v ?? 0) > cfg.varianceLimit || (ac1 ?? 0) > cfg.acLimit) {
      const payload = { variance: v, ac1 }
      // prefer ctx.audit.emit, fallback to ctx.get('audit')
      const maybeAudit = (ctx as { audit?: { emit?: (ev: string, data: unknown) => void }; get?: (k: string) => { emit?: (ev: string, data: unknown) => void } })
      const emit = maybeAudit.audit?.emit ?? maybeAudit.get?.('audit')?.emit
      if (typeof emit === 'function') {
        try { emit.call(maybeAudit.audit ?? maybeAudit.get?.('audit'), 'iit/ews', payload) } catch { /* ignore */ }
      } else if (typeof (ctx as { emit?: (ev: string, data: unknown) => void }).emit === 'function') {
        try { (ctx as { emit: (ev: string, data: unknown) => void }).emit('iit/ews', payload) } catch { /* ignore */ }
      }
      return { disposition: 'warn', variance: v!, ac1: ac1! }
    }
    return { disposition: 'pass', variance: v!, ac1: ac1! }
  },
}

function ewsVarianceJs(window: number[]): number {
  if (!window || window.length === 0) return 0
  const xs = window.filter((v) => Number.isFinite(v))
  if (xs.length === 0) return 0
  const n = xs.length
  const mean = xs.reduce((a, b) => a + b, 0) / n
  const v = xs.reduce((a, b) => a + (b - mean) ** 2, 0) / n
  return Number.isFinite(v) ? v : 0
}

function ewsAc1Js(window: number[]): number {
  const n = window?.length ?? 0
  if (n < 2) return 0
  const a = window.slice(0, n - 1)
  const b = window.slice(1)
  const am = a.reduce((x, y) => x + y, 0) / a.length
  const bm = b.reduce((x, y) => x + y, 0) / b.length
  let cross = 0
  let da2 = 0
  let db2 = 0
  for (let i = 0; i < a.length; i++) {
    const da = a[i] - am
    const db = b[i] - bm
    cross += da * db
    da2 += da * da
    db2 += db * db
  }
  const den = Math.sqrt(da2 * db2)
  if (den === 0 || !Number.isFinite(den) || !Number.isFinite(cross)) return 0
  const r = cross / den
  return Number.isFinite(r) ? r : 0
}
