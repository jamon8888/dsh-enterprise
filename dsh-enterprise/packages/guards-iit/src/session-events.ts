/**
 * Session event emission for IIT guards.
 * @module @deepseek-ai/dsh-enterprise-guards-iit/session-events
 */

import type { GuardId, GuardResult } from './types.js'

declare module '@deepseek-ai/dsh-session' {
  interface SessionEventMap {
    'iit-guard.decision': {
      guardId: GuardId
      disposition: 'pass' | 'block' | 'warn'
      phi?: number
      cesHash?: string
      reason?: string
      violated?: string[]
      timestamp: number
      ignorable?: true
    }
    'policy/evaluate': {
      turn: number
      step: number
      callId: string
      guards: readonly {
        guardId: string
        disposition: 'pass' | 'block' | 'warn'
        phi?: number
        reason?: string
      }[]
      finalDisposition: 'pass' | 'block'
      blockedBy?: string
      timestamp: number
      ignorable?: true
    }
  }
}

export function emitGuardDecision(
  ctx: Record<string, unknown>,
  guardId: GuardId,
  result: GuardResult,
): void {
  const ignorable = result.disposition === 'pass' ? true : undefined
  const payload = {
    guardId,
    disposition: result.disposition,
    timestamp: Date.now(),
    ...(result.phi !== undefined ? { phi: result.phi } : {}),
    ...(result.cesHash !== undefined ? { cesHash: result.cesHash } : {}),
    ...(result.reason !== undefined ? { reason: result.reason } : {}),
    ...(result.violated !== undefined ? { violated: result.violated } : {}),
    ...(ignorable !== undefined ? { ignorable } : {}),
  }
  try {
    ;(ctx.emit as (event: string, payload: unknown) => void)('iit-guard.decision', payload)
  } catch {
    // fail-open: guard decision was already made; emit failure must not override it
  }
}
