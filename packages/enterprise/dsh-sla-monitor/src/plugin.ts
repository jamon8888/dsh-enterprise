/**
 * dsh-sla-monitor Cordis plugin — SLO dashboards: gateway-p99 2s, guard-block-rate 1%.
 * Thresholds from grafana/alerts.yaml.
 * @module @deepseek-ai/dsh-enterprise-sla-monitor/plugin
 */

export const name = 'dsh-enterprise:dsh-sla-monitor'
export const inject = [] as const

export const SLO = {
  gatewayP99Ms: 2000,
  guardBlockRate: 0.01,
} as const

export type Alert = {
  metric: string
  value: number
  threshold: number
  message: string
  timestamp: string
}

export class SlaMonitor {
  alerts: Alert[] = []
  private latencies: number[] = []
  private guardTotal = 0
  private guardBlocked = 0

  check(metric: string, value: number): Alert | null {
    let threshold: number | undefined
    let message = ''
    if (metric === 'gateway.p99' || metric === 'gateway-p99' || metric === 'gateway/p99') {
      threshold = SLO.gatewayP99Ms
      if (value > threshold) message = `gateway p99 ${value}ms > SLO ${threshold}ms`
    } else if (metric === 'guard.block_rate' || metric === 'guard-block-rate' || metric === 'guard/block_rate') {
      threshold = SLO.guardBlockRate
      if (value > threshold) message = `guard block rate ${value} > SLO ${threshold}`
    }
    if (threshold != null && value > threshold) {
      const alert: Alert = { metric, value, threshold, message, timestamp: new Date().toISOString() }
      this.alerts.push(alert)
      return alert
    }
    return null
  }

  record(metric: string, value: number): Alert | null {
    return this.check(metric, value)
  }

  // latency histogram helper — in-memory sorted, Postgres percentile when needed
  observeLatency(ms: number): Alert | null {
    this.latencies.push(ms)
    if (this.latencies.length > 1000) this.latencies.shift()
    const sorted = [...this.latencies].sort((a, b) => a - b)
    const idx = Math.ceil(0.99 * sorted.length) - 1
    const p99 = sorted[Math.max(0, idx)] ?? ms
    if (p99 > SLO.gatewayP99Ms) return this.check('gateway.p99', p99)
    return null
  }

  observeGuard(blocked: boolean): Alert | null {
    this.guardTotal++
    if (blocked) this.guardBlocked++
    const rate = this.guardTotal ? this.guardBlocked / this.guardTotal : 0
    if (rate > SLO.guardBlockRate) return this.check('guard.block_rate', rate)
    return null
  }

  clear(): void {
    this.alerts = []
    this.latencies = []
    this.guardTotal = 0
    this.guardBlocked = 0
  }
}

export function apply(ctx: any): void {
  const monitor = new SlaMonitor()
  const svc = {
    record: monitor.record.bind(monitor),
    check: monitor.check.bind(monitor),
    observeLatency: monitor.observeLatency.bind(monitor),
    observeGuard: monitor.observeGuard.bind(monitor),
    alerts: monitor.alerts,
    monitor,
    SLO,
  }
  ctx.effect('sla-monitor', () => svc)
  ctx.effect('slaMonitor', () => svc)
  ctx.effect('slo', () => SLO)

  // gateway/request latency path
  ctx.on('gateway/request', async (ev: any, next: any) => {
    const start = Date.now()
    try {
      const res = await next(ev)
      const dur = typeof ev?.durationMs === 'number' ? ev.durationMs : Date.now() - start
      // also honor explicit latency metric in event
      const latency = typeof ev?.latencyMs === 'number' ? ev.latencyMs : dur
      monitor.observeLatency(latency)
      return res
    } catch (e) {
      const dur = Date.now() - start
      monitor.observeLatency(dur)
      throw e
    }
  })

  // ponytail: PG query for historical p99 when watchtower PG migration 002 lands
  // guard/block rate
  ctx.on('guard/block', async (ev: any, next: any) => {
    try {
      const res = await next(ev)
      monitor.observeGuard(false)
      return res
    } catch (e) {
      monitor.observeGuard(true)
      throw e
    }
  })
  ctx.on('guard/*', async (ev: any, next: any) => {
    // fallback wildcard
    try {
      const res = await next(ev)
      // don't double-count if already counted via guard/block
      return res
    } catch (e) {
      // count as blocked if error is GuardError
      const isGuard = (e as any)?.code === 'GUARD_BLOCKED' || (e as any)?.name === 'GuardError'
      if (isGuard) monitor.observeGuard(true)
      throw e
    }
  })

  // direct metric ingest
  ctx.on('sla/metric', async (ev: any, next: any) => {
    if (ev?.metric && typeof ev.value === 'number') monitor.record(ev.metric, ev.value)
    return next(ev)
  })
}
