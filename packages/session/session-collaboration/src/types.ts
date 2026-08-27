import type { SessionId, UserId } from '@deepseek-ai/dsh-session'

/**
 * Permission levels for session collaborators
 */
export type Permission =
  | 'read'        // Can view session
  | 'write'       // Can edit files, run commands
  | 'admin'       // Can manage collaborators, transfer ownership
  | 'owner'       // Full control including session deletion

/**
 * Cursor position in a file
 */
export interface CursorPosition {
  /** File path relative to session cwd */
  filePath: string
  /** 1-based line number */
  line: number
  /** 1-based column number */
  column: number
}

/**
 * Selection range in a file
 */
export interface SelectionRange {
  /** File path relative to session cwd */
  filePath: string
  /** Start position (inclusive) */
  start: CursorPosition
  /** End position (exclusive) */
  end: CursorPosition
}

/**
 * User presence information
 */
export interface UserPresence {
  /** Current online status */
  status: 'online' | 'idle' | 'offline'
  /** Unix timestamp of last activity */
  lastSeen: number
  /** Current cursor position (if any) */
  cursor?: CursorPosition
  /** Current selection range (if any) */
  selection?: SelectionRange
}

/**
 * Collaborator information stored in PostgreSQL
 */
export interface CollaboratorInfo {
  /** User ID */
  userId: UserId
  /** Unix timestamp when user joined */
  joinedAt: number
  /** Current presence state */
  presence: UserPresence
  /** Granted permissions */
  permissions: Permission[]
}

/**
 * Session ownership transfer event data
 */
export interface OwnershipTransferEvent {
  fromUserId: UserId
  toUserId: UserId
  transferredAt: number
}

/**
 * Collaborator joined event data
 */
export interface CollaboratorJoinedEvent {
  userId: UserId
  permissions: Permission[]
  joinedAt: number
}

/**
 * Collaborator left event data
 */
export interface CollaboratorLeftEvent {
  userId: UserId
  leftAt: number
}

/**
 * Session header extension for collaboration
 */
export interface SessionCollaborationHeader {
  /** Session owner user ID */
  ownerId: UserId
  /** List of collaborator user IDs */
  collaborators: UserId[]
}

/**
 * Redis presence key format
 */
export interface RedisPresenceData {
  userId: UserId
  sessionId: SessionId
  presence: UserPresence
}

/**
 * Configuration for SessionCollaborationService
 */
export interface SessionCollaborationConfig {
  /** Redis connection URL */
  redisUrl: string
  /** PostgreSQL connection string (for durable collaborator storage) */
  postgresConnectionString: string
  /** Presence TTL in seconds (default: 300) */
  presenceTtl?: number
  /** Yjs document persistence directory */
  yjsPersistenceDir?: string
  /** Enable Yjs WebSocket server for cursor sync */
  enableYjsWebSocket?: boolean
  /** WebSocket port for Yjs (default: 1234) */
  yjsWebSocketPort?: number
}

/**
 * Event types for session collaboration (declaration merging on SessionEventMap)
 */
export interface SessionCollaborationEventMap {
  'session/collaborator-joined': CollaboratorJoinedEvent
  'session/collaborator-left': CollaboratorLeftEvent
  'session/ownership-transferred': OwnershipTransferEvent
}

/**
 * Presence change event for real-time updates
 */
export interface PresenceChangeEvent {
  sessionId: SessionId
  userId: UserId
  presence: UserPresence
  previousPresence?: UserPresence
}

/**
 * Cursor update event for Yjs sync
 */
export interface CursorUpdateEvent {
  sessionId: SessionId
  userId: UserId
  cursor: CursorPosition | null
  selection: SelectionRange | null
}
