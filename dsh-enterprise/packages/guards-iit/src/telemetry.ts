import { metrics } from '@opentelemetry/api'

const meter = metrics.getMeter('dsh-enterprise-guards-iit')

export const iitPhiHistogram = meter.createHistogram('iit.phi', {
  description: 'Phi values from IIT computation',
  unit: 'phi',
})

export const iitEwsHistogram = meter.createHistogram('iit.ews', {
  description: 'Early warning signal values',
})

export const iitLatencyHistogram = meter.createHistogram('iit.latency', {
  description: 'Guard evaluation latency',
  unit: 'ms',
})

export function recordPhi(phi: number): void {
  try { iitPhiHistogram.record(phi) } catch {}
}

export function recordEws(variance: number, ac1: number): void {
  try { iitEwsHistogram.record(variance, { ac1: String(ac1) }) } catch {}
}

export function recordLatency(ms: number, guardId: string): void {
  try { iitLatencyHistogram.record(ms, { guardId }) } catch {}
}
