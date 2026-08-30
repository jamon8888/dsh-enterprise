import { Context, Service } from 'cordis'
import { z } from 'schemastery'
import { PostgresPersistenceBackend } from './backend.js'
import { PostgresPersistenceCoordinator } from './coordinator.js'
import type { PostgresPersistenceConfig } from './types.js'

/**
 * PostgreSQL Session Persistence Plugin
 * 
 * Registers as the sessionPersistence backend provider, replacing JSONL/SQLite backends.
 * Use via profile composition in cordis.patch.yml:
 * 
 * ```yaml
 * - id: session-postgres
 *   name: '@deepseek-ai/dsh-session-persistence-postgres'
 *   config:
 *     connectionString: ${{ env.DSH_PG_URL }}
 *     poolSize: 20
 *     enableRealtime: true
 * ```
 */
export class PostgresSessionPersistence extends Service {
  static inject = []
  
  static Config = z.object({
    connectionString: z.string(),
    poolSize: z.number().int().positive().default(10),
    enableRealtime: z.boolean().default(true),
    connectionTimeout: z.number().int().positive().default(30000),
    idleTimeout: z.number().int().positive().default(30000),
    schema: z.string().default('public'),
    runMigrations: z.boolean().default(true),
    // Coordinator options
    batchSize: z.number().int().positive().default(100),
    flushInterval: z.number().int().positive().default(1000),
  })

  private backend: PostgresPersistenceBackend
  private coordinator: PostgresPersistenceCoordinator

  constructor(
    ctx: Context, 
    config: PostgresPersistenceConfig & {
      batchSize?: number
      flushInterval?: number
    }
  ) {
    super(ctx, 'postgresSessionPersistence')
    
    // Create the backend
    this.backend = new PostgresPersistenceBackend(ctx, {
      connectionString: config.connectionString,
      poolSize: config.poolSize,
      enableRealtime: config.enableRealtime,
      connectionTimeout: config.connectionTimeout,
      idleTimeout: config.idleTimeout,
      schema: config.schema,
      runMigrations: config.runMigrations,
    })

    // Create the coordinator extension
    this.coordinator = new PostgresPersistenceCoordinator(ctx, {
      enableRealtime: config.enableRealtime,
      batchSize: config.batchSize ?? 100,
      flushInterval: config.flushInterval ?? 1000,
    })

    // Initialize both
    ctx.on('ready', async () => {
      await this.backend.initialize()
      await this.coordinator.initialize()
    })

    // Cleanup on dispose
    ctx.on('dispose', async () => {
      await this.coordinator.dispose()
      await this.backend.dispose()
    })
  }
}

export { PostgresPersistenceBackend } from './backend.js'
export { PostgresPersistenceCoordinator } from './coordinator.js'
export type { 
  PostgresPersistenceConfig,
  SessionRecord,
  EventRecord,
  SnapshotInfo,
  MigrationRecord,
  EventNotification,
} from './types.js'

export default PostgresSessionPersistence