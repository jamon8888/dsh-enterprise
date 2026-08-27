/**
 * Secret redaction at event boundary — mirrors facility runner redaction.
 * Regex deny-list plus explicit secrets from ctx.get('credentials').
 * @module @deepseek-ai/dsh-enterprise-sandbox-runner/redaction
 */

const DENY_LIST: RegExp[] = [
  /sk-[a-zA-Z0-9]{20,}/g,
  /ghp_[a-zA-Z0-9]{36}/g,
  /xox[bpas]-[a-zA-Z0-9-]+/g,
]

export function redactSecrets(event: unknown, secrets: string[]): unknown {
  if (typeof event === 'string') {
    let out = event
    for (const re of DENY_LIST) {
      re.lastIndex = 0
      out = out.replace(re, '[REDACTED]')
    }
    for (const s of secrets) {
      if (!s) continue
      out = out.split(s).join('[REDACTED]')
    }
    return out
  }
  if (Array.isArray(event)) {
    return event.map((v) => redactSecrets(v, secrets))
  }
  if (event !== null && typeof event === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(event as Record<string, unknown>)) {
      out[k] = redactSecrets(v, secrets)
    }
    return out
  }
  return event
}
