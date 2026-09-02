/**
 * Canonical JSON serialization — deterministic ordering for receipt/chain verification.
 * Keys are sorted recursively; arrays preserve order.
 * @module @deepseek-ai/dsh-enterprise-utils/canonical
 */

export function canonicalJson(obj: unknown): string {
  return JSON.stringify(obj, (_k, v) => {
    if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
      const sorted: Record<string, unknown> = {}
      for (const k of Object.keys(v as Record<string, unknown>).sort()) {
        sorted[k] = (v as Record<string, unknown>)[k]
      }
      return sorted
    }
    return v
  })
}

export function sha256Hex(data: string): string {
  // Prefer Node.js crypto; fall back to Web Crypto in browser contexts
  try {
    const { createHash } = require('node:crypto') as typeof import('node:crypto')
    return createHash('sha256').update(data, 'utf8').digest('hex')
  } catch {
    throw new Error('sha256Hex requires Node.js crypto (not available in this environment)')
  }
}
