import * as Y from 'yjs'
import { WebsocketProvider } from 'y-websocket'
import type {
  SessionId,
  UserId,
  CursorPosition,
  SelectionRange,
  CursorUpdateEvent,
  SessionCollaborationConfig
} from './types.js'

interface AwarenessState {
  user: {
    id: UserId
    name?: string
    color?: string
  }
  cursor?: CursorPosition
  selection?: SelectionRange
}

/**
 * Yjs-based cursor and selection synchronization
 */
export class CursorSyncManager {
  private docs: Map<SessionId, Y.Doc> = new Map()
  private providers: Map<SessionId, WebsocketProvider> = new Map()
  private awarenessStates: Map<SessionId, Map<UserId, AwarenessState>> = new Map()
  private config: SessionCollaborationConfig
  private callbacks: Map<SessionId, Set<(event: CursorUpdateEvent) => void>> = new Map()
  private localUserId: UserId | null = null
  private localSessionId: SessionId | null = null

  constructor(config: SessionCollaborationConfig) {
    this.config = {
      enableYjsWebSocket: true,
      yjsWebSocketPort: 1234,
      yjsPersistenceDir: './.yjs',
      ...config
    }
  }

  /**
   * Initialize cursor sync for a session
   */
  async initializeSession(sessionId: SessionId, userId: UserId): Promise<void> {
    if (this.docs.has(sessionId)) {
      return // Already initialized
    }

    this.localUserId = userId
    this.localSessionId = sessionId

    // Create Yjs document
    const doc = new Y.Doc()
    this.docs.set(sessionId, doc)

    // Create WebSocket provider for real-time sync
    if (this.config.enableYjsWebSocket) {
      const wsUrl = `ws://localhost:${this.config.yjsWebSocketPort}`
      const provider = new WebsocketProvider(wsUrl, `dsh-session-${sessionId}`, doc, {
        connect: true,
        awareness: true
      })
      this.providers.set(sessionId, provider)

      // Set up awareness for cursor/selection
      const awareness = provider.awareness
      
      // Set local user info
      awareness.setLocalStateField('user', {
        id: userId,
        name: `User ${userId.slice(0, 8)}`,
        color: this.generateUserColor(userId)
      })

      // Listen for awareness changes (other users' cursors/selections)
      awareness.on('change', () => {
        this.handleAwarenessChange(sessionId, awareness)
      })

      // Listen for connection status
      provider.on('status', (event: { status: string }) => {
        console.log(`[CursorSync] WebSocket status for ${sessionId}: ${event.status}`)
      })
    }

    // Initialize awareness states map
    this.awarenessStates.set(sessionId, new Map())
  }

  /**
   * Handle awareness changes from other users
   */
  private handleAwarenessChange(sessionId: SessionId, awareness: any): void {
    const states = awareness.getStates()
    const sessionStates = this.awarenessStates.get(sessionId)
    
    if (!sessionStates) return

    for (const [clientId, state] of states) {
      if (clientId === awareness.clientID) continue // Skip local
      
      const userState = state as AwarenessState
      if (userState?.user?.id) {
        const userId = userState.user.id
        
        // Update stored state
        sessionStates.set(userId, userState)
        
        // Notify callbacks
        this.notifyCursorUpdate(sessionId, userId, userState.cursor || null, userState.selection || null)
      }
    }

    // Check for disconnected users
    const currentUserIds = new Set<UserId>()
    for (const state of states.values()) {
      const userState = state as AwarenessState
      if (userState?.user?.id) {
        currentUserIds.add(userState.user.id)
      }
    }

    // Notify about users who left
    for (const [userId, state] of sessionStates) {
      if (!currentUserIds.has(userId) && userId !== this.localUserId) {
        sessionStates.delete(userId)
        this.notifyCursorUpdate(sessionId, userId, null, null)
      }
    }
  }

  /**
   * Update local cursor position
   */
  updateCursor(cursor: CursorPosition | null): void {
    if (!this.localSessionId || !this.localUserId) return
    
    const provider = this.providers.get(this.localSessionId)
    if (provider?.awareness) {
      const states = provider.awareness.getStates()
      const localState = states.get(provider.awareness.clientID) as AwarenessState || { user: { id: this.localUserId } }
      localState.cursor = cursor || undefined
      provider.awareness.setLocalState(localState)
    }
  }

  /**
   * Update local selection range
   */
  updateSelection(selection: SelectionRange | null): void {
    if (!this.localSessionId || !this.localUserId) return
    
    const provider = this.providers.get(this.localSessionId)
    if (provider?.awareness) {
      const states = provider.awareness.getStates()
      const localState = states.get(provider.awareness.clientID) as AwarenessState || { user: { id: this.localUserId } }
      localState.selection = selection || undefined
      provider.awareness.setLocalState(localState)
    }
  }

  /**
   * Update both cursor and selection
   */
  updateCursorAndSelection(cursor: CursorPosition | null, selection: SelectionRange | null): void {
    if (!this.localSessionId || !this.localUserId) return
    
    const provider = this.providers.get(this.localSessionId)
    if (provider?.awareness) {
      const states = provider.awareness.getStates()
      const localState = states.get(provider.awareness.clientID) as AwarenessState || { user: { id: this.localUserId } }
      localState.cursor = cursor || undefined
      localState.selection = selection || undefined
      provider.awareness.setLocalState(localState)
    }
  }

  /**
   * Get remote user's cursor
   */
  getRemoteCursor(sessionId: SessionId, userId: UserId): CursorPosition | null {
    const sessionStates = this.awarenessStates.get(sessionId)
    if (!sessionStates) return null
    
    const state = sessionStates.get(userId)
    return state?.cursor || null
  }

  /**
   * Get remote user's selection
   */
  getRemoteSelection(sessionId: SessionId, userId: UserId): SelectionRange | null {
    const sessionStates = this.awarenessStates.get(sessionId)
    if (!sessionStates) return null
    
    const state = sessionStates.get(userId)
    return state?.selection || null
  }

  /**
   * Get all remote cursors for a session
   */
  getAllRemoteCursors(sessionId: SessionId): Map<UserId, CursorPosition> {
    const sessionStates = this.awarenessStates.get(sessionId)
    const cursors = new Map<UserId, CursorPosition>()
    
    if (!sessionStates) return cursors
    
    for (const [userId, state] of sessionStates) {
      if (userId !== this.localUserId && state.cursor) {
        cursors.set(userId, state.cursor)
      }
    }
    
    return cursors
  }

  /**
   * Get all remote selections for a session
   */
  getAllRemoteSelections(sessionId: SessionId): Map<UserId, SelectionRange> {
    const sessionStates = this.awarenessStates.get(sessionId)
    const selections = new Map<UserId, SelectionRange>()
    
    if (!sessionStates) return selections
    
    for (const [userId, state] of sessionStates) {
      if (userId !== this.localUserId && state.selection) {
        selections.set(userId, state.selection)
      }
    }
    
    return selections
  }

  /**
   * Subscribe to cursor/selection updates
   */
  subscribeToCursorUpdates(
    sessionId: SessionId,
    callback: (event: CursorUpdateEvent) => void
  ): () => void {
    let sessionCallbacks = this.callbacks.get(sessionId)
    if (!sessionCallbacks) {
      sessionCallbacks = new Set()
      this.callbacks.set(sessionId, sessionCallbacks)
    }
    sessionCallbacks.add(callback)

    return () => {
      sessionCallbacks?.delete(callback)
      if (sessionCallbacks?.size === 0) {
        this.callbacks.delete(sessionId)
      }
    }
  }

  /**
   * Notify callbacks of cursor update
   */
  private notifyCursorUpdate(
    sessionId: SessionId,
    userId: UserId,
    cursor: CursorPosition | null,
    selection: SelectionRange | null
  ): void {
    const sessionCallbacks = this.callbacks.get(sessionId)
    if (!sessionCallbacks) return

    const event: CursorUpdateEvent = {
      sessionId,
      userId,
      cursor,
      selection
    }

    for (const callback of sessionCallbacks) {
      try {
        callback(event)
      } catch (err) {
        console.error('[CursorSync] Callback error:', err)
      }
    }
  }

  /**
   * Generate consistent color for user
   */
  private generateUserColor(userId: UserId): string {
    const colors = [
      '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4',
      '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F',
      '#BB8FCE', '#85C1E9', '#F8B500', '#00CED1'
    ]
    
    let hash = 0
    for (let i = 0; i < userId.length; i++) {
      hash = userId.charCodeAt(i) + ((hash << 5) - hash)
    }
    
    return colors[Math.abs(hash) % colors.length]
  }

  /**
   * Disconnect from a session
   */
  async disconnectSession(sessionId: SessionId): Promise<void> {
    const provider = this.providers.get(sessionId)
    if (provider) {
      provider.destroy()
      this.providers.delete(sessionId)
    }

    const doc = this.docs.get(sessionId)
    if (doc) {
      doc.destroy()
      this.docs.delete(sessionId)
    }

    this.awarenessStates.delete(sessionId)
    this.callbacks.delete(sessionId)

    if (this.localSessionId === sessionId) {
      this.localSessionId = null
      this.localUserId = null
    }
  }

  /**
   * Disconnect all sessions
   */
  async disconnectAll(): Promise<void> {
    for (const sessionId of this.docs.keys()) {
      await this.disconnectSession(sessionId)
    }
  }

  /**
   * Get Yjs document for a session (for custom CRDT usage)
   */
  getDoc(sessionId: SessionId): Y.Doc | undefined {
    return this.docs.get(sessionId)
  }

  /**
   * Check if session is connected
   */
  isConnected(sessionId: SessionId): boolean {
    const provider = this.providers.get(sessionId)
    return provider?.wsconnected === true
  }
}

/**
 * Create a CursorSyncManager instance
 */
export function createCursorSyncManager(config: SessionCollaborationConfig): CursorSyncManager {
  return new CursorSyncManager(config)
}
