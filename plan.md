# DeepSeek Harness Enterprise Transformation Plan
## Complete Technical Specification

---

## Table of Contents
1. [Executive Summary](#executive-summary)
2. [Current DSH Architecture Analysis](#current-dsh-architecture-analysis)
3. [Enterprise Philosophy](#enterprise-philosophy)
4. [Capability Seam Extensions](#capability-seam-extensions)
5. [Enterprise Package Specifications](#enterprise-package-specifications)
6. [Integration & Profile Composition](#integration--profile-composition)
7. [Infrastructure Requirements](#infrastructure-requirements)
8. [Implementation Roadmap](#implementation-roadmap)
9. [Testing & Validation](#testing--validation)
10. [Appendices](#appendices)

---

## Executive Summary

This document specifies the complete transformation of **DeepSeek Harness (DSH)** from a single-user agent harness into an **enterprise-ready, multi-tenant, distributed coding platform** with full compliance, observability, and governance capabilities.

**Core Principle:** Every enterprise feature is implemented as a **native DSH Cordis plugin** that composes via profile layers, leveraging existing capability seams and event-sourced architecture. No existing functionality is replaced—only extended.

### Enterprise Features Delivered

| Category | Features |
|----------|----------|
| **Security & Compliance** | KMS-backed secrets, GDPR/SOC2/HIPAA policy engine, audit trails, data residency |
| **Observability** | Distributed tracing (OpenTelemetry), hash-chained audit logs, SIEM integration |
| **Memory & Knowledge** | Hierarchical multi-scope memory (agent/session/team/org), semantic search, auto-consolidation |
| **Code Intelligence** | AST-based indexing, semantic code search, agent context injection |
| **Collaboration** | Multi-user sessions, real-time presence/cursors, Git worktree isolation |
| **Distributed Execution** | K8s sandbox pooling, remote execution, sandbox quotas |
| **Governance** | Multi-party approval workflows, config drift detection, SBOM generation |
| **Network Security** | mTLS, zero-trust transport, SPIFFE integration |

---

## Current DSH Architecture Analysis

### Verified Package Structure (from `deepseek-ai/deepseek-harness`)

```
packages/
├── core/                     # Core services (immutable)
│   ├── session/             # Event-sourced session log
│   ├── agent-loop/          # Agent execution driver
│   ├── tools/               # Tool registry & execution pipeline
│   ├── agent/               # Agent interface & registry
│   ├── llm/                 # LLM adapter seam
│   ├── subagent/            # Subagent provider system (7 providers)
│   └── workflow/            # Model orchestration engine
├── host/                     # Host services
│   ├── apiproxy/            # API gateway
│   ├── webserver/           # HTTP/WebSocket server
│   ├── web/                 # Web GUI host side
│   └── runtime/             # Runtime environment
├── client/                   # Client services
│   ├── runtime/             # Runtime client
│   ├── connection/          # Connection management (ws, http)
│   ├── modules/             # Client modules (plugin system)
│   └── ui/                  # UI components
├── apps/                     # Applications
│   ├── cli/                 # Command-line interface
│   ├── web/                 # Web application
│   └── headless/            # Headless application
├── experimental/
│   └── agent-team/          # Flat agent teams (single-process)
├── bundle/                   # Profile bundles
│   ├── base/                # Core bundle (dsh-base)
│   ├── web-app/             # Web bundle (dsh-web-app)
│   └── headless/            # Headless bundle (dsh-headless)
└── vendor/
    └── cosmokit/            # Foreign dependencies
```

### Key Architecture Primitives (Verified)

| Primitive | Purpose | Enterprise Extension |
|-----------|---------|---------------------|
| **Capability Seams** | Service Definition → Providers → Consumers | Policy enforcement via config on seams |
| **Event-Sourced Session** | Append-only `SessionEvent` log | Hash chain, WORM storage, SIEM export |
| **Cordis Plugin System** | `ctx.effect()`, declarative config | All enterprise features as plugins |
| **Profile/Bundle Composition** | Layered config (base → profile → patch) | Enterprise profile extends base |
| **Scope Isolation** | `dsh-scope` per-agent registration | Multi-tenant memory/policy isolation |
| **Subagent Providers** | 7 providers (spawn, fork, ACP, Codex, etc.) | K8s/remote providers, pooling |
| **Approval/Interaction Seams** | Human-in-the-loop gates | Multi-party workflows |
| **Persistence Coordinator** | Write batching, crash repair, snapshots | Checkpoint consumers for compliance export |

### Existing Capability Seams (Extension Points)

```typescript
// All enterprise features plug into these existing seams:

ctx.fs              → Data residency, encryption, Git worktrees
ctx.subprocess      → Sandbox, resource limits, network policy
ctx.shell           → Command allowlist, audit, approval
ctx.sandbox         → Confinement (Landlock/Seatbelt/K8s)
ctx.llm             → Model allowlist, token budgets, routing
ctx.tools           → Tool allowlist, approval gates, timeout policy
ctx.subagents       → Delegation depth, provider allowlist, isolation
ctx.workflow        → Concurrency caps, child policies
ctx.agentTeams      → Team membership, task ownership, cross-process
ctx.credentials     → Secret rotation, KMS, audit
ctx.settings        → Layered config, secrets slots, revision control
ctx.approval        → Multi-party approval workflows
ctx.codeIntel       → NEW: Code indexing, semantic search
ctx.memory          → NEW: Hierarchical memory system
```

---

## Enterprise Philosophy

### DSH-Native Extension Pattern

```mermaid
graph TB
    A[DSH Core] --> B[Enterprise Bundles]
    B --> C[Capability Seam Extensions]
    B --> D[New Capability Seams]
    B --> E[Profile Layers]
    B --> F[Transport Plugins]
    
    C --> C1[ctx.tools + policy]
    C --> C2[ctx.llm + model allowlist]
    C --> C3[ctx.sandbox + K8s provider]
    C --> C4[ctx.credentials + KMS]
    
    D --> D1[ctx.codeIntel]
    D --> D2[ctx.memory]
    
    E --> E1[enterprise-audit]
    E --> E2[enterprise-policy]
    E --> E3[enterprise-network]
    
    F --> F1[mtls-webserver]
    F --> F2[mtls-sdk-client]
```

**Every enterprise feature:**
1. **Is a Cordis plugin** with `static inject`, `static Config`, `ctx.effect()`
2. **Registers on existing seams** or defines new seams
3. **Composes via profile layers** (enterprise profile extends base)
4. **Uses typed events** for audit/observability
4. **Follows DSH conventions**: branded types, schemastery config, bilingual docs

---

## Capability Seam Extensions

### 1. Tool Policy Enforcement (on `ctx.tools`)

```yaml
# enterprise-policy profile
- id: enterprise-policy
  name: '@deepseek-ai/dsh-enterprise-policy'
  config:
    toolPolicies:
      allowlist: ['read_file', 'write_file', 'bash', 'grep', 'glob', 'code_search']
      blocklist: ['rm', 'curl', 'wget', 'dd', 'mkfs']
      requireApproval: ['bash', 'write_file', 'agent_spawn']
      maxTokensPerRequest: 8192
    modelPolicies:
      allowlist: ['deepseek-v4-flash', 'deepseek-v4-pro', 'deepseek-coder']
      blocklist: []
      maxTokensPerRequest: 8192
      requireReasoningEffort: 'high'
    sandboxPolicies:
      defaultMode: 'workspace-write'
      allowedModes: ['read-only', 'workspace-write']
      networkPolicy: 'deny-by-default'
      egressAllowlist: ['api.github.com', 'registry.npmjs.org', 'pypi.org']
    retentionPolicies:
      default:
        minDays: 2555
        maxDays: 3650
        autoDelete: true
        backupToWORM: true
```

### 2. KMS Credentials Provider (on `ctx.credentials`)

Replaces default credentials provider with envelope encryption.

### 3. Distributed Tracing (on Cordis dispatch)

Wraps `agent/pre-step`, `tools/execute`, `llm/stream`, `subagent/start` with OTel spans.

### 4. Approval Workflow (on `ctx.approval`)

Replaces default approval with multi-party, timeout, escalation.

---

## Enterprise Package Specifications

### Package Structure Convention

```
packages/enterprise/
├── audit/                     # Immutable audit trail
│   ├── session-hash-chain/    # Hash chain on session events
│   ├── session-worm-storage/  # S3 WORM backend
│   └── audit-siem/            # CEF/JSON syslog export
├── secrets/                   # KMS-backed secrets
│   └── credentials-kms/       # Envelope encryption provider
├── tracing/                   # OpenTelemetry instrumentation
│   └── otel-instrumentation/  # Auto-spans on DSH events
├── policy/                    # Compliance policy engine
│   ├── tool-policy/           # Tool allowlist/blocklist/approval
│   ├── model-policy/          # Model allowlist/quotas
│   ├── sandbox-policy/        # Sandbox network/resource limits
│   └── retention-policy/      # Session retention/archival
├── approval/                  # Multi-party approval workflow
│   └── approval-workflow/     # Escalation, timeout, delegation
├── governance/                # Config management
│   ├── config-audit/          # Profile watcher, drift detection
│   └── drift-detector/        # Live vs declared scanner
├── sbom/                      # Software Bill of Materials
│   └── sbom-generator/        # CycloneDX/SPDX + vuln scanning
├── network/                   # Zero-trust networking
│   ├── mtls-webserver/        # Host mTLS transport
│   └── mtls-sdk-client/       # SDK mTLS transport
├── code-intel/                # Code intelligence
│   ├── code-intel/            # Service definition
│   ├── local-provider/        # Tree-sitter + SQLite + embeddings
│   ├── tool-code-search/      # code_search, code_get_definition tools
│   └── agent-context-injection/ # Auto context injection
└── memory/                    # Enterprise memory system
    ├── memory/                # Service definition + tiered orchestrator
    ├── postgres-backend/      # pgvector + full-text + HNSW
    ├── redis-backend/         # Hot tier cache
    ├── tiered-memory/         # Hot/cold tiering + consolidation
    ├── tool-memory/           # memory_read/write/search/consolidate
    ├── session-integration/   # Fork/archive on session events
    └── compliance/            # GDPR/SOC2 retention, erasure
```

---

### Package: `@deepseek-ai/dsh-enterprise-audit`

**Purpose:** Tamper-evident audit trail integrated with session log.

#### Components

| Component | Responsibility |
|-----------|---------------|
| `session-hash-chain` | Intercepts `session/event`, adds SHA-256 hash chain |
| `session-worm-storage` | `PersistenceBackend` writing to S3 with Object Lock |
| `audit-siem` | Exports `audit/event` to syslog/HTTP/Kafka in CEF/JSON |

#### Key Implementation: Hash Chain Plugin

```typescript
// packages/enterprise/audit/src/session-hash-chain/index.ts
export class SessionHashChain extends Service {
  static inject = ['sessions']
  static Config = z.object({
    algorithm: z.enum(['SHA-256']).default('SHA-256'),
    chainBufferSize: z.number().int().positive().default(100),
    verificationWindowMs: z.number().int().positive().default(3600000),
  })

  private hashChain: Map<string, string> = new Map()

  constructor(ctx: Context, config) {
    super(ctx, 'audit-hash-chain')
    ctx.on('session/event', (session, event) => this.processEvent(session, event))
    setInterval(() => this.verifyHashes(), config.verificationWindowMs)
  }

  private processEvent(session: any, event: SessionEvent): void {
    const currentHash = this.computeEventHash(event)
    const previousHash = this.hashChain.get(session.id)
    
    const auditEvent = {
      ...event,
      auditMetadata: {
        sessionId: session.id,
        eventSequence: event.seq,
        eventHash: currentHash,
        previousEventHash: previousHash,
      }
    }
    
    this.hashChain.set(session.id, currentHash)
    this.ctx.emit('session/event', session, auditEvent)
    this.ctx.emit('audit/event', this.toAuditEvent(session, event, currentHash, previousHash))
  }
}
```

#### WORM Storage Backend

```typescript
// packages/enterprise/audit/src/session-worm-storage/index.ts
export class S3WormBackend extends PostgresBackend {
  constructor(config: PostgresConfig & { s3: S3Config }) {
    super(config)
    this.s3Client = new S3Client({ region: config.s3.region })
    this.setupWormConfiguration(config.s3.retentionDays)
  }

  private async setupWormConfiguration(retentionDays: number): Promise<void> {
    await this.s3ControlClient.send(new PutBucketLifecycleConfigurationCommand({
      Bucket: this.bucketName,
      LifecycleConfiguration: {
        Rules: [{
          ID: 'AuditLogWORM',
          Status: 'Enabled',
          ObjectLockMode: 'GOVERN',
          ObjectLockRetainUntilDate: Math.floor(Date.now() / 1000) + (retentionDays * 86400),
          Filter: { Prefix: 'audit-logs' }
        }]
      }
    }))
  }
}
```

---

### Package: `@deepseek-ai/dsh-enterprise-secrets`

**Purpose:** KMS-backed envelope encryption for all secrets.

```typescript
// packages/enterprise/secrets/src/credentials-kms/index.ts
export class KMSCredentialsProvider extends Service implements CredentialsService {
  static inject = ['credentials']
  static Config = z.object({
    provider: z.enum(['aws-kms', 'gcp-kms', 'azure-kms', 'vault']).default('aws-kms'),
    keyId: z.string(),
    region: z.string().optional(),
    dataKeyCacheSize: z.number().int().positive().default(50),
    dataKeyTtlMs: z.number().int().positive().default(300000),
    rotationDays: z.number().int().positive().default(90),
    envelopeEncryption: z.boolean().default(true),
    auditEnabled: z.boolean().default(true),
  })

  private kmsClient: KMSClient
  private cache: Map<string, { dataKey: string; encryptedDataKey: string; expiry: number }> = new Map()

  async get(keyId: string): Promise<string | null> {
    if (!await this.checkPermission(keyId, 'read')) return null
    const encryptedDataKey = await this.getEncryptedDataKey(keyId)
    if (!encryptedDataKey) return null
    return this.decryptValue(encryptedDataKey, keyId)
  }

  async set(keyId: string, value: string): Promise<void> {
    if (!await this.checkPermission(keyId, 'write')) throw new CredentialsError(...)
    const encrypted = this.encryptValue(value, keyId)
    await this.storeEncrypted(keyId, encrypted)
    this.scheduleKeyRotation(keyId)
    this.logAudit('access', keyId, 'write', 'success')
  }

  private encryptValue(value: string, keyId: string): string {
    const cached = this.cache.get(keyId)
    const dataKey = Buffer.from(cached.dataKey, 'base64')
    const iv = crypto.randomBytes(16)
    const cipher = crypto.createCipheriv('aes-256-gcm', dataKey, iv)
    // ... AES-256-GCM encryption with auth tag
  }
}
```

---

### Package: `@deepseek-ai/dsh-enterprise-tracing`

**Purpose:** OpenTelemetry auto-instrumentation of DSH core events.

```typescript
// packages/enterprise/tracing/src/otel-instrumentation/index.ts
export class OTelInstrumentation extends Service {
  static inject = ['settings']
  static Config = z.object({
    exporter: z.enum(['otlp', 'jaeger', 'zipkin', 'stdout']).default('otlp'),
    endpoint: z.string().url().default('http://otel-collector:4317'),
    serviceName: z.string().default('deepseek-harness'),
    sampler: z.enum(['always-on', 'always-off', 'traceid-ratio']).default('traceid-ratio'),
    samplerRatio: z.number().min(0).max(1).default(0.1),
    autoInstrument: z.object({
      agentLoop: z.boolean().default(true),
      tools: z.boolean().default(true),
      llm: z.boolean().default(true),
      subagent: z.boolean().default(true),
      workflow: z.boolean().default(true),
      sdk: z.boolean().default(true),
    }),
  })

  private setupAutoInstrumentation(ctx: Context, config): void {
    if (config.autoInstrument.agentLoop) {
      ctx.on('agent/pre-step', (agent, header) => 
        trace.startSpan('agent.step', { attributes: { 'dsh.agent.id': agent.id, 'gen_ai.system': 'deepseek' }})
      )
    }
    if (config.autoInstrument.tools) {
      ctx.on('tools/execute', (toolName) => 
        trace.startSpan('tool.execute', { attributes: { 'dsh.tool.name': toolName }})
      )
    }
    // ... llm, subagent, workflow
  }
}
```

---

### Package: `@deepseek-ai/dsh-enterprise-policy`

**Purpose:** Declarative policy enforcement on existing seams.

```typescript
// packages/enterprise/policy/src/compliance-engine/index.ts
export class CompliancePolicyEngine extends Service {
  static inject = ['tools', 'llm', 'sessions', 'sandbox']
  static Config = z.object({
    frameworks: z.array(z.enum(['GDPR', 'SOC2', 'HIPAA', 'ISO27001'])).default([]),
    toolPolicies: z.object({
      allowlist: z.array(z.string()).default([]),
      blocklist: z.array(z.string()).default([]),
      requireApproval: z.array(z.string()).default([]),
    }),
    modelPolicies: z.object({
      allowlist: z.array(z.string()).default([]),
      maxTokensPerRequest: z.number().int().positive().default(8192),
    }),
    dataResidency: z.object({
      allowedRegions: z.array(z.string()).default(['us-east-1', 'eu-west-1']),
      requireExplicitConsent: z.boolean().default(true),
    }),
  })

  constructor(ctx: Context, config) {
    super(ctx, 'compliance')
    
    // Tool policy enforcement via existing ctx.tools.restrict()
    ctx.tools.restrict((toolName) => {
      if (config.toolPolicies.allowlist.length > 0 && !config.toolPolicies.allowlist.includes(toolName)) return false
      return !config.toolPolicies.blocklist.includes(toolName)
    })

    // Approval requirements via tools/pre-execute
    if (config.toolPolicies.requireApproval.length > 0) {
      ctx.on('tools/pre-execute', async (toolName) => {
        if (config.toolPolicies.requireApproval.includes(toolName)) {
          return { allowed: false, reason: 'Approval required' }
        }
        return { allowed: true }
      })
    }

    // Model policy via agent/pre-step
    ctx.on('agent/pre-step', async (agent, header) => {
      if (config.modelPolicies.allowlist.length > 0 && !config.modelPolicies.allowlist.includes(header.config.model)) {
        return { allowed: false, reason: 'Model not allowed' }
      }
      return { allowed: true }
    })
  }
}
```

---

### Package: `@deepseek-ai/dsh-enterprise-approval`

**Purpose:** Multi-party approval workflow with escalation.

```typescript
// packages/enterprise/approval/src/approval-workflow/index.ts
export class ApprovalWorkflow extends Service implements ApprovalService {
  static inject = ['settings', 'credentials']
  static Config = z.object({
    defaultPolicy: z.object({
      approvers: z.array(z.string()).default(['admin']),
      threshold: z.number().int().positive().default(1),
      timeoutMs: z.number().int().positive().default(3600000),
      escalation: z.object({
        afterMs: z.number().int().positive().default(300000),
        approvers: z.array(z.string()).default([]),
      }).optional(),
    }),
    policies: z.record(z.object({
      approvers: z.array(z.string()),
      threshold: z.number().int().positive(),
      timeoutMs: z.number().int().positive(),
      escalation: z.object({ afterMs: z.number().int().positive(), approvers: z.array(z.string()) }).optional(),
    })),
    notifications: z.object({
      webhook: z.string().url().optional(),
      slack: z.object({ enabled: z.boolean().default(true), channel: z.string().default('#approvals') }).optional(),
    }),
  })

  private pending: Map<string, ApprovalRequest> = new Map()

  async requestApproval(request: Omit<ApprovalRequest, 'id' | 'status'>): Promise<string> {
    const id = `approval-${Date.now()}-${crypto.randomUUID()}`
    const policy = this.config.policies[request.policyId] || this.config.defaultPolicy
    
    this.pending.set(id, { id, ...request, status: 'pending', createdAt: Date.now(), decisions: [], policy })
    await this.notifyApprovers(id, policy)
    
    const timer = setTimeout(() => this.handleTimeout(id), policy.timeoutMs)
    this.timers.set(id, timer)
    return id
  }

  async decideApproval(id: string, decision: ApprovalDecision): Promise<void> {
    const approval = this.pending.get(id)
    // ... consensus logic with threshold
    // ... emit approval/granted or approval/denied
  }
}
```

---

### Package: `@deepseek-ai/dsh-enterprise-code-intel`

**Purpose:** AST-based code indexing with semantic search.

```typescript
// packages/enterprise/code-intel/src/local-provider/index.ts
export class LocalCodeIntelProvider extends Service implements CodeIntelService {
  static inject = ['fs', 'subprocess']
  static Config = z.object({
    databasePath: z.string().default('$DSH_HOME/code-intel.db'),
    vectorDimension: z.number().int().positive().default(768),
    embeddingModel: z.string().default('sentence-transformers/all-MiniLM-L6-v2'),
    watchFiles: z.boolean().default(true),
    languages: z.array(z.string()).default(['typescript', 'javascript', 'python', 'go', 'rust']),
  })

  private db: Database
  private parsers: Map<string, ts.Language> = new Map()

  constructor(ctx: Context, config) {
    super(ctx, 'codeIntel')
    this.db = new Database(config.databasePath)
    this.initSchema()  // files, symbols, references, embeddings tables
    this.initParsers(config.languages)  // Tree-sitter parsers
    if (config.watchFiles) this.setupFileWatcher()
  }

  async indexFile(filePath: string): Promise<void> {
    const content = await this.ctx.fs.read(filePath)
    const tree = this.parseFile(content, language)
    const symbols = this.extractSymbols(tree, filePath, content)
    // Store symbols, references, generate embeddings
  }

  async search(query: SearchQuery): Promise<SearchResult[]> {
    if (query.type === 'semantic' || query.type === 'hybrid') {
      return this.semanticSearch(query)  // Vector similarity via pgvector/embeddings
    }
    return this.keywordSearch(query)  // SQLite FTS
  }

  async getContextForPrompt(query: string, options): Promise<PromptContext> {
    // Returns relevant snippets for agent prompt injection
  }
}
```

**Agent Tools:**
- `code_search` - Hybrid semantic/keyword search
- `code_get_definition` - Go-to-definition
- `code_get_context` - Relevant snippets for prompt injection (maxTokens)

---

### Package: `@deepseek-ai/dsh-enterprise-memory`

**Purpose:** Hierarchical multi-scope memory with consolidation.

#### Memory Scopes

| Scope | Lifetime | Use Case |
|-------|----------|----------|
| `agent` | Persistent across sessions | Agent skills, preferences, learned facts |
| `session` | Session lifetime | Working memory, task context |
| `team` | Team lifetime | Shared knowledge, project conventions |
| `organization` | Org lifetime | Policies, best practices, constants |
| `global` | System lifetime | Universal constants, schemas |

#### Tiered Storage Architecture

```typescript
// packages/enterprise/memory/src/tiered-memory/index.ts
export class TieredMemoryService extends Service implements MemoryService {
  static inject = ['memoryStoragePostgres', 'memoryStorageRedis']
  static Config = z.object({
    hotTierTTL: z.number().int().positive().default(3600000),
    promotionThreshold: z.number().int().positive().default(3),
    consolidationInterval: z.number().int().positive().default(3600000),
  })

  private pg: MemoryStorageBackend  // Cold tier: pgvector + full-text + HNSW
  private redis: MemoryStorageBackend  // Hot tier: Redis cache

  async read(scope: MemoryScope, key: string): Promise<MemoryBlock | null> {
    // Try Redis first (hot)
    let block = await this.redis.get(scope, key)
    if (block) { this.recordAccess(key); return block }
    
    // Fallback to PostgreSQL (cold)
    block = await this.pg.get(scope, key)
    if (block) { this.recordAccess(key); await this.maybePromote(scope, key, block); }
    return block
  }

  async write(scope: MemoryScope, key: string, value: MemoryValue, options): Promise<MemoryBlock> {
    // Write to both tiers, handle supersession, embeddings
  }

  async consolidate(scope: MemoryScope): Promise<ConsolidationResult> {
    // 1. Cluster memories by embedding similarity (>0.85)
    // 2. LLM synthesis of each cluster
    // 3. Write consolidated memory, archive originals
  }
}
```

#### PostgreSQL Backend with pgvector + HNSW

```sql
-- packages/enterprise/memory/src/postgres-backend/schema.sql
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE memory_blocks (
  scope_type TEXT NOT NULL,
  scope_id TEXT NOT NULL,
  key TEXT NOT NULL,
  value JSONB NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}',
  version INTEGER NOT NULL DEFAULT 1,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL,
  created_by TEXT NOT NULL,
  updated_by TEXT NOT NULL,
  embedding vector(1536),
  PRIMARY KEY (scope_type, scope_id, key)
);

CREATE INDEX idx_memory_scope ON memory_blocks(scope_type, scope_id);
CREATE INDEX idx_memory_category ON memory_blocks((metadata->>'category'));
CREATE INDEX idx_memory_tags ON memory_blocks USING GIN ((metadata->'tags'));
CREATE INDEX idx_memory_embedding_hnsw ON memory_blocks USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- Full-text search
ALTER TABLE memory_blocks ADD COLUMN search_vector tsvector
  GENERATED ALWAYS AS (to_tsvector('english', COALESCE(key, '') || ' ' || COALESCE(value::text, ''))) STORED;
CREATE INDEX idx_memory_fts ON memory_blocks USING GIN (search_vector);
```

#### Agent Tools

```typescript
// packages/enterprise/memory/src/tool-memory/index.ts
ctx.tools.register({
  name: 'memory_write',
  parameters: z.object({
    key: z.string(), value: z.any(),
    scope: z.object({ type: z.enum(['agent','session','team','organization']), id: z.string().optional() }).optional(),
    category: z.enum(['fact','procedure','preference','context','skill','constraint']).default('fact'),
    sensitivity: z.enum(['public','internal','confidential','restricted']).default('internal'),
    tags: z.array(z.string()).default([]),
    importance: z.number().min(0).max(1).default(0.5),
    ttl: z.number().int().positive().optional(),
  }),
  async execute(args) { return ctx.memory.write(scope, args.key, args.value, args) }
})

ctx.tools.register({
  name: 'memory_search',
  parameters: z.object({
    query: z.string().optional(), scope: z.any().optional(),
    categories: z.array(z.string()).optional(), tags: z.array(z.string()).optional(),
    semantic: z.boolean().default(false), maxResults: z.number().default(10),
  }),
  async execute(args) { return ctx.memory.search({ ...args, scope }) }
})

ctx.tools.register({
  name: 'memory_consolidate',
  parameters: z.object({ scope: z.any().optional() }),
  async execute(args) { return ctx.memory.consolidate(args.scope) }
})
```

---

## Integration & Profile Composition

### Complete Enterprise Profile

```yaml
# cordis.patch.yml (enterprise profile)
# Layer 1: Core enterprise infrastructure
- id: enterprise-audit
  name: '@deepseek-ai/dsh-enterprise-audit'
- id: enterprise-secrets
  name: '@deepseek-ai/dsh-enterprise-secrets'
  config:
    provider: 'aws-kms'
    keyId: !!js process.env.AWS_KMS_KEY_ID
    rotationDays: 90
- id: enterprise-tracing
  name: '@deepseek-ai/dsh-enterprise-tracing'
  config:
    exporter: 'otlp'
    endpoint: !!js process.env.OTEL_ENDPOINT
    samplerRatio: 0.1

# Layer 2: Policy & governance
- id: enterprise-policy
  name: '@deepseek-ai/dsh-enterprise-policy'
  config:
    frameworks: ['GDPR', 'SOC2', 'HIPAA']
    toolPolicies:
      allowlist: ['read_file', 'write_file', 'bash', 'grep', 'glob', 'code_search', 'memory_read', 'memory_write']
      blocklist: ['rm', 'curl', 'wget', 'dd']
      requireApproval: ['bash', 'write_file', 'agent_spawn', 'sandbox_create']
    modelPolicies:
      allowlist: ['deepseek-v4-flash', 'deepseek-v4-pro', 'deepseek-coder']
      maxTokensPerRequest: 8192
    sandboxPolicies:
      defaultMode: 'workspace-write'
      networkPolicy: 'deny-by-default'
      egressAllowlist: ['api.github.com', 'registry.npmjs.org', 'pypi.org']
- id: enterprise-approval
  name: '@deepseek-ai/dsh-enterprise-approval'
  config:
    defaultPolicy:
      approvers: ['role:security', 'role:platform']
      threshold: 1
      timeoutMs: 3600000
      escalation:
        afterMs: 300000
        approvers: ['role:security-lead']
    policies:
      agent_spawn:
        approvers: ['role:admin', 'role:security']
        threshold: 1
      sandbox_create:
        approvers: ['role:platform']
        threshold: 1

# Layer 3: Intelligence & memory
- id: enterprise-code-intel
  name: '@deepseek-ai/dsh-enterprise-code-intel'
  config:
    databasePath: '$DSH_HOME/code-intel.db'
    watchFiles: true
    languages: ['typescript', 'javascript', 'python', 'go', 'rust', 'java']
- id: enterprise-memory
  name: '@deepseek-ai/dsh-enterprise-memory'
- id: enterprise-memory-postgres
  name: '@deepseek-ai/dsh-enterprise-memory-postgres'
  config:
    connectionString: !!js process.env.DSH_PG_URL
    vectorDimension: 1536
    enableHNSW: true
- id: enterprise-memory-redis
  name: '@deepseek-ai/dsh-enterprise-memory-redis'
  config:
    url: !!js process.env.DSH_REDIS_URL
- id: enterprise-memory-tiered
  name: '@deepseek-ai/dsh-enterprise-memory-tiered'
  config:
    hotTierTTL: 3600000
    promotionThreshold: 3

# Layer 4: Tools & integration
- id: tool-code-search
  name: '@deepseek-ai/dsh-tool-code-search'
- id: tool-memory
  name: '@deepseek-ai/dsh-tool-memory'
- id: agent-code-context
  name: '@deepseek-ai/dsh-agent-code-context'
  config:
    autoInject: true
    maxContextTokens: 4000
    injectionStrategy: 'on-demand'
- id: session-memory
  name: '@deepseek-ai/dsh-session-memory'

# Layer 5: Governance & compliance
- id: enterprise-governance
  name: '@deepseek-ai/dsh-enterprise-governance'
  config:
    auditLogRetention: 3650
    configChangeApproval: true
    driftDetection: true
- id: enterprise-sbom
  name: '@deepseek-ai/dsh-enterprise-sbom'
  config:
    format: 'cyclonedx'
    outputDir: '$DSH_HOME/sbom'
    scanVulnerabilities: true
    failOnCritical: true
- id: enterprise-compliance
  name: '@deepseek-ai/dsh-enterprise-compliance'
  config:
    gdpr:
      rightToErasure: true
      retentionDays: 2555

# Layer 6: Network security
- id: enterprise-network
  name: '@deepseek-ai/dsh-enterprise-network'
  config:
    enable: true
    certPath: './certs/server.crt'
    keyPath: './certs/server.key'
    caPath: './certs/ca.crt'
```

### pnpm-workspace.yaml

```yaml
packages:
  - packages/identity/*
  - packages/session/session-persistence-postgres
  - packages/session/session-collaboration
  - packages/workspace/git-worktree/*
  - packages/sandbox/kubernetes
  - packages/team/*
  - packages/enterprise/*
  - packages/host/websocket
  - packages/client/connection/ws
  - examples/*
```

---

## Infrastructure Requirements

### Required Services

| Service | Version | Purpose |
|---------|---------|---------|
| **PostgreSQL** | 15+ | Session persistence, audit logs, memory (pgvector), code intel |
| **Redis** | 7+ | Hot memory tier, presence, pub/sub, distributed locks |
| **Kubernetes** | 1.27+ | Sandbox pods, sandbox pooling |
| **Object Storage** | S3-compatible | WORM audit logs, artifacts |
| **OpenTelemetry Collector** | 0.95+ | Trace/metric collection |
| **SPIRE** | 1.5+ | mTLS certificate management (optional) |

### PostgreSQL Extensions

```sql
-- Required extensions
CREATE EXTENSION IF NOT EXISTS vector;      -- pgvector for embeddings
CREATE EXTENSION IF NOT EXISTS pg_trgm;     -- Trigram similarity
CREATE EXTENSION IF NOT EXISTS btree_gin;   -- GIN indexes on JSONB
```

### Environment Variables

```bash
# .env (gitignored)
# Core DSH
DSH_PG_URL=postgresql://user:pass@localhost:5432/dsh
DSH_REDIS_URL=redis://localhost:6379
DSH_HOME=/var/lib/dsh
DSH_VERSION=1.0.0-enterprise

# Enterprise Credentials
AWS_ACCESS_KEY_ID=your-aws-access-key
AWS_SECRET_ACCESS_KEY=your-aws-secret-key
AWS_REGION=us-east-1
AWS_KMS_KEY_ID=arn:aws:kms:us-east-1:123456789012:key/your-key-id

# Observability
OTEL_ENDPOINT=http://otel-collector:4317
OTEL_SAMPLER_RATIO=0.1

# TLS
DSH_SERVER_CERT=./certs/server.crt
DSH_SERVER_KEY=./certs/server.key
DSH_CA_CERT=./certs/ca.crt

# Compliance
DSH_COMPLIANCE_FRAMEWORKS=GDPR,SOC2,HIPAA
DSH_DATA_RESIDENCY=us-east-1,eu-west-1

# Authentication
GITHUB_CLIENT_ID=your-github-client-id
GITHUB_CLIENT_SECRET=your-github-client-secret
DSH_ALLOWED_ORGS=your-org,another-org
```

---

## Implementation Roadmap

### Phase 1: Foundation (Weeks 1-4)

| Week | Deliverable | Packages |
|------|-------------|----------|
| 1 | PostgreSQL session persistence | `session-persistence-postgres` |
| 2 | Auth/Identity + GitHub OAuth | `identity/auth`, `identity/oauth/github` |
| 3 | Session collaboration (join/handoff) | `session-collaboration` |
| 4 | Audit hash chain + WORM storage | `enterprise-audit/session-hash-chain`, `session-worm-storage` |

**Validation:**
- Two users join same session via web GUI
- Session log visible to both in real-time
- Audit events exported to SIEM

### Phase 2: Security & Observability (Weeks 3-6)

| Week | Deliverable | Packages |
|------|-------------|----------|
| 3 | KMS credentials provider | `enterprise-secrets/credentials-kms` |
| 4 | OTel distributed tracing | `enterprise-tracing/otel-instrumentation` |
| 5 | Policy engine (tool/model/sandbox) | `enterprise-policy` |
| 6 | SIEM integration | `enterprise-audit/audit-siem` |

**Validation:**
- Secrets encrypted at rest, auto-rotated
- Traces visible in Jaeger/Grafana
- Tool execution blocked by policy

### Phase 3: Intelligence & Memory (Weeks 5-9)

| Week | Deliverable | Packages |
|------|-------------|----------|
| 5 | Code intelligence (local provider) | `enterprise-code-intel/local-provider` |
| 6 | Code search tools + agent injection | `enterprise-code-intel/tool-code-search`, `agent-context-injection` |
| 7 | Memory service + PostgreSQL backend | `enterprise-memory`, `enterprise-memory-postgres` |
| 8 | Redis hot tier + tiered orchestrator | `enterprise-memory-redis`, `enterprise-memory-tiered` |
| 9 | Memory tools + session integration | `enterprise-memory/tool-memory`, `session-integration` |

**Validation:**
- Agents use `code_search` and `memory_write` tools
- Cross-session memory persistence
- Auto-consolidation reduces memory bloat

### Phase 4: Collaboration & Distributed Execution (Weeks 8-13)

| Week | Deliverable | Packages |
|------|-------------|----------|
| 8 | Git worktree filesystem provider | `workspace/git-worktree/fs-git-worktree` |
| 9 | WebSocket transport | `host/websocket`, `client/connection/ws` |
| 10 | K8s sandbox provider + pooling | `sandbox/kubernetes`, `sandbox/pool` |
| 11 | Distributed agent teams | `team/distributed`, `team/hierarchical` |
| 12 | Real-time presence/cursors | `session-collaboration` (cursors), `client/ui-collab-edit` |
| 13 | Team dashboard + chat | `client/ui-team-dashboard`, `client/ui-team-chat` |

**Validation:**
- Two developers edit same file with cursors
- Agents run in K8s pods from warm pool
- Team task board shared across processes

### Phase 5: Governance & Compliance (Weeks 12-17)

| Week | Deliverable | Packages |
|------|-------------|----------|
| 12 | Multi-party approval workflow | `enterprise-approval/approval-workflow` |
| 13 | Config audit + drift detection | `enterprise-governance/config-audit`, `drift-detector` |
| 14 | SBOM generator + vuln scanning | `enterprise-sbom/sbom-generator` |
| 15 | Memory compliance (GDPR erasure) | `enterprise-memory/compliance` |
| 16 | mTLS transport | `enterprise-network/mtls-webserver`, `mtls-sdk-client` |
| 17 | Compliance reporting | `enterprise-audit/audit-siem`, `enterprise-governance` |

**Validation:**
- Approval workflow with Slack/email notifications
- Config changes require approval, drift detected
- SBOM generated on build, fails on critical vulns
- mTLS between all components

### Phase 6: Production Hardening (Weeks 16-22)

| Week | Deliverable |
|------|-------------|
| 16 | Load testing (100 concurrent sessions) |
| 17 | Chaos engineering (pod kills, network partitions) |
| 18 | Disaster recovery (PG restore, Redis failover) |
| 19 | Performance optimization (query tuning, cache warming) |
| 20 | Security audit (penetration testing, secret scanning) |
| 21 | Documentation + runbooks |
| 22 | Release candidate |

---

## Testing & Validation

### Test Strategy

```bash
# Unit tests (per package)
pnpm --filter @deepseek-ai/dsh-enterprise-* test

# Integration tests
pnpm test:integration

# E2E tests (require DEEPSEEK_API_KEY)
pnpm test:e2e

# Snapshot tests (keyless replay)
pnpm test:snapshot

# Enterprise-specific tests
pnpm test:enterprise

# Load testing
pnpm test:load --concurrency=100 --duration=30m
```

### Enterprise Test Scenarios

```typescript
// examples/enterprise-tests/multi-user-collab.ts
async function testMultiUserCollaboration() {
  const user1 = new DshWebClient('https://dsh.company.com')
  const user2 = new DshWebClient('https://dsh.company.com')
  
  // Both login via GitHub OAuth
  await user1.auth.login({ provider: 'github' })
  await user2.auth.login({ provider: 'github' })
  
  // User 1 creates session
  const session = await user1.sessions.create({
    cwd: '/workspace/project',
    config: { model: 'deepseek-v4-flash', tools: ['code_search', 'memory_write'] },
    metadata: { dataResidency: 'us-east-1', compliance: ['GDPR'] },
  })
  
  // User 2 joins
  await user2.sessions.join(session.id)
  
  // Both edit same file (cursors visible)
  await user1.editFile(session.id, 'src/main.ts', '// User 1 edit')
  await user2.editFile(session.id, 'src/main.ts', '// User 2 edit')
  
  // Agent uses code intelligence
  const result = await user1.agents.execute(session.id, {
    prompt: 'Add error handling to the API client',
    tools: ['code_search', 'code_get_context', 'memory_write'],
  })
  
  // Verify audit trail
  const audit = await user1.audit.query({ sessionId: session.id })
  assert(audit.events.some(e => e.action === 'tool.execute' && e.resource === 'code_search'))
}
```

### Compliance Validation

```bash
# GDPR right to erasure
pnpm test:compliance:gdpr --user=user@company.com

# SOC2 audit trail completeness
pnpm test:compliance:soc2 --framework=SOC2

# HIPAA PHI protection
pnpm test:compliance:hipaa --check=phi-protection

# SBOM vulnerability scan
pnpm test:sbom --fail-on-critical
```

---

## Appendices

### Appendix A: Complete Package.json Template

```json
{
  "name": "@deepseek-ai/dsh-enterprise-<feature>",
  "version": "0.1.0",
  "license": "MIT",
  "private": true,
  "type": "module",
  "main": "lib/index.js",
  "types": "lib/index.d.ts",
  "exports": {
    ".": {
      "types": "./lib/index.d.ts",
      "import": "./lib/index.js"
    }
  },
  "scripts": {
    "build": "tsdown",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:coverage": "vitest run --coverage"
  },
  "dependencies": {
    "@deepseek-ai/dsh-session": "workspace:^",
    "@deepseek-ai/dsh-tools": "workspace:^",
    "@deepseek-ai/dsh-agent": "workspace:^",
    "@deepseek-ai/dsh-credentials": "workspace:^",
    "@deepseek-ai/cordis": "workspace:^",
    "@deepseek-ai/schemastery": "workspace:^",
    "@deepseek-ai/dsh-brand": "workspace:^"
  },
  "devDependencies": {
    "vitest": "^1.0.0",
    "typescript": "^5.0.0",
    "tsdown": "^0.20.0"
  }
}
```

### Appendix B: Cordis Plugin Template

```typescript
// packages/enterprise/<feature>/src/index.ts
import { Context, Service } from '@deepseek-ai/cordis'
import { z } from '@deepseek-ai/schemastery'

export class FeatureService extends Service {
  static inject = ['requiredService']
  static Config = z.object({
    // Configuration schema with validation
  })

  constructor(ctx: Context, config: z.infer<typeof FeatureService.Config>) {
    super(ctx, 'serviceKey')
    
    // Register effects
    ctx.effect(async () => {
      await this.initialize()
    })
    
    // Event listeners
    ctx.on('event/name', this.handleEvent.bind(this))
    
    // Cleanup
    ctx.effect(() => () => this.cleanup())
  }

  private async initialize(): Promise<void> { /* ... */ }
  private handleEvent(payload: any): void { /* ... */ }
  private cleanup(): void { /* ... */ }
}

export default FeatureService
```

### Appendix C: DSH Conventions Checklist

- [ ] Package name: `@deepseek-ai/dsh-<kebab-case>`
- [ ] Extends `tsconfig.host.json` or `tsconfig.client.json`
- [ ] Uses `@deepseek-ai/schemastery` for config validation
- [ ] Branded types for all IDs (`SessionId`, `UserId`, etc.)
- [ ] Event declarations via module augmentation
- [ ] `ctx.effect()` for resource lifecycle
- [ ] Bilingual README (README.md + README.zh.md)
- [ ] Vitest tests with 100% coverage on src/
- [ ] No `any` types, strict TypeScript
- [ ] Structured logging via `ctx.logger`

### Appendix D: Migration Guide (v0.x → Enterprise)

1. **Add enterprise packages** to `pnpm-workspace.yaml`
2. **Create enterprise profile** `cordis.patch.yml`
3. **Provision infrastructure** (PG, Redis, K8s, S3, OTEL)
4. **Set environment variables** (see Infrastructure Requirements)
5. **Run migrations** for new PostgreSQL schemas
6. **Start with enterprise profile** `pnpm dsh --profile enterprise web`
7. **Gradually enable features** via profile layers
8. **Monitor** via OTel dashboards and audit logs

---

## Summary

This specification provides a **complete, production-ready blueprint** for transforming DeepSeek Harness into an enterprise-grade platform. Every feature:

✅ **Integrates natively** with DSH's Cordis architecture  
✅ **Composes via profiles** for progressive adoption  
✅ **Extends existing seams** rather than replacing them  
✅ **Follows DSH conventions** for plugins, config, testing  
✅ **Delivers enterprise requirements** (compliance, observability, governance)  
✅ **Leverages best-of-breed patterns** from MemGPT, Letta, Chroma, OTel  

The implementation is organized in **6 phases over 22 weeks**, with clear validation criteria at each milestone. All code follows DSH's plugin architecture and can be developed incrementally.