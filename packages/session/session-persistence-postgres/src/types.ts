import type { SessionEvent } from '@deepseek-ai/dsh-session'
import type { Pool, PoolClient, QueryResult } from 'pg'

/** Configuration for the PostgreSQL persistence backend */
export interface PostgresPersistenceConfig {
  /** PostgreSQL connection string */
  connectionString: string
  /** Maximum number of connections in the pool */
  poolSize?: number
  /** Enable real-time event broadcast via LISTEN/NOTIFY */
  enableRealtime?: boolean
  /** Connection timeout in milliseconds */
  connectionTimeout?: number
  /** Idle timeout in milliseconds */
  idleTimeout?: number
  /** Schema name (default: 'public') */
  schema?: string
  /** Run migrations on startup */
  runMigrations?: boolean
}

/** Session record from the database */
export interface SessionRecord {
  id: string
  version: number
  created_at: Date
  cwd: string
  parent_session: string | null
  seed_length: number
  delegation_depth: number
  origin: string
  agent_preset: string | null
  revision: bigint
}

/** Event record from the database */
export interface EventRecord {
  session_id: string
  seq: number
  time: Date
  type: string
  data: Record<string, unknown>
  surface_op: Record<string, unknown> | null
  source_event_seqs: number[] | null
  ignorable: boolean
}

/** Snapshot info for listSnapshots */
export interface SnapshotInfo {
  id: string
  version: number
  created_at: Date
  cwd: string
  parent_session: string | null
  seed_length: number
  delegation_depth: number
  origin: string
  agent_preset: string | null
  revision: bigint
  event_count: number
  last_event_time: Date | null
}

/** Migration record */
export interface MigrationRecord {
  version: number
  name: string
  applied_at: Date
}

/** Extended pool with migration support */
export interface MigrationPool extends Pool {
  /** Run pending migrations */
  migrate(): Promise<void>
  /** Get applied migrations */
  getMigrations(): Promise<MigrationRecord[]>
}

/** Event notification payload */
export interface EventNotification {
  session_id: string
  seq: number
  type: string
  time: string
}

/** Batch append operation */
export interface AppendBatchParams {
  sessionId: string
  events: SessionEvent[]
  expectedRevision: bigint
}

/** Result of appendBatch */
export interface AppendBatchResult {
  revision: bigint
  seq: number
}

/** Load stored session result */
export interface LoadStoredResult {
  session: SessionRecord | null
  events: EventRecord[]
  revision: bigint
}