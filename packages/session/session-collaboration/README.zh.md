# @deepseek-ai/dsh-session-collaboration

DeepSeek Harness (DSH) 的多用户会话协作功能。

## 功能特性

- **会话加入/移交**: 用户可以加入会话、离开会话、移交所有权
- **实时在线状态**: 基于 Redis 的临时存储，追踪用户在线、空闲、离线状态
- **协作光标/选择**: 基于 Yjs CRDT 的光标和选择区域同步
- **事件溯源集成**: 会话日志中持久化记录加入/离开/移交事件
- **权限系统**: 基于角色的访问控制 (read, write, admin, owner)

## 安装

```bash
pnpm add @deepseek-ai/dsh-session-collaboration
```

## 快速开始

```typescript
import { createContext } from 'cordis'
import { sessionCollaborationPlugin } from '@deepseek-ai/dsh-session-collaboration'

const ctx = createContext()
ctx.plugin(sessionCollaborationPlugin, {
  redisUrl: 'redis://localhost:6379',
  postgresConnectionString: 'postgresql://localhost:5432/dsh'
})

// 加入会话
await ctx.sessionCollaboration.join('session-id', 'user-id')

// 设置在线状态
await ctx.sessionCollaboration.setPresence('session-id', 'user-id', {
  status: 'online',
  lastSeen: Date.now(),
  cursor: { filePath: 'src/main.ts', line: 42, column: 10 }
})

// 监听在线状态变化
const unwatch = ctx.sessionCollaboration.watchPresence('session-id', (change) => {
  console.log('在线状态变更:', change)
})

// 监听光标更新
const unwatchCursors = ctx.sessionCollaboration.watchCursors('session-id', (update) => {
  console.log('光标更新:', update)
})

// 更新本地光标
ctx.sessionCollaboration.updateCursor('session-id', { filePath: 'src/main.ts', line: 43, column: 5 })

// 移交所有权
await ctx.sessionCollaboration.handoff('session-id', 'old-owner-id', 'new-owner-id')

// 离开会话
await ctx.sessionCollaboration.leave('session-id', 'user-id')
```

## 架构设计

```
┌─────────────────────────────────────────────────────────────┐
│                    SessionCollaborationService              │
├─────────────────────┬───────────────────────┬───────────────┤
│   PostgreSQL        │       Redis           │     Yjs       │
│   (持久化)          │   (临时/短期)         │   (CRDT)      │
├─────────────────────┼───────────────────────┼───────────────┤
│ • 协作者列表        │ • 在线状态 (TTL)      │ • 光标位置    │
│ • 权限配置          │ • Pub/Sub 实时广播    │ • 选择区域    │
│ • 所有权管理        │                       │ • 感知状态    │
│ • 加入/离开事件     │                       │ • WebSocket   │
└─────────────────────┴───────────────────────┴───────────────┘
```

## 数据模型

### CollaboratorInfo (协作者信息)
```typescript
interface CollaboratorInfo {
  userId: UserId
  joinedAt: number
  presence: UserPresence
  permissions: Permission[]
}
```

### UserPresence (用户在线状态)
```typescript
interface UserPresence {
  status: 'online' | 'idle' | 'offline'
  lastSeen: number
  cursor?: CursorPosition
  selection?: SelectionRange
}
```

### CursorPosition (光标位置)
```typescript
interface CursorPosition {
  filePath: string
  line: number
  column: number
}
```

### SelectionRange (选择区域)
```typescript
interface SelectionRange {
  filePath: string
  start: CursorPosition
  end: CursorPosition
}
```

## 会话事件类型

本包扩展了会话事件映射表：

- `session/collaborator-joined` - 用户加入会话
- `session/collaborator-left` - 用户离开会话
- `session/ownership-transferred` - 所有权移交

## 会话头部扩展

会话包含协作元数据：

```typescript
interface SessionCollaborationHeader {
  ownerId: UserId
  collaborators: UserId[]
}
```

## 配置选项

```typescript
interface SessionCollaborationConfig {
  redisUrl: string                    // Redis 连接地址
  postgresConnectionString: string    // PostgreSQL 连接字符串
  presenceTtl?: number                // 在线状态 TTL 秒数 (默认: 300)
  yjsPersistenceDir?: string          // Yjs 文档持久化目录
  enableYjsWebSocket?: boolean        // 启用 Yjs WebSocket 服务器 (默认: true)
  yjsWebSocketPort?: number           // Yjs WebSocket 端口 (默认: 1234)
}
```

## API 参考

### SessionCollaborationService

#### `join(sessionId, userId, permissions?)`
将用户作为协作者添加到会话。

#### `leave(sessionId, userId)`
从会话中移除用户。

#### `handoff(sessionId, fromUserId, toUserId)`
将会话所有权移交给另一个协作者。

#### `getCollaborators(sessionId)`
获取所有协作者及其当前在线状态。

#### `setPresence(sessionId, userId, presence)`
更新用户的在线状态 (状态、光标、选择区域)。

#### `watchPresence(sessionId, callback)`
订阅实时在线状态变更。

#### `watchCursors(sessionId, callback)`
订阅实时光标/选择区域更新。

#### `updateCursor(sessionId, cursor)`
更新本地用户的光标位置。

#### `updateSelection(sessionId, selection)`
更新本地用户的选择区域。

#### `hasPermission(sessionId, userId, permission)`
检查用户是否拥有特定权限。

#### `getSessionHeader(sessionId)`
获取会话协作头部信息 (所有者 + 协作者列表)。

## 数据库表结构

本包创建 `session_collaborators` 表：

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

## Redis 键结构

- `dsh:session:presence:{sessionId}:{userId}` - 用户在线状态 (带 TTL)
- `dsh:session:presence:channel:{sessionId}` - 在线状态变更的 Pub/Sub 频道
- `dsh:session:collaborators:{sessionId}` - 协作者用户 ID 集合

## Yjs WebSocket 服务器

启动 Yjs WebSocket 服务器以同步光标：

```bash
npx y-websocket --port 1234
```

或以编程方式运行：

```typescript
import { createServer } from 'http'
import { WebSocketServer } from 'ws'
import { setupWSConnection } from 'y-websocket/bin/utils.js'

const wss = new WebSocketServer({ server })
wss.on('connection', (ws, req) => {
  setupWSConnection(ws, req)
})
```

## 许可证

MIT
