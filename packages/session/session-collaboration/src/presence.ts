import Redis from 'ioredis'
import type {
  SessionId,
  UserId,
  UserPresence,
  RedisPresenceData,
  PresenceChangeEvent,
  SessionCollaborationConfig
} from './types.js'

const PRESENCE_KEY_PREFIX = 'dsh:session:presence:'
const PRESENCE_CHANNEL_PREFIX = 'dsh:session:presence:channel:'
const COLLABORATORS_SET_PREFIX = 'dsh:session:collaborators:'

/**
 * Redis-based presence manager for ephemeral real-time presence
 */
export class PresenceManager {
  private redis: Redis
  private config: SessionCollaborationConfig
  private subscribers: Map<SessionId, Set<(event: PresenceChangeEvent) => void>> = new Map()
  private isSubscribed: Map<SessionId, boolean> = new Map()

  constructor(config: SessionCollaborationConfig) {
    this.config = {
      presenceTtl: 300,
      ...config
    }
    this.redis = new Redis(config.redisUrl, {
      maxRetriesPerRequest: 3,
      retryStrategy: (times) => Math.min(times * 100, 3000),
      lazyConnect: true
    })
  }

  /**
   * Connect to Redis
   */
  async connect(): Promise<void> {
    await this.redis.connect()
  }

  /**
   * Disconnect from Redis
   */
  async disconnect(): Promise<void> {
    // Unsubscribe from all channels
    for (const sessionId of this.isSubscribed.keys()) {
      await this.unsubscribeFromPresenceChannel(sessionId)
    }
    await this.redis.quit()
  }

  /**
   * Get Redis key for user presence
   */
  private getPresenceKey(sessionId: SessionId, userId: UserId): string {
    return `${PRESENCE_KEY_PREFIX}${sessionId}:${userId}`
  }

  /**
   * Get Redis channel for presence updates
   */
  private getPresenceChannel(sessionId: SessionId): string {
    return `${PRESENCE_CHANNEL_PREFIX}${sessionId}`
  }

  /**
   * Get Redis key for collaborators set
   */
  private getCollaboratorsKey(sessionId: SessionId): string {
    return `${COLLABORATORS_SET_PREFIX}${sessionId}`
  }

  /**
   * Set user presence with TTL
   */
  async setPresence(
    sessionId: SessionId,
    userId: UserId,
    presence: UserPresence
  ): Promise<void> {
    const key = this.getPresenceKey(sessionId, userId)
    const data: RedisPresenceData = { userId, sessionId, presence }
    
    // Store with TTL
    await this.redis.setex(key, this.config.presenceTtl!, JSON.stringify(data))
    
    // Add to collaborators set
    await this.redis.sadd(this.getCollaboratorsKey(sessionId), userId)
    
    // Publish presence change
    await this.publishPresenceChange(sessionId, userId, presence)
  }

  /**
   * Get user presence
   */
  async getPresence(sessionId: SessionId, userId: UserId): Promise<UserPresence | null> {
    const key = this.getPresenceKey(sessionId, userId)
    const data = await this.redis.get(key)
    
    if (!data) return null
    
    try {
      const parsed: RedisPresenceData = JSON.parse(data)
      return parsed.presence
    } catch {
      return null
    }
  }

  /**
   * Get all presences for a session
   */
  async getAllPresences(sessionId: SessionId): Promise<Map<UserId, UserPresence>> {
    const collaboratorsKey = this.getCollaboratorsKey(sessionId)
    const userIds = await this.redis.smembers(collaboratorsKey)
    
    const presences = new Map<UserId, UserPresence>()
    
    if (userIds.length === 0) return presences
    
    const pipeline = this.redis.pipeline()
    for (const userId of userIds) {
      pipeline.get(this.getPresenceKey(sessionId, userId))
    }
    
    const results = await pipeline.exec()
    
    if (results) {
      for (let i = 0; i < userIds.length; i++) {
        const userId = userIds[i]
        const [err, data] = results[i]
        
        if (!err && data) {
          try {
            const parsed: RedisPresenceData = JSON.parse(data as string)
            presences.set(userId, parsed.presence)
          } catch {
            // Skip invalid data
          }
        }
      }
    }
    
    return presences
  }

  /**
   * Remove user presence (on leave)
   */
  async removePresence(sessionId: SessionId, userId: UserId): Promise<void> {
    const key = this.getPresenceKey(sessionId, userId)
    await this.redis.del(key)
    await this.redis.srem(this.getCollaboratorsKey(sessionId), userId)
    
    // Publish offline status
    await this.publishPresenceChange(sessionId, userId, {
      status: 'offline',
      lastSeen: Date.now()
    })
  }

  /**
   * Update user presence (refresh TTL)
   */
  async refreshPresence(sessionId: SessionId, userId: UserId): Promise<void> {
    const key = this.getPresenceKey(sessionId, userId)
    const data = await this.redis.get(key)
    
    if (data) {
      await this.redis.expire(key, this.config.presenceTtl!)
    }
  }

  /**
   * Publish presence change to Redis channel
   */
  private async publishPresenceChange(
    sessionId: SessionId,
    userId: UserId,
    presence: UserPresence,
    previousPresence?: UserPresence
  ): Promise<void> {
    const channel = this.getPresenceChannel(sessionId)
    const event: PresenceChangeEvent = {
      sessionId,
      userId,
      presence,
      previousPresence
    }
    await this.redis.publish(channel, JSON.stringify(event))
  }

  /**
   * Subscribe to presence changes for a session
   */
  async subscribeToPresence(
    sessionId: SessionId,
    callback: (event: PresenceChangeEvent) => void
  ): Promise<() => void> {
    // Add local subscriber
    let subscribers = this.subscribers.get(sessionId)
    if (!subscribers) {
      subscribers = new Set()
      this.subscribers.set(sessionId, subscribers)
    }
    subscribers.add(callback)

    // Subscribe to Redis channel if not already
    if (!this.isSubscribed.get(sessionId)) {
      const channel = this.getPresenceChannel(sessionId)
      await this.redis.subscribe(channel)
      this.isSubscribed.set(sessionId, true)

      // Set up message handler
      this.redis.on('message', (receivedChannel, message) => {
        if (receivedChannel === channel) {
          try {
            const event: PresenceChangeEvent = JSON.parse(message)
            const sessionSubscribers = this.subscribers.get(sessionId)
            if (sessionSubscribers) {
              for (const cb of sessionSubscribers) {
                cb(event)
              }
            }
          } catch {
            // Ignore parse errors
          }
        }
      })
    }

    // Return unsubscribe function
    return () => {
      const sessionSubscribers = this.subscribers.get(sessionId)
      if (sessionSubscribers) {
        sessionSubscribers.delete(callback)
        if (sessionSubscribers.size === 0) {
          this.subscribers.delete(sessionId)
          this.unsubscribeFromPresenceChannel(sessionId)
        }
      }
    }
  }

  /**
   * Unsubscribe from presence channel
   */
  private async unsubscribeFromPresenceChannel(sessionId: SessionId): Promise<void> {
    if (this.isSubscribed.get(sessionId)) {
      const channel = this.getPresenceChannel(sessionId)
      await this.redis.unsubscribe(channel)
      this.isSubscribed.set(sessionId, false)
    }
  }

  /**
   * Get online collaborators count
   */
  async getOnlineCount(sessionId: SessionId): Promise<number> {
    const presences = await this.getAllPresences(sessionId)
    let count = 0
    for (const presence of presences.values()) {
      if (presence.status !== 'offline') count++
    }
    return count
  }

  /**
   * Check if user is online in session
   */
  async isUserOnline(sessionId: SessionId, userId: UserId): Promise<boolean> {
    const presence = await this.getPresence(sessionId, userId)
    return presence?.status !== 'offline'
  }

  /**
   * Get Redis client for advanced usage
   */
  getRedisClient(): Redis {
    return this.redis
  }
}

/**
 * Create a PresenceManager instance
 */
export function createPresenceManager(config: SessionCollaborationConfig): PresenceManager {
  return new PresenceManager(config)
}
