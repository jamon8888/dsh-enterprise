import type { Context, Service } from 'cordis'
import { Pool } from 'pg'
import type {
  SessionId,
  UserId,
  SessionCollaborationConfig,
  CollaboratorInfo,
  UserPresence,
  Permission,
  CollaboratorJoinedEvent,
  CollaboratorLeftEvent,
  OwnershipTransferEvent,
  SessionCollaborationHeader,
  PresenceChangeEvent,
  CursorUpdateEvent
} from './types.js'
import { PresenceManager } from './presence.js'
import { CursorSyncManager } from './cursors.js'

const COLLABORATORS_TABLE = 'session_collaborators'

/**
 * Session Collaboration Service
 * Manages multi-user session collaboration including:
 * - Collaborator management (join/leave/handoff)
 * - Real-time presence (Redis)
 * - Collaborative cursors/selections (Yjs CRDT)
 * - Session log integration
 */
export class SessionCollaborationService implements Service {
  private ctx: Context
  private config: SessionCollaborationConfig
  private presenceManager: PresenceManager
  private cursorManager: CursorSyncManager
  private pgPool: Pool
  private presenceCallbacks: Map<SessionId, Set<(changes: PresenceChangeEvent) => void>> = new Map()
  private cursorCallbacks: Map<SessionId, Set<(event: CursorUpdateEvent) => void>> = new Map()
  private initialized = false

  constructor(ctx: Context, config: SessionCollaborationConfig) {
    this.ctx = ctx
    this.config = config
    this.presenceManager = new PresenceManager(config)
    this.cursorManager = new CursorSyncManager(config)
    this.pgPool = new Pool({ connectionString: config.postgresConnectionString })
  }

  /**
   * Initialize the service
   */
  async initialize(): Promise<void> {
    if (this.initialized) return
    
    // Connect to Redis
    await this.presenceManager.connect()
    
    // Ensure collaborators table exists
    await this.ensureCollaboratorsTable()
    
    // Subscribe to presence changes
    this.presenceManager.getRedisClient().on('message', (channel, message) => {
      if (channel.startsWith('dsh:session:presence:channel:')) {
        try {
          const event: PresenceChangeEvent = JSON.parse(message)
          this.notifyPresenceCallbacks(event)
        } catch {
          // Ignore parse errors
        }
      }
    })
    
    this.initialized = true
  }

  /**
   * Ensure collaborators table exists
   */
  private async ensureCollaboratorsTable(): Promise<void> {
    const client = await this.pgPool.connect()
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS ${COLLABORATORS_TABLE} (
          session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
          user_id TEXT NOT NULL,
          joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          permissions TEXT[] NOT NULL DEFAULT ARRAY['read', 'write'],
          is_owner BOOLEAN NOT NULL DEFAULT FALSE,
          PRIMARY KEY (session_id, user_id)
        );
      `)
      
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_${COLLABORATORS_TABLE}_session 
        ON ${COLLABORATORS_TABLE}(session_id);
      `)
    } finally {
      client.release()
    }
  }

  /**
   * Handle session creation - add creator as owner
   */
  async handleSessionCreated(session: { id: SessionId; ownerId: UserId }): Promise<void> {
    await this.addCollaboratorToDb(session.id, session.ownerId, ['owner'], true)
    
    // Emit session event
    this.ctx.emit('session/collaborator-joined', {
      sessionId: session.id,
      userId: session.ownerId,
      permissions: ['owner'],
      joinedAt: Date.now()
    } as CollaboratorJoinedEvent & { sessionId: SessionId })
  }

  /**
   * Join a session as a collaborator
   */
  async join(sessionId: SessionId, userId: UserId, permissions: Permission[] = ['read', 'write']): Promise<void> {
    await this.initialize()
    
    // Check if already a collaborator
    const existing = await this.getCollaboratorFromDb(sessionId, userId)
    if (existing) {
      // Update permissions if needed
      if (JSON.stringify(existing.permissions.sort()) !== JSON.stringify(permissions.sort())) {
        await this.updateCollaboratorPermissions(sessionId, userId, permissions)
      }
    } else {
      // Add as new collaborator
      await this.addCollaboratorToDb(sessionId, userId, permissions, false)
    }
    
    // Set initial presence
    const presence: UserPresence = {
      status: 'online',
      lastSeen: Date.now()
    }
    await this.presenceManager.setPresence(sessionId, userId, presence)
    
    // Initialize cursor sync for this user
    await this.cursorManager.initializeSession(sessionId, userId)
    
    // Emit session event
    this.ctx.emit('session/collaborator-joined', {
      sessionId,
      userId,
      permissions,
      joinedAt: Date.now()
    } as CollaboratorJoinedEvent & { sessionId: SessionId })
  }

  /**
   * Leave a session
   */
  async leave(sessionId: SessionId, userId: UserId): Promise<void> {
    await this.initialize()
    
    // Remove presence
    await this.presenceManager.removePresence(sessionId, userId)
    
    // Disconnect cursor sync
    await this.cursorManager.disconnectSession(sessionId)
    
    // Remove from database
    await this.removeCollaboratorFromDb(sessionId, userId)
    
    // Emit session event
    this.ctx.emit('session/collaborator-left', {
      sessionId,
      userId,
      leftAt: Date.now()
    } as CollaboratorLeftEvent & { sessionId: SessionId })
  }

  /**
   * Transfer session ownership
   */
  async handoff(sessionId: SessionId, fromUserId: UserId, toUserId: UserId): Promise<void> {
    await this.initialize()
    
    // Verify fromUserId is current owner
    const fromCollaborator = await this.getCollaboratorFromDb(sessionId, fromUserId)
    if (!fromCollaborator || !fromCollaborator.permissions.includes('owner')) {
      throw new Error('Only the session owner can transfer ownership')
    }
    
    // Verify toUserId is a collaborator
    const toCollaborator = await this.getCollaboratorFromDb(sessionId, toUserId)
    if (!toCollaborator) {
      throw new Error('Target user must be a collaborator')
    }
    
    // Update permissions in database
    await this.updateCollaboratorPermissions(sessionId, fromUserId, ['read', 'write', 'admin'])
    await this.updateCollaboratorPermissions(sessionId, toUserId, ['owner'])
    
    // Emit session event
    this.ctx.emit('session/ownership-transferred', {
      sessionId,
      fromUserId,
      toUserId,
      transferredAt: Date.now()
    } as OwnershipTransferEvent & { sessionId: SessionId })
  }

  /**
   * Get all collaborators for a session
   */
  async getCollaborators(sessionId: SessionId): Promise<CollaboratorInfo[]> {
    await this.initialize()
    
    const dbCollaborators = await this.getCollaboratorsFromDb(sessionId)
    const presences = await this.presenceManager.getAllPresences(sessionId)
    
    return dbCollaborators.map(db => ({
      userId: db.user_id,
      joinedAt: new Date(db.joined_at).getTime(),
      presence: presences.get(db.user_id) || { status: 'offline', lastSeen: new Date(db.joined_at).getTime() },
      permissions: db.permissions
    }))
  }

  /**
   * Set user presence
   */
  async setPresence(sessionId: SessionId, userId: UserId, presence: UserPresence): Promise<void> {
    await this.initialize()
    await this.presenceManager.setPresence(sessionId, userId, presence)
  }

  /**
   * Watch presence changes for a session
   */
  watchPresence(sessionId: SessionId, callback: (changes: PresenceChangeEvent) => void): () => void {
    let callbacks = this.presenceCallbacks.get(sessionId)
    if (!callbacks) {
      callbacks = new Set()
      this.presenceCallbacks.set(sessionId, callbacks)
    }
    callbacks.add(callback)
    
    // Subscribe to Redis presence channel
    this.presenceManager.subscribeToPresence(sessionId, (event) => {
      this.notifyPresenceCallbacks(event)
    })
    
    return () => {
      callbacks?.delete(callback)
      if (callbacks?.size === 0) {
        this.presenceCallbacks.delete(sessionId)
      }
    }
  }

  /**
   * Watch cursor/selection updates for a session
   */
  watchCursors(sessionId: SessionId, callback: (event: CursorUpdateEvent) => void): () => void {
    let callbacks = this.cursorCallbacks.get(sessionId)
    if (!callbacks) {
      callbacks = new Set()
      this.cursorCallbacks.set(sessionId, callbacks)
    }
    callbacks.add(callback)
    
    return this.cursorManager.subscribeToCursorUpdates(sessionId, callback)
  }

  /**
   * Update local cursor position
   */
  updateCursor(sessionId: SessionId, cursor: { filePath: string; line: number; column: number } | null): void {
    this.cursorManager.updateCursor(cursor as any)
  }

  /**
   * Update local selection
   */
  updateSelection(sessionId: SessionId, selection: { filePath: string; start: { line: number; column: number }; end: { line: number; column: number } } | null): void {
    this.cursorManager.updateSelection(selection as any)
  }

  /**
   * Get session collaboration header extension
   */
  async getSessionHeader(sessionId: SessionId): Promise<SessionCollaborationHeader> {
    const collaborators = await this.getCollaboratorsFromDb(sessionId)
    const owner = collaborators.find(c => c.permissions.includes('owner'))
    
    return {
      ownerId: owner?.user_id || '',
      collaborators: collaborators.map(c => c.user_id)
    }
  }

  /**
   * Check if user is collaborator
   */
  async isCollaborator(sessionId: SessionId, userId: UserId): Promise<boolean> {
    const collaborator = await this.getCollaboratorFromDb(sessionId, userId)
    return collaborator !== null
  }

  /**
   * Get user permissions in session
   */
  async getPermissions(sessionId: SessionId, userId: UserId): Promise<Permission[]> {
    const collaborator = await this.getCollaboratorFromDb(sessionId, userId)
    return collaborator?.permissions || []
  }

  /**
   * Check if user has permission
   */
  async hasPermission(sessionId: SessionId, userId: UserId, permission: Permission): Promise<boolean> {
    const permissions = await this.getPermissions(sessionId, userId)
    const hierarchy: Permission[] = ['read', 'write', 'admin', 'owner']
    const userLevel = hierarchy.indexOf(permissions.find(p => hierarchy.includes(p)) || 'read')
    const requiredLevel = hierarchy.indexOf(permission)
    return userLevel >= requiredLevel
  }

  // ===== Database operations =====

  private async addCollaboratorToDb(
    sessionId: SessionId,
    userId: UserId,
    permissions: Permission[],
    isOwner: boolean
  ): Promise<void> {
    const client = await this.pgPool.connect()
    try {
      await client.query(
        `INSERT INTO ${COLLABORATORS_TABLE} (session_id, user_id, permissions, is_owner) VALUES ($1, $2, $3, $4) ON CONFLICT (session_id, user_id) DO UPDATE SET permissions = EXCLUDED.permissions, is_owner = EXCLUDED.is_owner`,
        [sessionId, userId, permissions, isOwner]
      )
    } finally {
      client.release()
    }
  }

  private async removeCollaboratorFromDb(sessionId: SessionId, userId: UserId): Promise<void> {
    const client = await this.pgPool.connect()
    try {
      await client.query(
        `DELETE FROM ${COLLABORATORS_TABLE} WHERE session_id = $1 AND user_id = $2`,
        [sessionId, userId]
      )
    } finally {
      client.release()
    }
  }

  private async getCollaboratorFromDb(sessionId: SessionId, userId: UserId): Promise<{ user_id: UserId; joined_at: Date; permissions: Permission[]; is_owner: boolean } | null> {
    const client = await this.pgPool.connect()
    try {
      const result = await client.query(
        `SELECT user_id, joined_at, permissions, is_owner FROM ${COLLABORATORS_TABLE} WHERE session_id = $1 AND user_id = $2`,
        [sessionId, userId]
      )
      if (result.rows.length === 0) return null
      const row = result.rows[0]
      return {
        user_id: row.user_id,
        joined_at: row.joined_at,
        permissions: row.permissions,
        is_owner: row.is_owner
      }
    } finally {
      client.release()
    }
  }

  private async getCollaboratorsFromDb(sessionId: SessionId): Promise<Array<{ user_id: UserId; joined_at: Date; permissions: Permission[]; is_owner: boolean }>> {
    const client = await this.pgPool.connect()
    try {
      const result = await client.query(
        `SELECT user_id, joined_at, permissions, is_owner FROM ${COLLABORATORS_TABLE} WHERE session_id = $1 ORDER BY joined_at ASC`,
        [sessionId]
      )
      return result.rows.map(row => ({
        user_id: row.user_id,
        joined_at: row.joined_at,
        permissions: row.permissions,
        is_owner: row.is_owner
      }))
    } finally {
      client.release()
    }
  }

  private async updateCollaboratorPermissions(sessionId: SessionId, userId: UserId, permissions: Permission[]): Promise<void> {
    const client = await this.pgPool.connect()
    try {
      const isOwner = permissions.includes('owner')
      await client.query(
        `UPDATE ${COLLABORATORS_TABLE} SET permissions = $1, is_owner = $2 WHERE session_id = $3 AND user_id = $4`,
        [permissions, isOwner, sessionId, userId]
      )
    } finally {
      client.release()
    }
  }

  // ===== Callback notification =====

  private notifyPresenceCallbacks(event: PresenceChangeEvent): void {
    const callbacks = this.presenceCallbacks.get(event.sessionId)
    if (!callbacks) return
    
    for (const callback of callbacks) {
      try {
        callback(event)
      } catch (err) {
        console.error('[SessionCollaboration] Presence callback error:', err)
      }
    }
  }

  /**
   * Dispose service resources
   */
  async dispose(): Promise<void> {
    await this.presenceManager.disconnect()
    await this.cursorManager.disconnectAll()
    await this.pgPool.end()
    this.initialized = false
  }
}
