/**
 * Shared OTEL Meter for dsh-otel and downstream consumers (guards-iit).
 * @module @deepseek-ai/dsh-enterprise-otel/meter
 */
import { metrics } from '@opentelemetry/api'

export const meter = metrics.getMeter('dsh-otel')
