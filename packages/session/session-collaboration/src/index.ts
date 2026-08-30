import type { Context, Plugin, Service } from 'cordis'
import type { Schema } from 'schemastery'
import { SessionCollaborationService } from './service.js'
import type { SessionCollaborationConfig } from './types.js'

// Extend Context with sessionCollaboration service
declare module 'cordis' {
  interface Context {
    sessionCollaboration: SessionCollaborationService
  }
}

/**
 * Session Collaboration Plugin
 * Provides multi-user session collaboration features:
 * - Join/leave/handoff
 * - Real-time presence
 * - Collaborative cursors/selections (CRDT-based)
 */
export function sessionCollaborationPlugin(config: SessionCollaborationConfig): Plugin {
  return (ctx: Context) => {
    // Create service instance
    const service = new SessionCollaborationService(ctx, config)
    
    // Register service
    ctx.provide('sessionCollaboration', service)
    
    // Hook into session creation to add creator as owner
    ctx.on('session/created', async (session) => {
      await service.handleSessionCreated(session)
    })
    
    // Cleanup on shutdown
    ctx.on('dispose', async () => {
      await service.dispose()
    })
  }
}

/**
 * Configuration schema for session collaboration
 */
export const SessionCollaborationConfigSchema: Schema<SessionCollaborationConfig> = {
  type: 'object',
  properties: {
    redisUrl: { type: 'string', description: 'Redis connection URL' },
    postgresConnectionString: { type: 'string', description: 'PostgreSQL connection string for durable collaborator storage' },
    presenceTtl: { type: 'number', default: 300, description: 'Presence TTL in seconds' },
    yjsPersistenceDir: { type: 'string', default: './.yjs', description: 'Yjs document persistence directory' },
    enableYjsWebSocket: { type: 'boolean', default: true, description: 'Enable Yjs WebSocket server for cursor sync' },
    yjsWebSocketPort: { type: 'number', default: 1234, description: 'WebSocket port for Yjs' }
  },
  required: ['redisUrl', 'postgresConnectionString']
}

export { SessionCollaborationService } from './service.js'
export { PresenceManager, createPresenceManager } from './presence.js'
export { CursorSyncManager, createCursorSyncManager } from './cursors.js'
export type {
  SessionCollaborationConfig,
  CollaboratorInfo,
  UserPresence,
  CursorPosition,
  SelectionRange,
  Permission,
  SessionCollaborationEventMap,
  CollaboratorJoinedEvent,
  CollaboratorLeftEvent,
  OwnershipTransferEvent,
  PresenceChangeEvent,
  CursorUpdateEvent,
  SessionCollaborationHeader
} from './types.js