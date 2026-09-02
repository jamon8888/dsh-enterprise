import { metrics } from '@opentelemetry/api'

let meter = metrics.getMeter('dsh-enterprise-guards-iit')

try {
  const dshOtel = await import('@deepseek-ai/dsh-enterprise-otel/meter')
  meter = (dshOtel as { meter: { createHistogram: (name: string, opts?: Record<string, unknown>) => { record: (value: number, attributes?: Record<string, string>) => void } } }).meter
} catch {
  meter = metrics.getMeter('dsh-enterprise-guards-iit-noop', { version: '0.0.0' })
}

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
