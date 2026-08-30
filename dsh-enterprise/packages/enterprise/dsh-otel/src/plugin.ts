/**
 * dsh-otel Cordis plugin — OpenTelemetry tracing for gateway/guard/watchtower.
 * @module @deepseek-ai/dsh-enterprise-otel/plugin
 */
import * as api from '@opentelemetry/api'
import { initOtel } from './sdk-init.js'

export const name = 'dsh-enterprise:dsh-otel'
export const inject = [] as const

export type OtelService = {
  trace: (name: string, fn: (span: api.Span) => unknown) => unknown
}

export function apply(ctx: any): void {
  initOtel()
  const svc: OtelService = {
    trace: (name: string, fn: (span: api.Span) => unknown) =>
      api.trace.getTracer('dsh-enterprise').startActiveSpan(name, fn as any),
  }
  ctx.effect('otel', () => svc)

  const withSpan = (spanName: string) => async (ev: any, next: any) => {
    const tracer = api.trace.getTracer('dsh-enterprise')
    // startActiveSpan handles context propagation; propagate traceId onto event for downstream
    return tracer.startActiveSpan(spanName, async (span: api.Span) => {
      try {
        const traceId = span.spanContext().traceId
        if (ev && typeof ev === 'object') ev.traceId = traceId
        const result = await next(ev)
        return result
      } finally {
        span.end()
      }
    })
  }

  ctx.on('gateway/request', withSpan('gateway/request'))
  ctx.on('guard/block', withSpan('guard/block'))
  // legacy/wildcard also support guard/* spelling — register both for spec compat
  ctx.on('guard/*', withSpan('guard/block'))
  ctx.on('watchtower/receipt', withSpan('watchtower/receipt'))
  ctx.on('watchtower/receipt-generated', withSpan('watchtower/receipt'))
}
