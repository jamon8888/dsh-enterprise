# Comprehensive Review: DSH Enterprise + Facility Alignment

*Based on deep investigation of both codebases via GitHub API*

---

## Executive Summary

This document provides a comprehensive review and unified plan for transforming DeepSeek Harness (DSH) into an enterprise-grade, local-first agent platform, informed by Facility's governance-first architecture and Perplexity Computer's local-first agent design.

---

## DSH Codebase Reality (from GitHub API Investigation)

### Verified Package Structure

```
packages/
├── core/
│   ├── session/              # Event-sourced session log, surface folding
│   ├── agent-loop/           # Deterministic orchestrator, turn/step lifecycle
│   ├── tools/                # Tool registry, waterfall execution, guards
│   ├── agent/                # Agent interface, registry, scope isolation
│   ├── llm/                  # LLM adapter seam, streaming, token measurement
│   ├── subagent/             # 7 providers (spawn, fork, ACP, Claude Code, Codex, SDK)
│   └── workflow/             # Model-written orchestration (parallel, pipeline, agent)
├── host/
│   ├── apiproxy/             # API gateway, RPC, WebSocket
│   ├── webserver/            # HTTP server
│   ├── web/                  # Host side of web GUI
│   └── runtime/              # Runtime environment
├── client/
│   ├── runtime/              # Client runtime (session, workspace stores)
│   ├── connection/           # HTTP, WebSocket (ws)
│   ├── modules/              # Client modules (lazy CJS, module graph)
│   └── ui/                   # UI components
├── apps/
│   ├── cli/                  # CLI entry, composition
│   ├── web/                  # Web app (Vite, SSR)
│   └── headless/             # Headless runner
├── experimental/
│   └── agent-team/           # Flat teams, mailbox, task DAG (single-process)
├── bundle/
│   ├── base/                 # Core bundle (dsh-base)
│   ├── web-app/              # Web bundle
│   └── headless/             # Headless bundle
├── vendor/
│   └── cosmokit/             # Foreign deps
└── enterprise/               # ← TO BE CREATED
```

### Confirmed DSH Primitives (Ready to Extend)

| Primitive | Package | Extension Point |
|-----------|---------|-----------------|
| **Capability Seams** | All `ctx.*` services | New providers via profile |
| **Event-Sourced Session** | `core/session` | New event types, hash chain |
| **Cordis Plugin System** | All packages | `ctx.effect()`, declarative config |
| **Profile/Bundle Composition** | `bundle/`, `apps/cli/composition.md` | New enterprise profile |
| **Scope Isolation** | `dsh-scope` | Per-agent skills/memory/policy |
| **Persistence Coordinator** | `session-persistence` | New backends (PostgreSQL, WORM) |
| **Subagent Providers** | `core/subagent` | New providers (K8s, remote) |
| **Approval/Interaction** | `core/tools` waterfall, `ctx.approval` | Multi-party workflows |
| **Agent Loop** | `core/agent-loop` | Verification phase, compaction |
| **Tool Registry** | `core/tools` | Skills, CLI connectors, guards |

---

## Facility Codebase Reality (from GitHub API Investigation)

### Verified Package Structure

```
packages/
├── core/                     # Shared primitives (audit, crypto, ids, permissions, pricing, receipts, roles)
├── harness/                  # Chain types (product/research), session protocol, validation
├── run-objective/            # Objective execution with state machine
├── mcp/                      # MCP server/client
├── db/                       # PostgreSQL schema (organizations, projects, runs, kb, guards, providers, budgets)
├── sdk/                      # TypeScript SDK
├── cli/                      # Standalone installer (facility.mjs)
└── runner/                   # Single binary runner with phases

services/
├── api/                      # Control plane API (organizations, projects, runs, kb, guards)
├── gateway/                  # Model gateway (virtual keys, budgets, envelopes, auth modes)
└── runner/                   # Runner service
```

### Confirmed Facility Primitives

| Primitive | Package | Key Feature |
|-----------|---------|-------------|
| **Artifact Chains** | `harness/` | Signal→Decision→Task→Verification, Hypothesis→Experiment→Finding |
| **Session Protocol** | `harness/session.ts` | CHARTER/ACTIVE/TOOLS, ACTIVE capped to 4 fields |
| **Guards** | `core/permissions.ts`, `core/detect.ts` | Markdown links, Actions pinned, KB integrity, deterministic |
| **Two-Lane Delivery** | `cli/`, `services/api/` | Repo lane (vendored CI) + Platform lane (isolated sandbox) |
| **Runner Phases** | `runner/src/phases.ts` | bootstrap→workspace→runtime→package_install→provision→agent→capture→acceptance→delivery |
| **Model Gateway** | `services/gateway/` | Virtual keys, budgets, envelopes, auth modes (WIF, Bedrock, Vertex, API-key, OAuth) |
| **Receipts** | `core/receipts.ts` | Hash-chained run summaries |
| **Watchtower** | `api/` background jobs | Outcome joining, acceptance rate, cost tracking |
| **Virtual Keys** | `gateway/` | Project/run/agent scoped, TTL, budgets, auto-revoke |
| **Skills** | `cli/templates/skills/` | Versioned, content-addressed, graduation from feedback |
| **CLI Installer** | `cli/index.mjs` | `facility init/doctor/bootstrap` |

---

## Critical Gap Analysis

| Capability | DSH Status | Facility Status | Gap |
|------------|------------|-----------------|-----|
| **Structured Knowledge** | ❌ Ad-hoc session events | ✅ Artifact chains (S/D/T/V, H/E/F) | **Major** |
| **Session Protocol** | ✅ Event-sourced, surface folding | ✅ CHARTER/ACTIVE/TOOLS (4-field ACTIVE) | **Minor** - standardize |
| **Deterministic Guards** | ❌ Tool guards only | ✅ Markdown links, Actions pinned, KB integrity, graduation | **Major** |
| **Two-Lane Execution** | ❌ Single execution model | ✅ Repo lane (vendored CI) + Platform lane | **Major** |
| **Model Gateway** | ❌ Direct LLM calls | ✅ Virtual keys, budgets, envelopes, multi-auth | **Major** |
| **Sandbox Runner** | ❌ Agent loop in-process | ✅ Runner binary with phases, telemetry | **Major** |
| **Receipts/Watchtower** | ❌ No outcome tracking | ✅ Hash-chained receipts, outcome joining | **Major** |
| **Virtual Keys/Budgets** | ❌ No model gateway | ✅ Project/run/agent scoped, TTL, budgets | **Major** |
| **Skill Registry** | ❌ Ad-hoc tool registration | ✅ Versioned, content-addressed, graduation | **Major** |
| **CLI Installer** | ❌ `dsh web` only | ✅ `facility init/doctor/bootstrap` | **Major** |
| **MCP Server** | ❌ Client only | ✅ Server + client | **Minor** |

---

## Unified Architecture: DSH Enterprise + Facility Patterns

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    DSH ENTERPRISE + FACILITY ARCHITECTURE                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    CONTROL PLANE (Facility-inspired)                │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌───────────┐  │   │
│  │  │   Gateway   │  │    API      │  │   Watchtower│  │   CLI     │  │   │
│  │  │  (Gateway)  │  │  (Control)  │  │  (Outcomes) │  │ (Installer)│  │   │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  └───────────┘  │   │
│  │         │              │              │              │             │   │
│  │  ┌──────┴──────────────┴──────────────┴──────────────┴────────┐   │   │
│  │  │              POSTGRESQL (Facility schema + DSH session)     │   │   │
│  │  │  Orgs, Projects, Runs, KB Chains, Guards, Budgets, Keys    │   │   │
│  │  └────────────────────────────────────────────────────────────┘   │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                              │                                          │
│         ┌────────────────────┼────────────────────┐                   │
│         ▼                    ▼                    ▼                   │
│  ┌─────────────┐      ┌─────────────┐      ┌─────────────┐           │
│  │  REPO LANE  │      │ PLATFORM LANE │    │  LOCAL-FIRST  │          │
│  │  (Facility) │      │  (DSH Core)   │    │  (Perplexity) │          │
│  ├─────────────┤      ├─────────────┤      ├─────────────┤           │
│  │ • Vendored  │      │ • Isolated    │    │ • Local model │          │
│  │   GitHub    │      │   sandbox     │    │ • Local mem   │          │
│  │   workflows │      │ • DSH gateway │    │ • Local code  │          │
│  │ • Repo CI   │      │ • Streaming   │    │   intel       │          │
│  │ • Repo creds│      │ • Central     │    │ • Mandatory   │          │
│  │ • No deps   │      │   creds       │    │   sandbox     │          │
│  │ • facility  │      │ • Budgets     │    │ • Context     │          │
│  │   init      │      │ • Watchtower  │    │   compaction  │          │
│  └─────────────┘      └─────────────┘      └─────────────┘           │
│         │                    │                    │                  │
│         └────────────────────┴────────────────────┘                  │
│                              │                                        │
│         ┌─────────────────────────────────────────────────────────┐  │
│         │              DSH CORE (Enhanced with Facility patterns) │  │
│         │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌───────────────┐ │  │
│         │  │ Session │ │  Agent  │ │  Tools  │ │   Knowledge   │ │  │
│         │  │+Chains  │ │+Verification│ │+Guards│ │  +Chains      │ │  │
│         │  │+Protocol│ │+Compaction│ │+Skills│ │  +Guards      │ │  │
│         │  └─────────┘ └─────────┘ └─────────┘ └───────────────┘ │  │
│         │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌───────────────┐ │  │
│         │  │ Subagent│ │ Workflow│ │ Memory  │ │   Skills      │ │  │
│         │  │+Runner  │ │+Gates   │ │+Chains  │ │  +Graduation  │ │  │
│         │  └─────────┘ └─────────────┘ └─────────┘ └───────────┘ │  │
│         └─────────────────────────────────────────────────────────┘  │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Concrete Package Additions (Facility-Inspired)

### 1. `packages/enterprise/knowledge-chains/` — **Artifact Chains**

```typescript
// From Facility: harness/src/chain.ts
// DSH Application: Replace ad-hoc memory with governed chains
export const productChain = {
  types: {
    S: { name: 'Signal', parents: [], schema: { source, evidence_refs } },
    D: { name: 'Decision', parents: ['S'], schema: { status, decided_by } },
    T: { name: 'Task', parents: ['D'], schema: { status, wsjf } },
    V: { name: 'Verification', parents: ['T'], schema: { task, outcome } },
    R: { name: 'Reference', parents: [], schema: { area } },
  }
};

export const researchChain = {
  types: {
    H: { name: 'Hypothesis', parents: [] },
    E: { name: 'Experiment', parents: ['H'] },
    F: { name: 'Finding', parents: ['E'] },
    L: { name: 'Literature', parents: [] },
    CR: { name: 'Challenge Review', parents: [] },
    SR: { name: 'Strategic Review', parents: ['CR'] },
  }
};
```

### 2. `packages/enterprise/agent-session/` — **Session Protocol**

```markdown
# From Facility: harness/src/session.ts → SESSION.md
# DSH Application: Standardize DSH agent sessions

## DSH Session Recovery Protocol
1. Read CHARTER.md (project constitution, constraints, stop conditions)
2. Read ACTIVE.md (Objective, Next Step, Blocker, Links — 4 fields max)
3. Read relevant KB entries linked from ACTIVE
4. Cross-check coherence; treat disagreement as blocker
5. Search KB before creating anything
6. Conclusions must land in KB before session ends

## ACTIVE.md Format (strictly 4 fields)
## Objective
## Next Step
## Blocker
## Links
```

### 3. `packages/enterprise/guards/` — **Deterministic Guards**

```typescript
// From Facility: core/permissions.ts, core/detect.ts
// DSH Application: Extend ctx.tools.guard() with deterministic checks

export const builtinGuards: Guard[] = [
  { id: 'markdown-links', run: checkMarkdownLinks, severity: 'error' },
  { id: 'actions-pinned', run: checkActionsPinned, severity: 'error' },
  { id: 'kb-backlinks', run: checkKbBacklinks, severity: 'warning' },
  { id: 'active-heading', run: checkActiveHeadings, severity: 'error' },
  { id: 'decision-immutability', run: checkDecisionImmutability, severity: 'error' },
  { id: 'dsh-link-lint', run: checkDshMarkdownLinks, severity: 'error' },  // DSH-specific
];

export class GuardRunner extends Service {
  static inject = ['tools', 'sessions', 'memory'];
  
  async runGuards(guardIds: string[], context: GuardContext): Promise<GuardResult[]> { ... }
  
  async graduateFeedback(feedback: string): Promise<Guard> {
    // LLM-assisted: convert recurring prose feedback into deterministic guard
  }
}
```

### 4. `packages/enterprise/execution-lanes/` — **Two-Lane Execution**

```typescript
// From Facility: cli/ (repo lane) + services/api/ (platform lane)
// DSH Application: Formalize two execution modes

export type ExecutionLane = 'repo' | 'platform';

export interface LaneConfig {
  lane: ExecutionLane;
  sandbox: SandboxConfig;
  credentials: 'repo' | 'platform-gateway';
  streaming: boolean;
  steering: boolean;
  budgets: BudgetConfig;
  ciIntegration: 'github' | 'gitlab' | 'none';
}

// Repo Lane: vendored GitHub workflows, repo's CI, repo's credentials
// Platform Lane: DSH sandbox, DSH gateway credentials, streaming, budgets
```

### 5. `packages/enterprise/model-gateway/` — **Model Gateway**

```typescript
// From Facility: services/gateway/src/
// DSH Application: ctx.gateway seam for all cloud model calls

export class ModelGateway extends Service {
  static inject = ['credentials', 'audit', 'objectStore'];
  
  // Virtual keys
  async issueVirtualKey(params: {
    projectId: string; runId: string; agentId: string;
    scopes: string[]; ttl: number; budgetUsd?: number;
  }): Promise<VirtualKey> { ... }
  
  // Auth modes (Facility: WIF, Bedrock, Vertex, API-key, OAuth)
  async exchangeWifToken(githubOidcToken: string): Promise<AnthropicToken> { ... }
  async exchangeBedrockToken(awsRole: string): Promise<BedrockToken> { ... }
  async exchangeVertexToken(gcpWip: string): Promise<VertexToken> { ... }
  
  // Budgets
  async checkBudget(projectId: string, estimatedCost: number): Promise<boolean> { ... }
  async recordUsage(projectId: string, usage: UsageRecord): Promise<void> { ... }
  
  // Envelope capture (request/response to object store)
  async captureEnvelope(request: Request, response: Response): Promise<void> { ... }
}
```

### 5. `packages/enterprise/sandbox-runner/` — **Sandbox Runner**

```typescript
// From Facility: runner/src/index.ts + phases.ts
// DSH Application: DSH Sandbox Runner as first-class component

export class DshSandboxRunner extends Service {
  static inject = ['sandbox', 'sessions', 'audit', 'gateway'];
  
  async run(bundle: RunBundle): Promise<RunResult> {
    const phases = new PhaseRecorder(this.ctx.audit);
    
    await phases.measure('bootstrap', async () => {
      const hello = await this.api.post(`/internal/runs/${runId}/hello`);
      bundle = await this.fetchBundle(hello.bundleUrl);
    });
    
    await phases.measure('workspace', () => this.setupWorkspace(bundle));
    await phases.measure('runtime', () => this.setupRuntime(bundle));
    await phases.measure('package_install', () => this.installPackages(bundle));
    await phases.measure('provision', () => this.runProvision(bundle));
    
    const result = await phases.measure('agent', () => this.runAgent(bundle));
    
    await phases.measure('result_capture', () => this.captureResult(result));
    await phases.measure('acceptance', () => this.runAcceptanceChecks(bundle));
    await phases.measure('delivery', () => this.deliver(result));
    
    return result;
  }
  
  private async runAgent(bundle: RunBundle): Promise<AgentResult> {
    switch (bundle.engine) {
      case 'claude_code': return this.runClaudeCode(bundle);
      case 'codex': return this.runCodex(bundle);
      case 'byo': return this.runByo(bundle);
      case 'dsh_native': return this.runDshNative(bundle);  // NEW: DSH's own agent loop
    }
  }
  
  // Facility's excellent secret redaction at event boundary
  private redactSecrets(event: RunEvent): RunEvent { ... }
}
```

### 6. `packages/enterprise/watchtower/` — **Receipts + Watchtower**

```typescript
// From Facility: core/receipts.ts + api background jobs
// DSH Application: Outcome tracking + compliance reporting

export class Watchtower extends Service {
  static inject = ['sessions', 'audit', 'scheduler'];
  
  async generateReceipt(runId: string): Promise<Receipt> {
    // Hash-chain: prev_hash + run_summary + outcome
    // Links: run_id, session_id, agent_id, outcome, cost, duration
  }
  
  async runWatchtowerJob(): Promise<void> {
    // For each completed run without outcome:
    //   - Check GitHub: PR merged? CI passed? Human approved?
    //   - Record outcome, update receipt
    //   - Aggregate: acceptance_rate, one_shot_rate, avg_cost, recurring_failures
    //   - Alert on anomalies
  }
}
```

### 7. `packages/enterprise/skills/` — **Skill Registry + Graduation**

```typescript
// From Facility: cli/templates/skills/ + graduation logic
// DSH Application: Formalize skill system with graduation

export class SkillRegistry extends Service {
  static inject = ['tools', 'codeIntel', 'memory', 'guards'];
  
  async loadSkill(skillId: string, agent: Agent): Promise<void> { ... }
  async autoLoadSkills(agent: Agent, context: SkillContext): Promise<string[]> { ... }
  
  async graduateFeedback(feedback: string): Promise<Skill> {
    // Convert recurring review feedback into versioned skill + guard
  }
}
```

### 8. `packages/enterprise/cli/` — **DSH Enterprise CLI**

```bash
# From Facility: cli/index.mjs
# DSH Application: Repo onboarding + governance

# dsh-enterprise init
#   - Detects package manager, default branch, checks
#   - Writes .dsh.json (reproducible config)
#   - Generates GitHub workflows: plan, build, review, CI-repair, security, watchtower
#   - Writes STANDARD.md, AGENTS.md, CLAUDE.md (managed blocks)
#   - Installs skills, guards, hooks
#   - Optional: --preview-image, --preview-command

# dsh-enterprise doctor --run-guards --github
#   - Validates workflows, guards, GitHub config

# dsh-enterprise bootstrap --org-name --github-installation-id ...
#   - Binds instance to GitHub org + App installation
```

### 8. `packages/enterprise/db-schema/` — **PostgreSQL Schema (Facility + DSH)**

```sql
-- From Facility: packages/db/src/schema.ts
-- DSH Application: Merge with DSH session schema

-- Facility tables to adopt:
CREATE TABLE kb_entries (...);           -- Chain types, frontmatter, links
CREATE TABLE kb_links (...);             -- Directed edges with backlink validation
CREATE TABLE guards (...);               -- Config, fingerprint, upgrade status
CREATE TABLE providers (...);            -- Auth modes (WIF/Bedrock/Vertex/API-key/OAuth)
CREATE TABLE budgets (...);              -- Period, limit, spend, alert thresholds
CREATE TABLE virtual_keys (...);         -- Project/run/agent scoped, TTL, scopes
CREATE TABLE envelopes (...);            -- Request/response capture
CREATE TABLE receipts (...);             -- Hash-chained run summaries
CREATE TABLE fingerprints (...);         -- File path, content hash
CREATE TABLE run_events (...);           -- Hash-chained audit log (extends DSH session)

-- DSH tables to keep:
CREATE TABLE sessions (...);             -- Existing DSH session schema
CREATE TABLE session_events (...);       -- Existing DSH event schema
```

---

## Integration Map: Facility → DSH Enterprise

| Facility Component | DSH Enterprise Package | Status |
|-------------------|------------------------|--------|
| **Artifact Chains** | `enterprise/knowledge-chains` | 🆕 New |
| **Harness Session Protocol** | `enterprise/agent-session` | 🆕 New |
| **Guards Framework** | `enterprise/guards` | 🆕 New |
| **Two-Lane Execution** | `enterprise/execution-lanes` | 🆕 New |
| **Sandbox Runner** | `enterprise/sandbox-runner` | 🆕 New (extends `runner/`) |
| **Model Gateway** | `enterprise/model-gateway` | 🆕 New |
| **PostgreSQL Schema** | `enterprise/db-schema` | Extends `session-persistence-postgres` |
| **CLI Installer** | `enterprise/cli` | 🆕 New |
| **Skill Registry** | `enterprise/skills` | Extends `skill-system` |
| **Watchtower/Receipts** | `enterprise/watchtower` | 🆕 New |
| **Audit Hash Chain** | `enterprise/audit` | ✅ Already planned |
| **Virtual Keys/Budgets** | `enterprise/secrets` + `model-gateway` | ✅ Already planned |
| **MCP Server** | `enterprise/mcp-server` | 🆕 New (Facility has `packages/mcp`) |

---

## Priority Adoption Order

| Priority | Facility Feature | DSH Package | Effort |
|----------|-----------------|-------------|--------|
| **P0** | Artifact Chains + Session Protocol | `knowledge-chains` + `agent-session` | 2 weeks |
| **P0** | Guards Framework | `guards` | 2 weeks |
| **P0** | Sandbox Runner (phases, redaction) | `sandbox-runner` | 3 weeks |
| **P1** | Model Gateway (virtual keys, budgets) | `model-gateway` | 3 weeks |
| **P1** | Two-Lane Execution | `execution-lanes` | 2 weeks |
| **P1** | Skill Registry + Graduation | `skills` | 2 weeks |
| **P2** | CLI Installer + Doctor | `cli` | 2 weeks |
| **P2** | Watchtower + Receipts | `watchtower` | 2 weeks |
| **P2** | MCP Server | `mcp-server` | 1 week |
| **P3** | DB Schema Migration | `db-schema` | 1 week |

---

## Updated Phase Plan (Facility-Aligned)

| Phase | Focus | Weeks | Key Deliverables |
|-------|-------|-------|------------------|
| **0** | **Local-First Foundation** | 1-3 | Mandatory sandbox, local LLM (Ollama/vLLM), context compaction, model profiles (Qwen/Nemotron) |
| **1** | **Knowledge & Session Core** | 3-6 | **Artifact Chains**, **Session Protocol** (CHARTER/ACTIVE), **Guards Framework**, **Skill System** |
| **2** | **Intelligence & Verification** | 6-9 | **Code Intel**, **Tiered Memory**, **Self-Verification**, **Advisor Escalation** (PII-gated) |
| **3** | **Facility Control Plane** | 9-13 | **Model Gateway** (virtual keys, budgets, envelopes), **Sandbox Runner** (phases, telemetry), **Two-Lane Execution** |
| **4** | **Governance & Outcomes** | 13-17 | **Guards Framework** (graduation), **Watchtower + Receipts**, **CLI Installer**, **MCP Server** |
| **5** | **Post-Training & Hardening** | 17-22 | **Post-Training Pipeline**, **Benchmark Validation**, **Load Testing**, **Security Audit** |

---

## DSH-Native Implementation Rules (Unchanged)

| Rule | Application |
|------|-------------|
| **Every feature = Cordis plugin** | All new packages register via `ctx.effect()` |
| **Capability seams only** | New features plug into `ctx.tools`, `ctx.llm`, `ctx.sandbox`, `ctx.approval`, `ctx.memory`, `ctx.codeIntel`, `ctx.skills`, `ctx.gateway` |
| **Profile composition** | Enterprise profile extends base; repo lane uses CLI installer |
| **Scope isolation** | Skills/memory/policy per-agent via `dsh-scope` |
| **Event-sourced everything** | All state changes via `session/event` + `audit/event` |
| **Schemastery config** | All config via `zod` schemas with validation |
| **Branded types** | All IDs (`SessionId`, `UserId`, `RunId`, `ProjectId`, `SkillId`) |
| **Bilingual docs** | README.md + README.zh.md for every package |
| **Vitest + snapshot tests** | 100% coverage on `packages/*/*/src` |

---

## Validation Benchmarks (Facility + Perplexity Aligned)

```bash
# Facility-inspired benchmarks
pnpm test:benchmark:guards           # All builtin guards pass
pnpm test:benchmark:session-protocol # CHARTER/ACTIVE round-trip
pnpm test:benchmark:chains           # Chain validation (S→D→T→V)
pnpm test:benchmark:guards-graduation # Feedback → guard conversion

# Perplexity benchmarks
pnpm test:benchmark:browsecomp       # Target: ≥65% (Facility: 66.7%)
pnpm test:benchmark:parsebench       # Target: ≥60% (Facility: 65.1%)
pnpm test:benchmark:terminal-bench   # Target: ≥60% local, ≥75% w/ advisor

# DSH Enterprise benchmarks
pnpm test:benchmark:two-lane         # Repo lane + Platform lane parity
pnpm test:benchmark:gateway          # Virtual keys, budgets, envelopes
pnpm test:benchmark:watchtower       # Outcome joining, receipts
pnpm test:benchmark:cli-installer    # Init/doctor/bootstrap on fresh repo
```

---

## Summary: The Unified Vision

| Facility Proves | DSH Adopts | Implementation |
|-----------------|------------|----------------|
| **Artifact chains govern knowledge** | `knowledge-chains` + `agent-session` | Phase 1 |
| **Deterministic guards > prose review** | `guards` + graduation | Phase 1, 4 |
| **Two-lane delivery (repo + platform)** | `execution-lanes` + `cli` | Phase 3, 4 |
| **Model gateway = virtual keys + budgets** | `model-gateway` | Phase 3 |
| **Runner phases = observable execution** | `sandbox-runner` | Phase 3 |
| **Receipts + Watchtower = outcome tracking** | `watchtower` | Phase 4 |
| **Skill graduation = institutional learning** | `skills` | Phase 1, 4 |
| **CLI installer = zero-friction onboarding** | `cli` | Phase 4 |

**This is a single unified plan** — not two plans. Every Facility pattern maps to a DSH Cordis plugin that composes via the existing profile system. The DSH codebase already has all the primitives; Facility shows how to compose them into a governance-first platform.
