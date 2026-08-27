# @deepseek-ai/dsh-session-collaboration

Multi-user session collaboration for DeepSeek Harness (DSH).

## Features

- **Session Join/Handoff**: Users can join sessions, leave, and transfer ownership
- **Real-time Presence**: Track who's online, idle, or offline with Redis-backed ephemeral storage
- **Collaborative Cursors/Selections**: CRDT-based cursor and selection synchronization using Yjs
- **Event-Sourced Integration**: Durable join/leave/handoff events in the session log
- **Permission System**: Role-based access control (read, write, admin, owner)

## Installation

```bash
pnpm add @deepseek-ai/dsh-session-collaboration
```

## Quick Start

```typescript
import { createContext } from 'cordis'
import { sessionCollaborationPlugin } from '@deepseek-ai/dsh-session-collaboration'

const ctx = createContext()
ctx.plugin(sessionCollaborationPlugin, {
  redisUrl: 'redis://localhost:6379',
  postgresConnectionString: 'postgresql://localhost:5432/dsh'
})

// Join a session
await ctx.sessionCollaboration.join('session-id', 'user-id')

// Set presence
await ctx.sessionCollaboration.setPresence('session-id', 'user-id', {
  status: 'online',
  lastSeen: Date.now(),
  cursor: { filePath: 'src/main.ts', line: 42, column: 10 }
})

// Watch presence changes
const unwatch = ctx.sessionCollaboration.watchPresence('session-id', (change) => {
  console.log('Presence changed:', change)
})

// Watch cursor updates
const unwatchCursors = ctx.sessionCollaboration.watchCursors('session-id', (update) => {
  console.log('Cursor update:', update)
})

// Update local cursor
ctx.sessionCollaboration.updateCursor('session-id', { filePath: 'src/main.ts', line: 43, column: 5 })

// Transfer ownership
await ctx.sessionCollaboration.handoff('session-id', 'old-owner-id', 'new-owner-id')

// Leave session
await ctx.sessionCollaboration.leave('session-id', 'user-id')
```

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    SessionCollaborationService              │
├─────────────────────┬───────────────────────┬───────────────┤
│   PostgreSQL        │       Redis           │     Yjs       │
│   (Durable)         │   (Ephemeral)         │   (CRDT)      │
├─────────────────────┼───────────────────────┼───────────────┤
│ • Collaborators     │ • Presence (TTL)      │ • Cursors     │
│ • Permissions       │ • Pub/Sub for         │ • Selections  │
│ • Ownership         │   real-time updates   │ • Awareness   │
│ • Join/Leave events │                       │ • WebSocket   │
└─────────────────────┴───────────────────────┴───────────────┘
```

## Data Models

### CollaboratorInfo
```typescript
interface CollaboratorInfo {
  userId: UserId
  joinedAt: number
  presence: UserPresence
  permissions: Permission[]
}
```

### UserPresence
```typescript
interface UserPresence {
  status: 'online' | 'idle' | 'offline'
  lastSeen: number
  cursor?: CursorPosition
  selection?: SelectionRange
}
```

### CursorPosition
```typescript
interface CursorPosition {
  filePath: string
  line: number
  column: number
}
```

### SelectionRange
```typescript
interface SelectionRange {
  filePath: string
  start: CursorPosition
  end: CursorPosition
}
```

## Session Event Types

The package extends the session event map with:

- `session/collaborator-joined` - User joined session
- `session/collaborator-left` - User left session
- `session/ownership-transferred` - Ownership transferred

## Session Header Extension

Sessions include collaboration metadata:

```typescript
interface SessionCollaborationHeader {
  ownerId: UserId
  collaborators: UserId[]
}
```

## Configuration

```typescript
interface SessionCollaborationConfig {
  redisUrl: string                    // Redis connection URL
  postgresConnectionString: string    // PostgreSQL connection string
  presenceTtl?: number                // Presence TTL in seconds (default: 300)
  yjsPersistenceDir?: string          // Yjs document persistence directory
  enableYjsWebSocket?: boolean        // Enable Yjs WebSocket server (default: true)
  yjsWebSocketPort?: number           // WebSocket port for Yjs (default: 1234)
}
```

## API Reference

### SessionCollaborationService

#### `join(sessionId, userId, permissions?)`
Add a user as a collaborator to the session.

#### `leave(sessionId, userId)`
Remove a user from the session.

#### `handoff(sessionId, fromUserId, toUserId)`
Transfer session ownership to another collaborator.

#### `getCollaborators(sessionId)`
Get all collaborators with their current presence.

#### `setPresence(sessionId, userId, presence)`
Update user's presence (status, cursor, selection).

#### `watchPresence(sessionId, callback)`
Subscribe to real-time presence changes.

#### `watchCursors(sessionId, callback)`
Subscribe to real-time cursor/selection updates.

#### `updateCursor(sessionId, cursor)`
Update local user's cursor position.

#### `updateSelection(sessionId, selection)`
Update local user's selection range.

#### `hasPermission(sessionId, userId, permission)`
Check if user has a specific permission.

#### `getSessionHeader(sessionId)`
Get session collaboration header (owner + collaborators).

## Database Schema

The package creates a `session_collaborators` table:

```sql
CREATE TABLE session_collaborators (
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  permissions TEXT[] NOT NULL DEFAULT ARRAY['read', 'write'],
  is_owner BOOLEAN NOT NULL DEFAULT FALSE,
  PRIMARY KEY (session_id, user_id)
);
```

## Redis Keys

- `dsh:session:presence:{sessionId}:{userId}` - User presence (TTL)
- `dsh:session:presence:channel:{sessionId}` - Pub/Sub channel for presence updates
- `dsh:session:collaborators:{sessionId}` - Set of collaborator user IDs

## Yjs WebSocket Server

Start the Yjs WebSocket server for cursor synchronization:

```bash
npx y-websocket --port 1234
```

Or run it programmatically:

```typescript
import { createServer } from 'http'
import { WebSocketServer } from 'ws'
import { setupWSConnection } from 'y-websocket/bin/utils.js'

const wss = new WebSocketServer({ server })
wss.on('connection', (ws, req) => {
  setupWSConnection(ws, req)
})
```

## License

MIT
