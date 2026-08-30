# @deepseek-ai/dsh-enterprise-sla-monitor

SLO monitoring for DSH Enterprise — gateway p99 ≤ 2s, guard block-rate ≤ 1%.

## Status

Production. Tracks SLO burn rate and emits alerts when thresholds are breached.

## What it does

Records per-request latency and guard block events. Evaluates SLO windows (30m rolling, 1h, 24h) and fires alerts via a configurable webhook or stdout when the error budget is consumed beyond the configured threshold.

## Configuration

```yaml
plugins:
  - id: dsh-sla-monitor
    name: '@deepseek-ai/dsh-enterprise-sla-monitor'
    config:
      gatewaySlo:
        p99Target: 2000    # ms
        windowMinutes: 60
      guardSlo:
        blockRateTarget: 0.01   # 1%
        windowMinutes: 60
      alertWebhook: '${SLA_ALERT_WEBHOOK}'
```

## ponytail

No persistent SLO state — a restart resets burn-rate accumulation. Production deployments should persist SLO events to a time-series DB for multi-day windows.
