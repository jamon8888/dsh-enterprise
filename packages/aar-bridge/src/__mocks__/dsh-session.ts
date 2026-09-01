export interface SessionEventMap {
  'iit-guard.decision': {
    guardId: string
    disposition: 'pass' | 'block' | 'warn'
    phi?: number
    cesHash?: string
    reason?: string
    timestamp: number
    sessionId?: string
    ignorable?: true
  }
  'aar/score': {
    sessionId: string
    headlinePct: number
    closedPct: Record<string, number>
    passesFilter: boolean
    trajectoryScore: number
    behavioralFlags: string[]
    aarVersion: string
  }
}
