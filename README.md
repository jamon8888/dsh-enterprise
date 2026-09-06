# @deepseek-ai/dsh-enterprise

**IIT-Inspired Enterprise Plugins for DeepSeek Harness**

37 packages for production DeepSeek agents: 11 IIT consciousness guards (now with
RiskGate VI(t) viability prediction), 6 non-IIT constitutional/policy/resource
guards, observability, security, cost management, release automation, and more.

CI green: 397 tests, `tsc` 0 errors, guards-iit coverage 100% (Node 22 + 23).

## Why DSH Enterprise?

DSH Enterprise's differentiator is **IIT-Inspired Consciousness Guards** — 11 mathematical guards that monitor agent reasoning for markers of consciousness, agency, and alignment. Built on [iit-core WASM](https://github.com/your-org/iit-core), these guards measure:

| Guard | What it measures |
|-------|-----------------|
| Integrated Information (Φ) | Is reasoning highly integrated? |
| Free Energy Minimization | Is the agent avoiding surprise? |
| Causal Emergence | Does reasoning create new causal structure? |
| MIP Shift | Does the agent switch to focused attention? |
| Catastrophe Cusp Detection | Is the agent near a phase transition? |

These are principled measures from Integrated Information Theory, applied to AI agent safety — not heuristics.

## New in v0.1.0

- **RiskGate VI(t) viability index** on `phi-trajectory`: bounded predictive
  signal in [-1, +1] from the rolling Φ window (peak-drop + trajectory slope).
  `VI < -0.5` warns, `VI < -0.8` blocks — failure predicted *before* it occurs,
  unlike Φ itself which is only diagnostic. Thresholds configurable
  (`viabilityWarn`, `viabilityBlock`); carried on `iit-guard.decision` events.
- **guards-non-iit**: HHH constitutional judges (3-tier provider: Anthropic API
  → shared-org → offline local-rules), OPA-style regex policy rules, per-session
  rate-limit and budget guards. Runs before the IIT stack in the waterfall.
- **RBAC**: Viewer/Analyst/Operator/TenantAdmin/SuperAdmin; threshold changes
  need Operator+, block overrides need TenantAdmin+.
- **Internals docs**: [IIT guards](docs/guards-iit-internals.md) and
  [non-IIT guards](docs/guards-non-iit-internals.md) — catalog, evaluation
  order, config, providers, testing gates, gotchas.

## Plugin Catalog

### ✅ Production

| Plugin | NPM | Description |
|--------|-----|-------------|
| `guards-iit` | `@deepseek-ai/dsh-enterprise-guards-iit` | 11 IIT consciousness guards |
| `guards-non-iit` | `@deepseek-ai/dsh-enterprise-guards-non-iit` | HHH constitutional + policy + rate-limit guards |
| `dsh-otel` | `@deepseek-ai/dsh-enterprise-otel` | OpenTelemetry tracing + metrics |
| `dsh-cost-tracker` | `@deepseek-ai/dsh-enterprise-cost-tracker` | Per-org/model token spend → PostgreSQL |
| `dsh-sla-monitor` | `@deepseek-ai/dsh-enterprise-sla-monitor` | SLO gateway-p99 2s, guard-block-rate 1% |
| `dsh-secrets` | `@deepseek-ai/dsh-enterprise-secrets` | Vault/1Password injection |
| `dsh-audit-log` | `@deepseek-ai/dsh-enterprise-dsh-audit-log` | Hash-chained receipt + event mirror |
| `dsh-permissions` | `@deepseek-ai/dsh-enterprise-dsh-permissions` | RBAC + 4-eyes SoD |
| `auth` | `@deepseek-ai/dsh-enterprise-auth` | OIDC/SAML RBAC |
| `dsh-policy-engine` | `@deepseek-ai/dsh-enterprise-dsh-policy-engine` | OPA region + phi guard |
| `compliance-erasure` | `@deepseek-ai/dsh-enterprise-compliance-erasure` | GDPR tombstone without breaking hash-chain |
| `dsh-library` | `@deepseek-ai/dsh-enterprise-dsh-library` | File KB + citation |
| `dsh-git-worktree` | `@deepseek-ai/dsh-enterprise-dsh-git-worktree` | Git worktree CLI wrapper |
| `model-registry` | `@deepseek-ai/dsh-enterprise-model-registry` | AI Act compliance |
| `resilience` | `@deepseek-ai/dsh-enterprise-resilience` | PITR + DORA chaos |
| `utils` | `@deepseek-ai/dsh-enterprise-utils` | canonicalJson, hashing helpers |

### 🚧 Stub / Coming Soon

| Plugin | NPM | Lifts when |
|--------|-----|-----------|
| `dsh-mneme` | `@deepseek-ai/dsh-enterprise-dsh-mneme` | better-sqlite3 native addon lands |
| `kb-rag` | `@deepseek-ai/dsh-enterprise-kb-rag` | PostgreSQL pgvector extension installed |
| `dsh-model-router` | `@deepseek-ai/dsh-enterprise-model-router` | Gateway PG with cost/latency tables |
| `dsh-release` | `@deepseek-ai/dsh-enterprise-dsh-release` | syft + cosign installed on host |
| `dsh-pr-agent` | `@deepseek-ai/dsh-enterprise-dsh-pr-agent` | GitHub API integration |
| `dsh-local-llm` | `@deepseek-ai/dsh-enterprise-local-llm` | Ollama 7B/70B air-gapped setup |
| `sovereignty` | `@deepseek-ai/dsh-enterprise-sovereignty` | Region enforcement + air-gapped Helm |
| `sbom` | `@deepseek-ai/dsh-enterprise-sbom` | CycloneDX + SLSA gate |

## Quick Install

```bash
npm install @deepseek-ai/dsh-enterprise
```

Import all plugins via the patch file:

```yaml
# cordis.patch.yml
version: '1'
import: '@deepseek-ai/dsh-enterprise/enterprise.patch.yml'
```

Or select individual plugins:

```yaml
plugins:
  - id: guards-iit
    name: '@deepseek-ai/dsh-enterprise-guards-iit'
    config:
      threshold: 0.01
      guards:
        - phi-threshold
        - free-energy
```

## ponytail Upgrade Paths

Stubs document a ceiling. Each lifts with a specific infrastructure addition — no speculative rewrites.

| Stub | ponytail ceiling | Upgrade path |
|------|-----------------|--------------|
| `dsh-mneme` | In-memory Map | Install `better-sqlite3` native addon |
| `kb-rag` | Substring search | Install PostgreSQL + `pgvector` extension |
| `dsh-model-router` | In-memory Map | Provision gateway PostgreSQL with cost/latency tables |
| `dsh-release` | CycloneDX JSON stub | Install `syft` + `cosign` on host |
| `dsh-pr-agent` | Echo stub | GitHub App credentials + API token |

## License

MIT OR Apache-2.0. All packages are Cordis-only and library-installed.
