/**
 * OTEL SDK initialization — starts NodeSDK idempotently.
 * @module @deepseek-ai/dsh-enterprise-otel/sdk-init
 */
import { NodeSDK } from '@opentelemetry/sdk-node'
import { PeriodicExportingMetricReader, ConsoleMetricExporter } from '@opentelemetry/sdk-metrics'
import type { NodeSDKConfiguration as NodeSDKOptions } from '@opentelemetry/sdk-node'

let sdk: NodeSDK | null = null
let initCalled = false

// ponytail: ConsoleMetricExporter logs metrics to stdout; swap for OTLP when OTEL collector endpoint is configured
// ponytail: reader typed any — sdk-metrics 1.x vs sdk-node's bundled 2.x
// IMetricReader differ structurally; runtime is duck-typed and green.
// Align @opentelemetry/sdk-metrics major with sdk-node when touching OTEL.
const metricReader: any = new PeriodicExportingMetricReader({
  exporter: new ConsoleMetricExporter(),
  exportIntervalMillis: 60_000,
})

export function initOtel(): () => void {
  if (initCalled) return () => { /* already started */ }
  initCalled = true

  const serviceName = process.env['OTEL_SERVICE_NAME'] ?? 'dsh-enterprise'
  // ponytail: process.env OTEL config only; add config-file parsing when OTEL Collector config file needed
  const opts: Partial<NodeSDKOptions> = {
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
