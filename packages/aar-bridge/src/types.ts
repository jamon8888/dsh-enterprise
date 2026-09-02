export interface GuardDecision {
  guardId: string
  disposition: 'pass' | 'block' | 'warn'
  phi?: number
  cesHash?: string
  reason?: string
  timestamp: number
}

export interface SessionBuffer {
  sessionId: string
  decisions: GuardDecision[]
  startedAt: number
}

export interface AarScore {
  sessionId: string
  headlinePct: number
  closedPct: Record<string, number>
  passesFilter: boolean
  trajectoryScore: number
  behavioralFlags: string[]
  aarVersion: string
}

export interface AarBridgeConfig {
  aarSidecarUrl: string
  timeoutMs: number
  failOpen: boolean
}

export const DEFAULT_CONFIG: AarBridgeConfig = {
  aarSidecarUrl: 'http://localhost:8787',
  timeoutMs: 5000,
  failOpen: true,
}
