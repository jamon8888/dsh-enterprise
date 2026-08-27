import { Context, Service } from 'cordis'
import { z } from 'schemastery'
import pg, { Pool, PoolClient, QueryResult } from 'pg'
import { copyFrom } from 'pg-copy-streams'
import type { SessionEvent } from '@deepseek-ai/dsh-session'
import type {
  PostgresPersistenceConfig,
  SessionRecord,
  EventRecord,
  SnapshotInfo,
  MigrationRecord,
  MigrationPool,
  EventNotification,
  AppendBatchParams,
  AppendBatchResult,
  LoadStoredResult,
} from './types.js'

const { Pool: PgPool } = pg

export class PostgresPersistenceBackend extends Service {
  static inject = ['sessionPersistence']
  
  static Config = z.object({
    connectionString: z.string(),
    poolSize: z.number().int().positive().default(10),
    enableRealtime: z.boolean().default(true),
    connectionTimeout: z.number().int().positive().default(30000),
    idleTimeout: z.number().int().positive().default(30000),
    schema: z.string().default('public'),
    runMigrations: z.boolean().default(true),
  })

  private pool: MigrationPool
  private config: PostgresPersistenceConfig
  private notifyClient: PoolClient | null = null
  private notificationHandlers: Set<(notification: EventNotification) => void> = new Set()
  private isMigrated = false

  constructor(ctx: Context, config: PostgresPersistenceConfig) {
    super(ctx, 'postgresPersistenceBackend')
    this.config = config

    this.pool = new PgPool({
      connectionString: config.connectionString,
      max: config.poolSize,
      connectionTimeoutMillis: config.connectionTimeout,
      idleTimeoutMillis: config.idleTimeout,
    }) as MigrationPool

    // Add migration methods to pool
    this.pool.migrate = this.runMigrations.bind(this)
    this.pool.getMigrations = this.getAppliedMigrations.bind(this)

    // Register as the persistence backend provider
    ctx.provide('sessionPersistenceBackend', this)

    // Setup graceful shutdown
    ctx.on('dispose', () => this.dispose())
  }

  /** Initialize the backend and run migrations */
  async initialize(): Promise<void> {
    if (this.config.runMigrations) {
      await this.runMigrations()
    }
    this.isMigrated = true

    // Setup LISTEN/NOTIFY if enabled
    if (this.config.enableRealtime) {
      await this.setupRealtime()
    }
  }

  /** Run database migrations */
  private async runMigrations(): Promise<void> {
    const client = await this.pool.connect()
    try {
      await client.query('BEGIN')

      // Create migration tracking table if not exists
      await client.query(`
        CREATE TABLE IF NOT EXISTS ${this.config.schema}.schema_migrations (
          version INTEGER PRIMARY KEY,
          name TEXT NOT NULL,
          applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `)

      // Get applied migrations
      const applied = await client.query<MigrationRecord>(
        `SELECT version, name, applied_at FROM ${this.config.schema}.schema_migrations ORDER BY version`
      )
      const appliedVersions = new Set(applied.rows.map(r => r.version))

      // Run pending migrations
      const migrations = [
        { version: 1, name: 'initial', sql: this.getInitialMigrationSQL() },
      ]

      for (const migration of migrations) {
        if (!appliedVersions.has(migration.version)) {
          await client.query(migration.sql)
          await client.query(
            `INSERT INTO ${this.config.schema}.schema_migrations (version, name) VALUES ($1, $2)`,
            [migration.version, migration.name]
          )
        }
      }

      await client.query('COMMIT')
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  }

  /** Get the initial migration SQL */
  private getInitialMigrationSQL(): string {
    return `
      CREATE TABLE IF NOT EXISTS ${this.config.schema}.sessions (
        id UUID PRIMARY KEY,
        version INTEGER NOT NULL DEFAULT 1,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        cwd TEXT NOT NULL,
        parent_session UUID REFERENCES ${this.config.schema}.sessions(id),
        seed_length INTEGER NOT NULL DEFAULT 0,
        delegation_depth INTEGER NOT NULL DEFAULT 0,
        origin TEXT NOT NULL DEFAULT 'user',
        agent_preset TEXT,
        revision BIGINT NOT NULL DEFAULT 0
      );

      CREATE INDEX IF NOT EXISTS idx_sessions_revision ON ${this.config.schema}.sessions(revision DESC);
      CREATE INDEX IF NOT EXISTS idx_sessions_created_at ON ${this.config.schema}.sessions(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_sessions_parent ON ${this.config.schema}.sessions(parent_session);

      CREATE TABLE IF NOT EXISTS ${this.config.schema}.session_events (
        session_id UUID NOT NULL REFERENCES ${this.config.schema}.sessions(id) ON DELETE CASCADE,
        seq BIGINT NOT NULL,
        time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        type TEXT NOT NULL,
        data JSONB NOT NULL DEFAULT '{}',
        surface_op JSONB,
        source_event_seqs BIGINT[],
        ignorable BOOLEAN NOT NULL DEFAULT FALSE,
        PRIMARY KEY (session_id, seq)
      );

      CREATE INDEX IF NOT EXISTS idx_session_events_session_time ON ${this.config.schema}.session_events(session_id, time);
      CREATE INDEX IF NOT EXISTS idx_session_events_type ON ${this.config.schema}.session_events(session_id, type);

      CREATE OR REPLACE FUNCTION ${this.config.schema}.notify_session_event()
      RETURNS TRIGGER AS $$
      BEGIN
        PERFORM pg_notify(
          'session_events',
          json_build_object(
            'session_id', NEW.session_id,
            'seq', NEW.seq,
            'type', NEW.type,
            'time', NEW.time
          )::text
        );
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;

      DROP TRIGGER IF EXISTS trigger_notify_session_event ON ${this.config.schema}.session_events;
      CREATE TRIGGER trigger_notify_session_event
        AFTER INSERT ON ${this.config.schema}.session_events
        FOR EACH ROW
        EXECUTE FUNCTION ${this.config.schema}.notify_session_event();
    `
  }

  /** Get applied migrations */
  private async getAppliedMigrations(): Promise<MigrationRecord[]> {
    const result = await this.pool.query<MigrationRecord>(
      `SELECT version, name, applied_at FROM ${this.config.schema}.schema_migrations ORDER BY version`
    )
    return result.rows
  }

  /** Setup LISTEN/NOTIFY for real-time event broadcast */
  private async setupRealtime(): Promise<void> {
    this.notifyClient = await this.pool.connect()
    await this.notifyClient.query('LISTEN session_events')
    
    this.notifyClient.on('notification', (msg: { channel: string; payload: string }) => {
      if (msg.channel === 'session_events') {
        try {
          const notification = JSON.parse(msg.payload) as EventNotification
          this.notificationHandlers.forEach(handler => handler(notification))
        } catch (error) {
          this.ctx.logger.warn('Failed to parse session event notification', error)
        }
      }
    })

    this.notifyClient.on('error', (error) => {
      this.ctx.logger.error('Realtime notification client error', error)
    })
  }

  /** Subscribe to real-time event notifications */
  onEventNotification(handler: (notification: EventNotification) => void): () => void {
    this.notificationHandlers.add(handler)
    return () => this.notificationHandlers.delete(handler)
  }

  /** Load stored session and events */
  async loadStored(sessionId: string): Promise<LoadStoredResult> {
    const client = await this.pool.connect()
    try {
      const sessionResult = await client.query<SessionRecord>(
        `SELECT * FROM ${this.config.schema}.sessions WHERE id = $1`,
        [sessionId]
      )

      if (sessionResult.rows.length === 0) {
        return { session: null, events: [], revision: 0n }
      }

      const session = sessionResult.rows[0]
      const eventsResult = await client.query<EventRecord>(
        `SELECT * FROM ${this.config.schema}.session_events WHERE session_id = $1 ORDER BY seq`,
        [sessionId]
      )

      return {
        session,
        events: eventsResult.rows,
        revision: session.revision,
      }
    } finally {
      client.release()
    }
  }

  /** Append a batch of events with optimistic locking */
  async appendBatch(params: AppendBatchParams): Promise<AppendBatchResult> {
    const { sessionId, events, expectedRevision } = params
    const client = await this.pool.connect()
    
    try {
      await client.query('BEGIN')

      // Check current revision for optimistic locking
      const sessionResult = await client.query<{ revision: bigint }>(
        `SELECT revision FROM ${this.config.schema}.sessions WHERE id = $1 FOR UPDATE`,
        [sessionId]
      )

      if (sessionResult.rows.length === 0) {
        throw new Error(`Session ${sessionId} not found`)
      }

      const currentRevision = sessionResult.rows[0].revision
      if (currentRevision !== expectedRevision) {
        throw new Error(
          `Revision mismatch: expected ${expectedRevision}, got ${currentRevision}`
        )
      }

      // Get next sequence number
      const seqResult = await client.query<{ max_seq: number }>(
        `SELECT COALESCE(MAX(seq), 0) as max_seq FROM ${this.config.schema}.session_events WHERE session_id = $1`,
        [sessionId]
      )
      let nextSeq = seqResult.rows[0].max_seq + 1

      // Insert events
      for (const event of events) {
        await client.query(
          `INSERT INTO ${this.config.schema}.session_events 
            (session_id, seq, time, type, data, surface_op, source_event_seqs, ignorable)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            sessionId,
            nextSeq++,
            event.time,
            event.type,
            JSON.stringify(event.data),
            event.surfaceOp ? JSON.stringify(event.surfaceOp) : null,
            event.sourceEventSeqs ?? null,
            event.ignorable ?? false,
          ]
        )
      }

      // Update session revision (using xmin for MVCC-based revision)
      const newRevisionResult = await client.query<{ xmin: bigint }>(
        `UPDATE ${this.config.schema}.sessions 
         SET revision = xmin::bigint 
         WHERE id = $1 
         RETURNING xmin::bigint as xmin`,
        [sessionId]
      )

      await client.query('COMMIT')

      return {
        revision: newRevisionResult.rows[0].xmin,
        seq: nextSeq - 1,
      }
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  }

  /** Commit a repair operation (used by PersistenceCoordinator) */
  async commitRepair(sessionId: string, events: SessionEvent[]): Promise<bigint> {
    const client = await this.pool.connect()
    try {
      await client.query('BEGIN')

      // Get next sequence number
      const seqResult = await client.query<{ max_seq: number }>(
        `SELECT COALESCE(MAX(seq), 0) as max_seq FROM ${this.config.schema}.session_events WHERE session_id = $1`,
        [sessionId]
      )
      let nextSeq = seqResult.rows[0].max_seq + 1

      // Insert repair events
      for (const event of events) {
        await client.query(
          `INSERT INTO ${this.config.schema}.session_events 
            (session_id, seq, time, type, data, surface_op, source_event_seqs, ignorable)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            sessionId,
            nextSeq++,
            event.time,
            event.type,
            JSON.stringify(event.data),
            event.surfaceOp ? JSON.stringify(event.surfaceOp) : null,
            event.sourceEventSeqs ?? null,
            event.ignorable ?? false,
          ]
        )
      }

      // Update session revision
      const newRevisionResult = await client.query<{ xmin: bigint }>(
        `UPDATE ${this.config.schema}.sessions 
         SET revision = xmin::bigint 
         WHERE id = $1 
         RETURNING xmin::bigint as xmin`,
        [sessionId]
      )

      await client.query('COMMIT')
      return newRevisionResult.rows[0].xmin
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  }

  /** List all sessions with optional filter */
  async list(filter?: { 
    parentSession?: string 
    origin?: string 
    limit?: number 
    offset?: number 
  }): Promise<SessionRecord[]> {
    const client = await this.pool.connect()
    try {
      let query = `SELECT * FROM ${this.config.schema}.sessions`
      const params: unknown[] = []
      const conditions: string[] = []

      if (filter?.parentSession) {
        conditions.push(`parent_session = $${params.length + 1}`)
        params.push(filter.parentSession)
      }

      if (filter?.origin) {
        conditions.push(`origin = $${params.length + 1}`)
        params.push(filter.origin)
      }

      if (conditions.length > 0) {
        query += ' WHERE ' + conditions.join(' AND ')
      }

      query += ' ORDER BY created_at DESC'

      if (filter?.limit) {
        query += ` LIMIT $${params.length + 1}`
        params.push(filter.limit)
      }

      if (filter?.offset) {
        query += ` OFFSET $${params.length + 1}`
        params.push(filter.offset)
      }

      const result = await client.query<SessionRecord>(query, params)
      return result.rows
    } finally {
      client.release()
    }
  }

  /** List snapshots with revision info for crash recovery */
  async listSnapshots(): Promise<SnapshotInfo[]> {
    const client = await this.pool.connect()
    try {
      const result = await client.query<SnapshotInfo>(`
        SELECT 
          s.*,
          COALESCE(e.event_count, 0) as event_count,
          e.last_event_time
        FROM ${this.config.schema}.sessions s
        LEFT JOIN (
          SELECT 
            session_id,
            COUNT(*) as event_count,
            MAX(time) as last_event_time
          FROM ${this.config.schema}.session_events
          GROUP BY session_id
        ) e ON s.id = e.session_id
        ORDER BY s.revision DESC
      `)
      return result.rows
    } finally {
      client.release()
    }
  }

  /** Create a new session record */
  async createSession(session: Omit<SessionRecord, 'revision'> & { id: string }): Promise<SessionRecord> {
    const client = await this.pool.connect()
    try {
      await client.query('BEGIN')

      const result = await client.query<SessionRecord>(`
        INSERT INTO ${this.config.schema}.sessions 
        (id, version, created_at, cwd, parent_session, seed_length, delegation_depth, origin, agent_preset)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *
      `, [
        session.id,
        session.version,
        session.created_at,
        session.cwd,
        session.parent_session,
        session.seed_length,
        session.delegation_depth,
        session.origin,
        session.agent_preset,
      ])

      await client.query('COMMIT')
      return result.rows[0]
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  }

  /** Delete a session and all its events */
  async deleteSession(sessionId: string): Promise<void> {
    const client = await this.pool.connect()
    try {
      await client.query('BEGIN')
      await client.query(`DELETE FROM ${this.config.schema}.sessions WHERE id = $1`, [sessionId])
      await client.query('COMMIT')
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  }

  /** Get event count for a session */
  async getEventCount(sessionId: string): Promise<number> {
    const client = await this.pool.connect()
    try {
      const result = await client.query<{ count: string }>(
        `SELECT COUNT(*) as count FROM ${this.config.schema}.session_events WHERE session_id = $1`,
        [sessionId]
      )
      return parseInt(result.rows[0].count, 10)
    } finally {
      client.release()
    }
  }

  /** Get the underlying pool for advanced operations */
  getPool(): MigrationPool {
    return this.pool
  }

  /** Dispose of the backend */
  async dispose(): Promise<void> {
    if (this.notifyClient) {
      try {
        await this.notifyClient.query('UNLISTEN session_events')
        this.notifyClient.release()
      } catch {
        // Ignore errors during disposal
      }
      this.notifyClient = null
    }
    await this.pool.end()
  }
}