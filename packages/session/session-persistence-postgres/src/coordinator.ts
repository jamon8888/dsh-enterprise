import { Context, Service } from 'cordis'
import { z } from 'schemastery'
import type { SessionEvent } from '@deepseek-ai/dsh-session'
import type { PersistenceCoordinator } from '@deepseek-ai/dsh-session-persistence'
import { PostgresPersistenceBackend } from './backend.js'

/**
 * PostgreSQL-specific extension for PersistenceCoordinator
 * This extends (doesn't replace) the base coordinator with PG-specific features
 */
export class PostgresPersistenceCoordinator extends Service {
  static inject = ['sessionPersistence', 'postgresPersistenceBackend']
  
  static Config = z.object({
    /** Enable real-time event streaming to connected clients */
    enableRealtime: z.boolean().default(true),
    /** Batch size for event appends */
    batchSize: z.number().int().positive().default(100),
    /** Flush interval in milliseconds */
    flushInterval: z.number().int().positive().default(1000),
  })

  private coordinator: PersistenceCoordinator
  private backend: PostgresPersistenceBackend
  private config: ReturnType<typeof PostgresPersistenceCoordinator.Config.parse>
  private realtimeSubscriptions: Map<string, Set<(event: SessionEvent) => void>> = new Map()
  private unsubscribeRealtime: (() => void) | null = null

  constructor(
    ctx: Context, 
    config: ReturnType<typeof PostgresPersistenceCoordinator.Config.parse>
  ) {
    super(ctx, 'postgresPersistenceCoordinator')
    this.config = config
    
    // Get the base coordinator and PG backend
    this.coordinator = ctx.sessionPersistence
    this.backend = ctx.postgresPersistenceBackend
  }

  /** Initialize the coordinator extension */
  async initialize(): Promise<void> {
    // Initialize the backend
    await this.backend.initialize()

    // Setup real-time event forwarding if enabled
    if (this.config.enableRealtime) {
      this.setupRealtimeForwarding()
    }

    // Extend coordinator with PG-specific methods
    this.extendCoordinator()
  }

  /** Setup real-time event forwarding from PG NOTIFY to session listeners */
  private setupRealtimeForwarding(): void {
    this.unsubscribeRealtime = this.backend.onEventNotification((notification) => {
      // Convert notification to SessionEvent and emit to session listeners
      const sessionId = notification.session_id
      const handlers = this.realtimeSubscriptions.get(sessionId)
      if (handlers) {
        // Fetch the full event from database
        this.fetchAndEmitEvent(sessionId, notification.seq, handlers)
      }
    })
  }

  /** Fetch event from database and emit to handlers */
  private async fetchAndEmitEvent(
    sessionId: string, 
    seq: number, 
    handlers: Set<(event: SessionEvent) => void>
  ): Promise<void> {
    try {
      const pool = this.backend.getPool()
      const result = await pool.query(
        `SELECT * FROM ${this.backend.config.schema}.session_events WHERE session_id = $1 AND seq = $2`,
        [sessionId, seq]
      )

      if (result.rows.length > 0) {
        const row = result.rows[0]
        const event: SessionEvent = {
          time: row.time,
          type: row.type,
          data: row.data,
          surfaceOp: row.surface_op,
          sourceEventSeqs: row.source_event_seqs,
          ignorable: row.ignorable,
        }

        handlers.forEach(handler => handler(event))
      }
    } catch (error) {
      this.ctx.logger.error('Failed to fetch event for realtime forwarding', error)
    }
  }

  /** Subscribe to real-time events for a session */
  subscribeToRealtime(sessionId: string, handler: (event: SessionEvent) => void): () => void {
    if (!this.realtimeSubscriptions.has(sessionId)) {
      this.realtimeSubscriptions.set(sessionId, new Set())
    }
    this.realtimeSubscriptions.get(sessionId)!.add(handler)
    
    return () => {
      const handlers = this.realtimeSubscriptions.get(sessionId)
      if (handlers) {
        handlers.delete(handler)
        if (handlers.size === 0) {
          this.realtimeSubscriptions.delete(sessionId)
        }
      }
    }
  }

  /** Extend the base coordinator with PG-specific methods */
  private extendCoordinator(): void {
    // Add PG-specific methods to the coordinator
    ;(this.coordinator as any).postgres = {
      backend: this.backend,
      subscribeToRealtime: this.subscribeToRealtime.bind(this),
      listSnapshots: this.backend.listSnapshots.bind(this.backend),
      getPool: this.backend.getPool.bind(this.backend),
    }
  }

  /** Override appendBatch to use PG backend directly */
  async appendBatch(sessionId: string, events: SessionEvent[]): Promise<bigint> {
    const session = this.coordinator.sessions.get(sessionId)
    if (!session) throw new Error(`Session ${sessionId} not found`)

    const result = await this.backend.appendBatch({
      sessionId,
      events,
      expectedRevision: session.revision,
    })

    // Update local session revision
    session.revision = result.revision
    return result.revision
  }

  /** Override commitRepair to use PG backend directly */
  async commitRepair(sessionId: string, events: SessionEvent[]): Promise<bigint> {
    const revision = await this.backend.commitRepair(sessionId, events)
    
    const session = this.coordinator.sessions.get(sessionId)
    if (session) {
      session.revision = revision
    }
    
    return revision
  }

  /** Get real-time event stream for a session */
  async *getRealtimeEvents(sessionId: string): AsyncGenerator<SessionEvent> {
    const queue: SessionEvent[] = []
    let resolved = false
    
    const unsubscribe = this.subscribeToRealtime(sessionId, (event) => {
      queue.push(event)
    })

    try {
      while (true) {
        if (queue.length > 0) {
          yield queue.shift()!
        } else {
          // Wait for next event
          await new Promise<void>(resolve => {
            const checkQueue = () => {
              if (queue.length > 0 || resolved) {
                resolve()
              } else {
                setTimeout(checkQueue, 100)
              }
            }
            checkQueue()
          })
        }
      }
    } finally {
      unsubscribe()
      resolved = true
    }
  }

  /** Dispose of the coordinator extension */
  override dispose(): void {
    if (this.unsubscribeRealtime) {
      this.unsubscribeRealtime()
      this.unsubscribeRealtime = null
    }
    this.realtimeSubscriptions.clear()
    super.dispose()
  }
}

export default PostgresPersistenceCoordinator