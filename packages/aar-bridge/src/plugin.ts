/**
 * AAR Bridge Cordis plugin — subscribes to iit-guard.decision events,
 * scores sessions via Python AAR sidecar, emits behavioral signals to watchtower.
 * @module @deepseek-ai/dsh-enterprise-aar-bridge/plugin
 */

import type { Context } from '@deepseek-ai/cordis'
import type { AarBridgeConfig, GuardDecision, SessionBuffer, AarScore } from './types.js'
import { DEFAULT_CONFIG } from './types.js'

export const name = 'dsh-enterprise:aar-bridge'
export const inject = ['sessions', 'audit'] as const

declare module '@deepseek-ai/dsh-session' {
  interface SessionEventMap {
    'aar/score': AarScore
  }
}

const sessions = new Map<string, SessionBuffer>()

function upsertBuffer(sessionId: string): SessionBuffer {
  const existing = sessions.get(sessionId)
  if (existing) return existing
  const buf: SessionBuffer = { sessionId, decisions: [], startedAt: Date.now() }
  sessions.set(sessionId, buf)
  return buf
}

async function callSidecar(
  cfg: AarBridgeConfig,
  sessionId: string,
  decisions: GuardDecision[],
): Promise<AarScore> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), cfg.timeoutMs)
  try {
    const res = await fetch(`${cfg.aarSidecarUrl}/score`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, decisions }),
      signal: controller.signal,
    })
    clearTimeout(timer)
    if (!res.ok) throw new Error(`AAR sidecar ${res.status}: ${await res.text()}`)
    return (await res.json()) as AarScore
  } catch (err) {
    clearTimeout(timer)
    if (cfg.failOpen) {
      return {
        sessionId,
        headlinePct: 0,
        closedPct: {},
        passesFilter: true,
        trajectoryScore: 0,
        behavioralFlags: [],
        aarVersion: 'unavailable',
      }
    }
    throw err
  }
}

export function apply(ctx: Context, cfg: AarBridgeConfig): void {
  const config: AarBridgeConfig = { ...DEFAULT_CONFIG, ...cfg }

  ctx.effect('aarBridge', () => ({
    scoreSession: async (sessionId: string): Promise<AarScore | null> => {
      const buf = sessions.get(sessionId)
      if (!buf) return null
      const score = await callSidecar(config, sessionId, buf.decisions)
      sessions.delete(sessionId)
      ;(ctx.emit as (event: string, payload: unknown) => void)('aar/score', score)
      return score
    },
    scoreSessionSync: (sessionId: string): AarScore | null => {
      const buf = sessions.get(sessionId)
      if (!buf) return null
      const score = computeSyncScore(sessionId, buf.decisions)
      sessions.delete(sessionId)
      ;(ctx.emit as (event: string, payload: unknown) => void)('aar/score', score)
      return score
    },
    bufferSize: () => sessions.size,
  }))

  ctx.on('iit-guard.decision' as any, (ev: GuardDecision & { sessionId?: string }) => {
    const sessionId = (ev as any).sessionId ?? 'default'
    const buf = upsertBuffer(sessionId)
    buf.decisions.push({
      guardId: ev.guardId,
      disposition: ev.disposition,
      phi: ev.phi,
      cesHash: ev.cesHash,
      reason: ev.reason,
      timestamp: ev.timestamp,
    })
  })
}

function computeSyncScore(sessionId: string, decisions: GuardDecision[]): AarScore {
  if (decisions.length === 0) {
    return {
      sessionId,
      headlinePct: 100,
      closedPct: {},
      passesFilter: true,
      trajectoryScore: 1.0,
      behavioralFlags: [],
      aarVersion: 'sync-v1',
    }
  }
  const blocks = decisions.filter((d) => d.disposition === 'block')
  const warns = decisions.filter((d) => d.disposition === 'warn')
  const passRate = (decisions.length - blocks.length - warns.length) / decisions.length
  const blockRate = blocks.length / decisions.length
  const behavioralFlags: string[] = []
  if (blockRate > 0.3) behavioralFlags.push('high_block_rate')
  if (warns.length > decisions.length * 0.5) behavioralFlags.push('excessive_warnings')
  const phiVals = decisions.filter((d) => d.phi !== undefined).map((d) => d.phi as number)
  const phiUnstable = phiVals.length >= 3 && (Math.max(...phiVals) - Math.min(...phiVals)) > 0.5
  if (phiUnstable) behavioralFlags.push('phi_instability')
  return {
    sessionId,
    headlinePct: Math.round(passRate * 100),
    closedPct: {
      block_rate: Math.round(blockRate * 100),
      warn_rate: Math.round((warns.length / decisions.length) * 100),
    },
    passesFilter: blockRate < 0.5,
    trajectoryScore: passRate,
    behavioralFlags,
    aarVersion: 'sync-v1',
  }
}
