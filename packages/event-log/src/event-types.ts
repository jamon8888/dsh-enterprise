export type EventType =
  | 'session.start'
  | 'session.end'
  | 'message.text'
  | 'message.tool_call'
  | 'message.tool_result'
  | 'message.thinking'
  | 'tool.call'
  | 'tool.result'
  | 'guard.decision'
  | 'guard.throw'
  | 'permission.ask'
  | 'permission.grant'
  | 'permission.deny'

export interface EventEnvelope {
  eventId: string
  sessionId: string
  turnId: string
  invocationId: string
  ts: number
  eventType: EventType
  payload: unknown
}

export interface GuardDecisionPayload {
  guardId: string
  disposition: 'pass' | 'warn' | 'block'
  phi?: number
  cesHash?: string
  reason?: string
  violated?: string[]
  ignorable?: true
}

export interface PermissionPayload {
  tool: string
  args: Record<string, unknown>
  principal?: string
  resource?: string
}

export interface ToolCallPayload {
  tool: string
  args: Record<string, unknown>
  callId: string
}

export interface ToolResultPayload {
  callId: string
  result: unknown
  error?: string
}

export interface Turn {
  turnId: string
  invocations: Invocation[]
}

export interface Invocation {
  invocationId: string
  events: EventEnvelope[]
}

export interface SessionView {
  sessionId: string
  startTs: number
  endTs?: number
  turns: Turn[]
}
