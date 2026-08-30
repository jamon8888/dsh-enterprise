# @deepseek-ai/dsh-enterprise-otel

OpenTelemetry tracing and metrics for DSH Enterprise — gateway, guard, and watchtower spans.

## Status

Production. Instruments Cordis agent-loop spans, LLM call traces, and tool execution.

## What it does

Emits OTLP spans for every agent step: prompt assembly, model calls, tool use, and session lifecycle. Metrics cover request counts, token usage, error rates, and guard trigger counts.

## Configuration

```yaml
plugins:
  - id: dsh-otel
    name: '@deepseek-ai/dsh-enterprise-otel'
    config:
      serviceName: 'dsh-gateway'
      exporterEndpoint: 'http://otel-collector:4318'
      samplingRatio: 1.0
```

## ponytail

No native buffering — drops spans under load. Add an OTel Collector with a batch processor before production use.
