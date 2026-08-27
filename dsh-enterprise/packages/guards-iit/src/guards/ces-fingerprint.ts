/**
 * ces-fingerprint guard — blocks when CES hash mismatches deployment fingerprint.
 * P0: `cesHash` is `phi` string or `JSON.stringify(mip)` hash; real `ruvector::ces`
 * will replace this stub (ruvector_consciousness::ces Concepts → hash).
 * @module @deepseek-ai/dsh-enterprise-guards-iit/guards/ces-fingerprint
 */

import z from '@deepseek-ai/schemastery'
import { GuardError } from '../guard-runner.js'
import { canonicalJson, sha256Hex } from '@deepseek-ai/dsh-enterprise-utils'

export const cesFingerprintGuard = {
  id: 'ces-fingerprint' as const,
  Config: z.object({ expectedHash: z.string() }),
  async run(
    ctx: unknown,
    cfg: { expectedHash: string },
    event: { tpm: unknown; state: number },
  ): Promise<{ disposition: 'pass' | 'block'; cesHash?: string }> {
    let cesHash: string | undefined
    try {
      const iitGuards = (ctx as { get?: (k: string) => { calculatePhi?: (tpm: unknown, state: number) => Promise<{ phi?: number; cesHash?: string; mip?: unknown }> } }).get?.('iitGuards')
      if (iitGuards?.calculatePhi) {
        const r = await iitGuards.calculatePhi(event.tpm, event.state)
        cesHash = (r as { cesHash?: string }).cesHash
        if (!cesHash && typeof (r as { phi?: number }).phi === 'number') cesHash = String((r as { phi?: number }).phi)
        if (!cesHash && (r as { mip?: unknown }).mip !== undefined) cesHash = JSON.stringify((r as { mip?: unknown }).mip)
      }
    } catch {
      // fall through to callCesHash
    }
    if (!cesHash) cesHash = await callCesHash(event)
    if (cesHash !== cfg.expectedHash) throw new GuardError(`ces mismatch: ${cesHash} !== ${cfg.expectedHash}`)
    return { disposition: 'pass', cesHash }
  },
}

/**
 * Fallback CES hash when `ctx.get('iitGuards')` unavailable.
 * Tries WASM `calculate_phi_js` → `phi`/`mip` hash, else deterministic SHA-256 hash.
 * P0 stub: real ruvector::ces will replace this.
 */
async function callCesHash(event: { tpm: unknown; state: number }): Promise<string> {
  try {
    const mod = await import('@deepseek-ai/dsh-enterprise-iit-core/pkg') as {
      calculate_phi_js?: (tpmJson: string, state: number, budget: string) => unknown
    }
    if (mod.calculate_phi_js) {
      const res = mod.calculate_phi_js(JSON.stringify(event.tpm), event.state, 'exact') as {
        cesHash?: string
        phi?: number
        mip?: unknown
      }
      if (res?.cesHash) return String(res.cesHash)
      if (typeof res?.phi === 'number') return String(res.phi)
      if (res?.mip !== undefined) return JSON.stringify(res.mip)
    }
  } catch {
    // wasm not built or import failed — use SHA-256 fallback
  }
  // Use canonical JSON + SHA-256 for cryptographic fallback
  return sha256Hex(canonicalJson({ tpm: event.tpm, state: event.state }))
}
