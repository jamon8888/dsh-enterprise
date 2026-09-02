/**
 * OTEL SDK initialization — starts NodeSDK idempotently.
 * @module @deepseek-ai/dsh-enterprise-otel/sdk-init
 */
import { NodeSDK } from '@opentelemetry/sdk-node'
import { PeriodicExportingMetricReader, ConsoleMetricExporter } from '@opentelemetry/sdk-metrics'
import type { NodeSDKOptions } from '@opentelemetry/sdk-node'

let sdk: NodeSDK | null = null
let initCalled = false

// ponytail: ConsoleMetricExporter logs metrics to stdout; swap for OTLP when OTEL collector endpoint is configured
const metricReader = new PeriodicExportingMetricReader({
  exporter: new ConsoleMetricExporter(),
  exportIntervalMillis: 60_000,
})

export function initOtel(): () => void {
  if (initCalled) return () => { /* already started */ }
  initCalled = true

  const serviceName = process.env['OTEL_SERVICE_NAME'] ?? 'dsh-enterprise'
  // ponytail: process.env OTEL config only; add config-file parsing when OTEL Collector config file needed
  const opts: NodeSDKOptions = {
    serviceName,
    metricReader,
  }

  sdk = new NodeSDK(opts)
  sdk.start()

  return () => {
    sdk?.shutdown()
    sdk = null
    initCalled = false
  }
}
