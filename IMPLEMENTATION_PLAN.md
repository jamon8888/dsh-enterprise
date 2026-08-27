# DSH Team Distributed Coding Environment - Implementation Plan

## Overview
Transform DeepSeek Harness (DSH) from a single-user agent harness into a team-distributed coding environment with multi-user sessions, distributed execution, hierarchical agent teams, and real-time collaboration.

## Phase 1: Multi-User Foundation (Weeks 1-6)

### 1.1 PostgreSQL Session Persistence Backend
**Package:** `packages/session/session-persistence-postgres/`

**Deliverables:**
- `PersistenceBackend` implementation using `pg` (node-postgres)
- Schema: sessions, events, snapshots, revisions tables
- Integration with `PersistenceCoordinator` (extend, don't replace)
- Migration system (versioned SQL files)
- `listSnapshots()` using PostgreSQL `xmin` or logical decoding for revision
- Real-time `session/event` broadcast via PostgreSQL `LISTEN/NOTIFY`

### 1.2 Authentication & Identity Capability Seam
**Package Group:** `packages/identity/`

#### 1.2.1 Auth Service Definition (`packages/identity/auth/`)
- `AuthService` (abstract): `validateToken`, `getUser`, `getPermissions`, `createSessionToken`
- Types: `UserId`, `OrgId`, `SessionToken`, `Permission`, `Role`
- `Principal` type combining user + roles + permissions

#### 1.2.2 OAuth Providers (`packages/identity/oauth/`)
- GitHub OAuth (primary), GitLab, OIDC, SAML
- Token exchange, user info fetch, org membership sync
- PKCE support, secure cookie/session handling

#### 1.2.3 Multi-User Session Binding (`packages/identity/session/`)
- Extend `SessionHeader`: `ownerId`, `collaborators: UserId[]`, `permissions`
- `ctx.sessions.join(sessionId, userId)` - add collaborator
- `ctx.sessions.handoff(sessionId, fromUserId, toUserId)` - transfer ownership
- Permission checks on `create`, `resume`, `fork`, `join`

#### 1.2.4 RBAC (`packages/identity/rbac/`)
- Roles: `org:admin`, `org:member`, `workspace:owner`, `workspace:editor`, `workspace:viewer`
- Permissions: `session:create`, `session:join`, `session:delete`, `agent:spawn`, `tool:execute`, `sandbox:admin`
- Policy engine: `checkPermission(principal, resource, action)`

### 1.3 Session Collaboration & Presence
**Package:** `packages/session/session-collaboration/`

- `SessionCollaborationService` (ctx.sessionCollaboration):
  - `join(sessionId: SessionId, userId: UserId): Promise<void>`
  - `leave(sessionId: SessionId, userId: UserId): Promise<void>`
  - `handoff(sessionId: SessionId, fromUserId: UserId, toUserId: UserId): Promise<void>`
  - `getCollaborators(sessionId: SessionId): Promise<CollaboratorInfo[]>`
  - `setPresence(sessionId: SessionId, userId: UserId, presence: UserPresence): Promise<void>`
  - `watchPresence(sessionId: SessionId, callback: (changes) => void): () => void`

- Storage:
  - Collaborators in PostgreSQL (session_collaborators table)
  - Presence in Redis (ephemeral, TTL-based)
  - Cursors/selections: Yjs/Automerge documents (separate from session log)

### 1.4 Web GUI Authentication Integration
- Login page (OAuth flow)
- Session ownership UI (avatar badges, collaborator list)
- Join session flow (invite link, session code)
- Permission-aware UI (hide unauthorized actions)

---

## Phase 2: Distributed Execution & Workspace (Weeks 5-12)

### 2.1 Git Worktree Filesystem Provider
**Package:** `packages/workspace/git-worktree/`

#### 2.1.1 Service Provider (`fs-git-worktree/`)
- Implements `FileSystem` interface over Git worktrees
- `createWorktree(sessionId, branch?)` → isolated checkout per session
- `mergeWorktree(sourceSessionId, targetSessionId)` → PR-style merge
- `syncWorktrees()` → fetch + rebase/merge across worktrees
- Path mapping: `/workspace/<sessionId>/...` → worktree root

#### 2.1.2 Policy (`worktree-policy/`)
- Isolation: each session sees only its worktree
- Auto-cleanup on session dispose (configurable TTL)
- Merge strategies: `rebase`, `merge`, `squash`
- Conflict detection and reporting

### 2.2 Kubernetes Sandbox Provider
**Package:** `packages/sandbox/kubernetes/`

- `PodSandbox` implementing `Sandbox` interface
- Pod template with resource limits, security context
- Volume mounts: workspace PVC, cache, tmp
- Network policies: egress control, pod-to-pod isolation
- `exec` via Kubernetes `exec` API (supports PTY)
- Log streaming, resource monitoring

### 2.3 Sandbox Pooling
**Package:** `packages/sandbox/pool/`

- Warm pool of pre-created sandboxes (pods/VMs)
- `acquire()` / `release()` lifecycle
- Health checks, auto-replacement
- Configurable pool size, scaling policies

### 2.4 Cloud VM Sandbox (AWS/GCP/Azure)
**Package:** `packages/sandbox/cloud-vm/`

- Instance pool with SSM/SSH access
- Fast startup via pre-warmed instances
- Spot instance support with fallback
- Integration with cloud IAM for credentials

---

## Phase 3: Hierarchical & Distributed Agent Teams (Weeks 8-16)

### 3.1 Evolve Experimental Agent Teams to Distributed
**Package Group:** `packages/team/`

#### 3.1.1 Hierarchical Teams (`hierarchical/`)
- Nested `TeamMembership`: Lead → Manager → Worker
- Recursive `spawnTeammate` (managers can spawn workers)
- Hierarchical task DAG (sub-tasks, rollup status)
- `listMembers` returns tree; `listTasks` supports subtree filtering
- Delegation depth limits per level (configurable)

#### 3.1.2 Distributed Coordination (`distributed/`)
- **Message Bus**: Redis Streams for mailbox (`team/message/queued`, `delivered`)
- **Lease Protocol**: Redis-based Lead election (single-leader per team)
- **Task Sync**: CRDT or OT for task board (`TeamTaskSnapshot` versioned)
- **Presence**: Heartbeat + liveness (Redis keys with TTL)
- **Recovery**: Replay from PostgreSQL session log on process restart

#### 3.1.3 Team Federation (`federation/`)
- Cross-team message routing
- Shared task dependencies across teams
- Team registry (discovery, capabilities)

### 3.2 Team-Aware Workflow Engine
**Package:** `packages/workflow/workflow-team/`

- `TeamWorkflowEngine` extending `WorkflowEngine`
- `agent()` calls can specify `teamRole` or `teamMember`
- Automatic task distribution to team members
- Result aggregation with `parallel()`/`pipeline()`

---

## Phase 4: Real-Time Collaboration UX (Weeks 12-20)

### 4.1 WebSocket Transport
**Packages:** `packages/host/websocket/`, `packages/client/connection/ws/`

- `ws` server on same port as HTTP (upgrade)
- Token auth on upgrade (JWT from `AuthService`)
- Session-scoped rooms (one room per `SessionId`)
- Frame types: `session/event`, `presence`, `cursor`, `chat`, `notification`
- Automatic reconnection, backoff, message deduplication

### 4.2 Collaborative Editing
**Package:** `packages/client/ui-collab-edit/`

- CodeMirror 6 + `y-codemirror.next` + `y-websocket`/`y-webrtc`
- Awareness: cursors, selections, user colors
- Sync with session log: Yjs doc ↔ session surface events
- Conflict-free concurrent editing

### 4.3 Team Communication UI
**Packages:** `packages/client/ui-team-chat/`, `packages/client/ui-team-dashboard/`

- Team chat: channels, threads, mentions, reactions
- Task board: Kanban view of `TeamTaskBoard`
- Agent status: running/idle/inactive per team member
- Notifications: in-app + push (web push API)

---

## Phase 5: Enterprise & Platform (Weeks 16-28)

### 5.1 Organization & Policy Management
**Package Group:** `packages/admin/`

- `org/`: Org, team, user CRUD; invitation flow
- `policy/`: Org-wide policies (model allowlist, tool allowlist, sandbox defaults, quotas)
- `audit/`: Immutable audit log (PostgreSQL + optional S3 archive)
- `quotas/`: Token, compute, storage quotas with alerts
- `billing/`: Usage tracking, cost allocation, invoice generation

### 5.2 Integrations
**Package Group:** `packages/integration/`

- `github/`: GitHub App, PR checks, issue sync, webhook handling
- `gitlab/`: GitLab integration
- `slack/`: Notifications, slash commands, interactive messages
- `jira/`: Issue tracking sync
- `linear/`: Linear integration

---

## Technical Standards (DSH Conventions)

### Package Structure
```
packages/<group>/<pkg>/
├── package.json          # @deepseek-ai/dsh-<pkg>, private: true
├── tsconfig.json         # extends tsconfig.host.json or .client.json
├── tsdown.config.ts      # build config
├── src/
│   ├── index.ts          # main export, Cordis plugin
│   ├── types.ts          # public types
│   └── ...               # implementation
├── tests/                # vitest tests
└── README.md             # bilingual (README.zh.md)
```

### Cordis Plugin Pattern
```ts
// index.ts
import { Context, Service } from '@deepseek-ai/cordis'
import { z } from '@deepseek-ai/schemastery'

export class MyService extends Service {
  static inject = ['requiredService']
  static Config = z.object({ /* config schema */ })
  
  constructor(ctx: Context, config: Config) {
    super(ctx, 'myService')
    // register effects, listeners
  }
}

export default MyService
```

### Capability Seam Pattern
1. **Service Definition** - `packages/<seam>/<seam>/` (abstract `Service`, types)
2. **Service Providers** - `packages/<seam>/<provider>/` (register on `ctx.<key>`)
3. **Consumers** - `packages/<seam>/tool-<name>/` (inject `<key>`, register tools)

---

## Dependencies & Setup

### New Runtime Dependencies
- `pg` (PostgreSQL client)
- `redis` / `ioredis` (Redis client for pub/sub, streams, presence)
- `@kubernetes/client-node` (K8s sandbox)
- `yjs`, `y-websocket`, `y-codemirror.next` (collaborative editing)
- `ws` (WebSocket server/client)
- `jose` (JWT handling)
- `oauth4webapi` (OAuth flows)
- `simple-git` (Git worktree management)

### Infrastructure Requirements
- PostgreSQL 15+ (primary DB)
- Redis 7+ (pub/sub, streams, presence, leases)
- Kubernetes cluster (optional, for K8s sandbox)
- Object storage (S3-compatible, for artifacts/spill)

---

## Milestones & Validation

### Milestone 1 (Week 3): PostgreSQL Persistence Working
- [ ] Schema created, migrations run
- [ ] `create`, `append`, `load`, `list`, `listSnapshots` pass all tests
- [ ] Crash recovery works (synthetic closers)
- [ ] Real-time `LISTEN/NOTIFY` broadcasts events

### Milestone 2 (Week 5): Auth + Session Join Working
- [ ] GitHub OAuth login flow complete
- [ ] `ctx.sessions.join()` adds collaborator
- [ ] Two users can join same session via web GUI
- [ ] Session log visible to both in real-time

### Milestone 3 (Week 8): Git Worktree Isolation
- [ ] Each session gets isolated worktree
- [ ] File ops, bash, search work in worktree
- [ ] Merge workflow creates PR-style diff

### Milestone 4 (Week 11): K8s Sandbox Pool
- [ ] Agents run in K8s pods from pool
- [ ] Warm start < 2s, cold start < 10s
- [ ] Resource limits enforced

### Milestone 5 (Week 14): Distributed Teams
- [ ] Team members across processes
- [ ] Mailbox delivery via Redis Streams
- [ ] Task board shared, CAS updates work

### Milestone 6 (Week 18): Real-Time Collaboration
- [ ] WebSocket transport live
- [ ] Collaborative editing (cursors, selections)
- [ ] Team chat + dashboard

### Milestone 7 (Week 24): Enterprise Ready
- [ ] Org/policy/audit/quotas
- [ ] GitHub/Slack integrations
- [ ] Load tested (100 concurrent sessions)

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Cordis single-process assumption | Design plugins stateless; externalize state to Redis/PG |
| Session log conflicts | Optimistic locking with revision; CRDT for collaborative edits |
| Sandbox isolation | Landlock/seatbelt/bwrap per worktree; K8s network policies |
| Latency in distributed teams | Local-first UX; optimistic UI; background sync |
| Plugin hot-reload in distributed | Versioned plugin registry; rolling deployments |

---

*Generated from deep DSH architecture analysis. See AGENTS.md for coding conventions.*