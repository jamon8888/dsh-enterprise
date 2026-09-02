/**
 * Envelope store — P0 dual-write stub.
 * Facility's envelope-store.ts writes to S3/R2 + Postgres. Here we log to console and
 * return a memory:// URI. R2 WORM is Phase 2.5.
 * @module @deepseek-ai/dsh-enterprise-gateway/envelope-store
 */

export async function captureEnvelope(req: unknown, res: unknown): Promise<string> {
  const url = `memory://envelope/${Date.now()}`
  // dual-write: console for P0 audit — Phase 2.5 will add R2 WORM
  console.log('[gateway envelope]', { url, req: truncate(req), res: truncate(res) })
  return url
}

function truncate(v: unknown): unknown {
  try {
    const s = JSON.stringify(v)
    if (s && s.length > 2000) return s.slice(0, 2000) + '…'
    return v
  } catch {
    return String(v)
  }
}
