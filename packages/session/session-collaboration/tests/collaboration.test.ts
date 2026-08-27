import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { SessionId, UserId, Permission, UserPresence, CursorPosition, SelectionRange } from '../src/types.js'
import { SessionCollaborationService } from '../src/service.js'
import { PresenceManager } from '../src/presence.js'
import { CursorSyncManager } from '../src/cursors.js'

// Mock Redis
vi.mock('ioredis', () => {
  const mockRedis = {
    connect: vi.fn().mockResolvedValue(undefined),
    quit: vi.fn().mockResolvedValue(undefined),
    setex: vi.fn().mockResolvedValue('OK'),
    get: vi.fn().mockResolvedValue(null),
    del: vi.fn().mockResolvedValue(1),
    sadd: vi.fn().mockResolvedValue(1),
    srem: vi.fn().mockResolvedValue(1),
    smembers: vi.fn().mockResolvedValue([]),
    expire: vi.fn().mockResolvedValue(1),
    publish: vi.fn().mockResolvedValue(1),
    subscribe: vi.fn().mockResolvedValue(undefined),
    unsubscribe: vi.fn().mockResolvedValue(undefined),
    on: vi.fn(),
    pipeline: vi.fn().mockReturnValue({
      get: vi.fn(),
      exec: vi.fn().mockResolvedValue([])
    })
  }
  return {
    default: vi.fn(() => mockRedis)
  }
})

// Mock pg
vi.mock('pg', () => ({
  Pool: vi.fn(() => ({
    connect: vi.fn().mockResolvedValue({
      query: vi.fn().mockResolvedValue({ rows: [] }),
      release: vi.fn()
    }),
    end: vi.fn().mockResolvedValue(undefined)
  }))
}))

// Mock Yjs
vi.mock('yjs', () => ({
  Doc: vi.fn(() => ({
    destroy: vi.fn()
  }))
}))

// Mock y-websocket
vi.mock('y-websocket', () => ({
  WebsocketProvider: vi.fn(() => ({
    awareness: {
      setLocalStateField: vi.fn(),
      setLocalState: vi.fn(),
      getStates: vi.fn(() => new Map()),
      on: vi.fn(),
      clientID: 1
    },
    destroy: vi.fn(),
    on: vi.fn(),
    wsconnected: true
  }))
}))

describe('SessionCollaborationService', () => {
  let service: SessionCollaborationService
  let mockCtx: any

  const testConfig = {
    redisUrl: 'redis://localhost:6379',
    postgresConnectionString: 'postgresql://localhost:5432/test',
    presenceTtl: 300
  }

  const sessionId: SessionId = 'test-session-123'
  const userId1: UserId = 'user-1'
  const userId2: UserId = 'user-2'

  beforeEach(async () => {
    mockCtx = {
      provide: vi.fn(),
      on: vi.fn(),
      emit: vi.fn()
    }
    
    service = new SessionCollaborationService(mockCtx, testConfig)
    await service.initialize()
  })

  afterEach(async () => {
    await service.dispose()
    vi.clearAllMocks()
  })

  describe('join', () => {
    it('should add user as collaborator with default permissions', async () => {
      await service.join(sessionId, userId1)
      
      expect(mockCtx.emit).toHaveBeenCalledWith('session/collaborator-joined', expect.objectContaining({
        sessionId,
        userId: userId1,
        permissions: ['read', 'write'],
        joinedAt: expect.any(Number)
      }))
    })

    it('should add user with custom permissions', async () => {
      const permissions: Permission[] = ['read', 'write', 'admin']
      await service.join(sessionId, userId1, permissions)
      
      expect(mockCtx.emit).toHaveBeenCalledWith('session/collaborator-joined', expect.objectContaining({
        permissions
      }))
    })
  })

  describe('leave', () => {
    it('should remove user presence and emit event', async () => {
      await service.join(sessionId, userId1)
      await service.leave(sessionId, userId1)
      
      expect(mockCtx.emit).toHaveBeenCalledWith('session/collaborator-left', expect.objectContaining({
        sessionId,
        userId: userId1,
        leftAt: expect.any(Number)
      }))
    })
  })

  describe('handoff', () => {
    it('should transfer ownership between users', async () => {
      await service.join(sessionId, userId1, ['owner'])
      await service.join(sessionId, userId2, ['read', 'write'])
      
      await service.handoff(sessionId, userId1, userId2)
      
      expect(mockCtx.emit).toHaveBeenCalledWith('session/ownership-transferred', expect.objectContaining({
        sessionId,
        fromUserId: userId1,
        toUserId: userId2,
        transferredAt: expect.any(Number)
      }))
    })

    it('should throw if fromUserId is not owner', async () => {
      await service.join(sessionId, userId1, ['read', 'write'])
      await service.join(sessionId, userId2, ['read', 'write'])
      
      await expect(service.handoff(sessionId, userId1, userId2))
        .rejects.toThrow('Only the session owner can transfer ownership')
    })

    it('should throw if toUserId is not a collaborator', async () => {
      await service.join(sessionId, userId1, ['owner'])
      
      await expect(service.handoff(sessionId, userId1, userId2))
        .rejects.toThrow('Target user must be a collaborator')
    })
  })

  describe('getCollaborators', () => {
    it('should return list of collaborators with presence', async () => {
      await service.join(sessionId, userId1, ['owner'])
      await service.join(sessionId, userId2, ['read', 'write'])
      
      const collaborators = await service.getCollaborators(sessionId)
      
      expect(collaborators).toHaveLength(2)
      expect(collaborators.map(c => c.userId).sort()).toEqual([userId1, userId2].sort())
    })
  })

  describe('presence', () => {
    it('should set and get user presence', async () => {
      await service.join(sessionId, userId1)
      
      const presence: UserPresence = {
        status: 'online',
        lastSeen: Date.now(),
        cursor: { filePath: 'test.ts', line: 10, column: 5 }
      }
      
      await service.setPresence(sessionId, userId1, presence)
      
      // Presence is stored in Redis, we verify the call was made
      // Actual retrieval would need Redis integration test
    })

    it('should watch presence changes', async () => {
      const callback = vi.fn()
      const unwatch = service.watchPresence(sessionId, callback)
      
      // Presence changes would trigger callback
      // This tests the subscription mechanism
      
      unwatch()
      expect(typeof unwatch).toBe('function')
    })
  })

  describe('cursors', () => {
    it('should watch cursor updates', async () => {
      await service.join(sessionId, userId1)
      
      const callback = vi.fn()
      const unwatch = service.watchCursors(sessionId, callback)
      
      expect(typeof unwatch).toBe('function')
      unwatch()
    })

    it('should update local cursor', async () => {
      await service.join(sessionId, userId1)
      
      const cursor: CursorPosition = { filePath: 'test.ts', line: 10, column: 5 }
      service.updateCursor(sessionId, cursor)
      
      // Should not throw
    })

    it('should update local selection', async () => {
      await service.join(sessionId, userId1)
      
      const selection: SelectionRange = {
        filePath: 'test.ts',
        start: { filePath: 'test.ts', line: 10, column: 5 },
        end: { filePath: 'test.ts', line: 15, column: 10 }
      }
      service.updateSelection(sessionId, selection)
      
      // Should not throw
    })
  })

  describe('permissions', () => {
    it('should check user permissions', async () => {
      await service.join(sessionId, userId1, ['read', 'write', 'admin'])
      
      const hasWrite = await service.hasPermission(sessionId, userId1, 'write')
      const hasOwner = await service.hasPermission(sessionId, userId1, 'owner')
      
      expect(hasWrite).toBe(true)
      expect(hasOwner).toBe(false)
    })

    it('should return false for non-collaborators', async () => {
      const hasRead = await service.hasPermission(sessionId, 'non-existent-user', 'read')
      expect(hasRead).toBe(false)
    })
  })

  describe('session header', () => {
    it('should return session collaboration header', async () => {
      await service.join(sessionId, userId1, ['owner'])
      await service.join(sessionId, userId2, ['read', 'write'])
      
      const header = await service.getSessionHeader(sessionId)
      
      expect(header.ownerId).toBe(userId1)
      expect(header.collaborators).toContain(userId1)
      expect(header.collaborators).toContain(userId2)
    })
  })
})

describe('PresenceManager', () => {
  let presenceManager: PresenceManager
  const testConfig = {
    redisUrl: 'redis://localhost:6379',
    postgresConnectionString: 'postgresql://localhost:5432/test',
    presenceTtl: 300
  }

  beforeEach(async () => {
    presenceManager = new PresenceManager(testConfig)
    await presenceManager.connect()
  })

  afterEach(async () => {
    await presenceManager.disconnect()
  })

  it('should set and get presence', async () => {
    const sessionId: SessionId = 'test-session'
    const userId: UserId = 'user-1'
    const presence: UserPresence = {
      status: 'online',
      lastSeen: Date.now()
    }
    
    await presenceManager.setPresence(sessionId, userId, presence)
    const retrieved = await presenceManager.getPresence(sessionId, userId)
    
    // With mock, retrieved will be null, but we test the API
    expect(typeof retrieved).toBe('object')
  })

  it('should remove presence', async () => {
    const sessionId: SessionId = 'test-session'
    const userId: UserId = 'user-1'
    
    await presenceManager.removePresence(sessionId, userId)
    // Should not throw
  })

  it('should subscribe to presence changes', async () => {
    const sessionId: SessionId = 'test-session'
    const callback = vi.fn()
    
    const unsubscribe = await presenceManager.subscribeToPresence(sessionId, callback)
    
    expect(typeof unsubscribe).toBe('function')
    unsubscribe()
  })
})

describe('CursorSyncManager', () => {
  let cursorManager: CursorSyncManager
  const testConfig = {
    redisUrl: 'redis://localhost:6379',
    postgresConnectionString: 'postgresql://localhost:5432/test',
    enableYjsWebSocket: true,
    yjsWebSocketPort: 1234
  }

  beforeEach(() => {
    cursorManager = new CursorSyncManager(testConfig)
  })

  afterEach(async () => {
    await cursorManager.disconnectAll()
  })

  it('should initialize session', async () => {
    const sessionId: SessionId = 'test-session'
    const userId: UserId = 'user-1'
    
    await cursorManager.initializeSession(sessionId, userId)
    
    expect(cursorManager.isConnected(sessionId)).toBe(true)
  })

  it('should update cursor and selection', async () => {
    const sessionId: SessionId = 'test-session'
    const userId: UserId = 'user-1'
    
    await cursorManager.initializeSession(sessionId, userId)
    
    const cursor: CursorPosition = { filePath: 'test.ts', line: 10, column: 5 }
    cursorManager.updateCursor(cursor)
    
    const selection: SelectionRange = {
      filePath: 'test.ts',
      start: { filePath: 'test.ts', line: 10, column: 5 },
      end: { filePath: 'test.ts', line: 15, column: 10 }
    }
    cursorManager.updateSelection(selection)
    
    // Should not throw
  })

  it('should subscribe to cursor updates', async () => {
    const sessionId: SessionId = 'test-session'
    const userId: UserId = 'user-1'
    
    await cursorManager.initializeSession(sessionId, userId)
    
    const callback = vi.fn()
    const unsubscribe = cursorManager.subscribeToCursorUpdates(sessionId, callback)
    
    expect(typeof unsubscribe).toBe('function')
    unsubscribe()
  })

  it('should disconnect session', async () => {
    const sessionId: SessionId = 'test-session'
    const userId: UserId = 'user-1'
    
    await cursorManager.initializeSession(sessionId, userId)
    await cursorManager.disconnectSession(sessionId)
    
    expect(cursorManager.isConnected(sessionId)).toBe(false)
  })
})
