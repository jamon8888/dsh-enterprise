/**
 * Receipt hash chain — canonical JSON + SHA-256.
 * Facility core/receipts.ts pattern, extended with phiSnapshot + builder attestation.
 * @module @deepseek-ai/dsh-enterprise-watchtower/receipts
 */

import { canonicalJson, sha256Hex } from '@deepseek-ai/dsh-enterprise-utils'
import type { Receipt, Run } from './types.js'

/** Hash of a receipt without its own `hash` field (the content hash). */
export function hashReceiptWithoutHash(receipt: Omit<Receipt, 'hash'>): string {
  return sha256Hex(canonicalJson(receipt))
}

/**
 * Generate a hash-chained receipt for a run.
 * Computes logHash from run.log, then content hash over all fields except `hash`.
 */
export function generateReceipt(
  run: Run,
  outcome: Receipt['outcome'],
  prevHash: string,
  phiSnapshot: Receipt['phiSnapshot'],
): Receipt {
  const logHash = sha256Hex(canonicalJson(run.log))
  const builtAt = run.builtAt ?? Date.now()
  const builder = run.builder ?? { gitSha: 'unknown', crateVersions: {} }
  const cost = run.cost ?? { tokens: {}, usd: 0, budgets: [] }
  const guardDispositions = run.guardDispositions ?? []

  const withoutHash: Omit<Receipt, 'hash'> = {
    runId: run.runId,
    sessionId: run.sessionId,
    agentId: run.agentId,
    prevHash,
    logHash,
    phiSnapshot,
    outcome,
    cost,
    guardDispositions,
    builtAt,
    builder,
  }

  const hash = hashReceiptWithoutHash(withoutHash)
  return { ...withoutHash, hash }
}

/**
 * Verify a chain of receipts: prevHash linkage + content hash integrity.
 * Empty and single-element chains are valid if their own hashes check.
 */
export function verifyChain(receipts: Receipt[]): boolean {
  for (let i = 0; i < receipts.length; i++) {
    const r = receipts[i]!
    // verify content hash
    const { hash, ...withoutHash } = r as Receipt & Record<string, unknown>
    const recomputed = hashReceiptWithoutHash(withoutHash as Omit<Receipt, 'hash'>)
    if (recomputed !== hash) return false
    // verify linkage (skip genesis)
    if (i > 0) {
      const prev = receipts[i - 1]!
      if (r.prevHash !== prev.hash) return false
    }
  }
  return true
}
