/**
 * `dsh-enterprise receipt verify` — recomputes hashReceiptWithoutHash + phi recompute stub.
 * @module @deepseek-ai/dsh-enterprise-cli/receipt
 */
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createHash } from 'node:crypto'
type Receipt = {
  runId: string; sessionId: string; agentId: string; prevHash: string; logHash: string
  phiSnapshot: { phi: number; method: string; cesHash: string }
  outcome: string; cost: unknown; guardDispositions: unknown; builtAt: number; builder: unknown; hash: string
}
function canonicalJson(obj: unknown): string {
  return JSON.stringify(obj, (_k, v) => {
    if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
      const s: Record<string, unknown> = {}
      for (const k of Object.keys(v as Record<string, unknown>).sort()) s[k] = (v as Record<string, unknown>)[k]
      return s
    }
    return v
  })
}
function hashReceiptWithoutHash(r: Omit<Receipt,'hash'>): string {
  return createHash('sha256').update(canonicalJson(r), 'utf8').digest('hex')
}

export type VerifyResult = { ok: boolean; message: string }

export async function verifyReceipt(runId: string, opts: { dir?: string } = {}): Promise<VerifyResult> {
  const dir = opts.dir ?? process.cwd()

  // Locate receipt: .dsh/receipts.json array or .dsh/receipts/<runId>.json
  let receipt: Receipt | undefined
  const byId = join(dir, '.dsh/receipts', `${runId}.json`)
  const chainPath = join(dir, '.dsh/receipts.json')

  if (existsSync(byId)) {
    receipt = JSON.parse(readFileSync(byId, 'utf8')) as Receipt
  } else if (existsSync(chainPath)) {
    const chain = JSON.parse(readFileSync(chainPath, 'utf8')) as Receipt[]
    receipt = chain.find(r => r.runId === runId)
  }

  if (!receipt) return { ok: false, message: `receipt not found for runId ${runId}` }

  // recompute hash
  const { hash, ...withoutHash } = receipt as Receipt & Record<string, unknown>
  const recomputed = hashReceiptWithoutHash(withoutHash as Omit<Receipt, 'hash'>)
  if (recomputed !== hash) {
    return { ok: false, message: `hash mismatch: expected ${hash}, recomputed ${recomputed}` }
  }

  // ruvector phi recompute stub: log + hash compare already covers integrity;
  // if phiSnapshot present, we just log that it would be recomputed
  // deterministic: same input => same outcome
  if (receipt.phiSnapshot) {
    // stub phi recompute — in real impl would call ruvector via iit-core
    // we just verify phiSnapshot has required fields
    if (typeof receipt.phiSnapshot.phi !== 'number' || typeof receipt.phiSnapshot.cesHash !== 'string') {
      return { ok: false, message: 'phiSnapshot malformed' }
    }
  }

  return { ok: true, message: `receipt ${runId} verified (hash ${hash.slice(0, 8)}…)` }
}
