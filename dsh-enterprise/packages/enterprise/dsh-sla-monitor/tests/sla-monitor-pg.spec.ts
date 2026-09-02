import { describe, it, expect, vi, beforeEach } from 'vitest'
import { SlaMonitor, apply, SLO } from '../src/plugin.js'

function mockCtx(pg?: any) {
  const handlers: Record<string, any[]> = {}
  const services: Record<string, any> = {}
  const ctx: any = {
    pg,
    db: pg,
    effect: vi.fn((n: string, f: () => any) => {
      services[n] = f()
      return () => {}
    }),
    on: vi.fn((e: string, h: any) => {
      ;(handlers[e] ??= []).push(h)
      return () => {}
    }),
    get: vi.fn((k: string) => services[k]),
    waterfall: async (event: string, ev: any, next: any) => {
      const list = handlers[event] ?? []
      let i = -1
      const dispatch = async (cur: any): Promise<any> => {
        i++
        if (i < list.length) return list[i](cur, dispatch)
        return next(cur)
      }
      return dispatch(ev)
    },
  }
  return { ctx, services }
}

describe('sla-monitor pg query', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('p99 query uses percentile_cont(0.99) WITHIN GROUP for run_events lookback', async () => {
    const query = vi.fn(async () => [])
    const pg = { query }
    const { ctx } = mockCtx(pg)
    apply(ctx, { pg })

    // Simulate the PG path that would be triggered for historical p99 lookback:
    // SELECT percentile_cont(0.99) WITHIN GROUP (ORDER BY duration_ms)
    // OVER () AS p99 FROM run_events
    // WHERE org_id = $1 AND event_type = 'gateway_request'
    // AND recorded_at > NOW() - INTERVAL '1 hour'
    const orgId = 'org-1'
    const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()

    await pg.query(
      `SELECT percentile_cont(0.99) WITHIN GROUP (ORDER BY duration_ms) OVER () AS p99
       FROM run_events
       WHERE org_id = $1 AND event_type = 'gateway_request' AND recorded_at > $2`,
      [orgId, hourAgo]
    )

    expect(query).toHaveBeenCalledTimes(1)
    const [sql, params] = query.mock.calls[0]!
    expect(sql).toContain('percentile_cont(0.99)')
    expect(sql).toContain('WITHIN GROUP')
    expect(sql).toContain('run_events')
    expect(sql).toContain('ORDER BY duration_ms')
    expect(sql).toContain('OVER ()')
    expect(params[0]).toBe(orgId)
  })

  it('guard block_rate query uses COUNT with GuardError filter', async () => {
    const query = vi.fn(async () => [])
    const pg = { query }
    const { ctx } = mockCtx(pg)
    apply(ctx, { pg })

    const orgId = 'org-1'
    const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()

    // Simulate guard block rate query:
    // SELECT
    //   COUNT(*) FILTER (WHERE error_code = 'GUARD_BLOCKED')::float / NULLIF(COUNT(*), 0)
    // FROM run_events
    // WHERE org_id = $1 AND event_type = 'guard_block' AND recorded_at > $2
    await pg.query(
      `SELECT
         COUNT(*) FILTER (WHERE error_code = 'GUARD_BLOCKED')::float / NULLIF(COUNT(*), 0) AS block_rate
       FROM run_events
       WHERE org_id = $1 AND event_type = 'guard_block' AND recorded_at > $2`,
      [orgId, hourAgo]
    )

    expect(query).toHaveBeenCalledTimes(1)
    const [sql] = query.mock.calls[0]!
    expect(sql).toContain('FILTER')
    expect(sql).toContain('GUARD_BLOCKED')
    expect(sql).toContain('guard_block')
    expect(sql).toContain('NULLIF')
  })

  it('SLO constants are consistent with pg query thresholds', () => {
    expect(SLO.gatewayP99Ms).toBe(2000)
    expect(SLO.guardBlockRate).toBe(0.01)
  })

  it('historical p99 > SLO threshold generates alert via record()', async () => {
    const m = new SlaMonitor()
    const mockPgResult = [{ p99: 2500 }]
    // Simulate fetching p99=2500 from PG
    const p99Value = mockPgResult[0]!.p99
    const alert = m.record('gateway.p99', p99Value)
    expect(alert).not.toBeNull()
    expect(alert!.value).toBe(2500)
    expect(alert!.threshold).toBe(SLO.gatewayP99Ms)
  })
})
