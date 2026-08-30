# DSH Enterprise — Implementation Status

**Date:** 2026-08-30
**Status:** Phase 4 complete — entering Phase 5
**Branch:** `master` at `2d806f4` (guards-iit fully implemented)

---

## Table of Contents

1. [Branch & commit state](#1--branches-et-commits)
2. [What was built in this session](#2--ce-qui-a-été-construit)
3. [Phase completion map](#3--complétion-des-phases)
4. [Package status — core](#4--packages-opérationnels--stubs)
5. [Enterprise plugins status](#5--enterprise-plugins-21-packages)
6. [DEFERRED.md ceiling map](#6--deferredmd-- ceilings)
7. [Phase 5 — what's next](#7--phase-5--prochaines-étapes)
8. [Facility partial ports remaining](#8--facility-partial-ports)
9. [Reference files](#9--fichiers-de-référence)

---

## 1. � Branch et commits

### Branches

| Branche | HEAD | Relation | Packages |
|---------|------|----------|----------|
| `master` | `2d806f4` | base + all work | 12 + 21 enterprise |
| `regulated-hardening` | `de75973` | divergée (historique différent) | même structure |

### Ce qui a changé depuis `b19a10f` (merge iit-advanced-guards)

```
iit-core/src/bindgen.rs                      +54  calculate_ces_js WASM export
guards-iit/src/guard-runner.ts               +89 -41  WASM wiring + policy/evaluate emit
guards-iit/src/guards/free-energy.ts         NEW   gaussian surprise guard
guards-iit/src/guards/causal-emergence.ts     NEW   determinism/degeneracy guard
guards-iit/src/guards/mip-shift.ts           NEW   MIP deviation guard
guards-iit/src/session-events.ts             +27  policy/evaluate SessionEventMap
guards-iit/src/__mocks__/iit-core-pkg.ts    +24  WASM mock complet
guards-iit/tsconfig.json                        修正  extends tsconfig.base.json
guards-iit/package.json                          +@deepseek-ai/dsh-session dep
Total: +12 commits, +577 lignes
```

---

## 2. Ce qui a été construit

### Session IIT Guards (SDD — 12 commits, 68 tests, 100% coverage)

| Fichier | Ce qu'on a fait |
|---------|----------------|
| `iit-core/src/bindgen.rs` | `calculate_ces_js` → `ruvector_consciousness::ces::compute_ces` |
| `guard-runner.ts` | 4 WASM méthodes filtées (`phi_trajectory_wasm`, `ignition_score_wasm`, `teloids_compile/evaluate_wasm`), `performance.now()`, `policy/evaluate` emit |
| `guards/free-energy.ts` | `gaussian_surprise` EMA sigma, window eviction, `minPhi` wiring |
| `guards/causal-emergence.ts` | determinism/degeneracy/effectiveness formulas |
| `guards/mip-shift.ts` | rolling MIP mean/std, deviation sigma |
| `session-events.ts` | `policy/evaluate` SessionEventMap type |
| `__mocks__/iit-core-pkg.ts` | WASM mock complet + `mip: number` shape fix |
| `__mocks__/schemastery.ts` | `enumChainable.enum()` méthode ajoutée |
| `cache.ts` | `first` undefined guard, dead `if(first)` removed |
| `tsconfig.json` | extends `tsconfig.base.json` (fix TS2664) |

---

## 3. Complétion des phases

| Phase | Objectif | Status | Notes |
|-------|---------|--------|-------|
| Phase 0 | Chains + Guard Skeleton | ✅ Complete | `chains`, `session-protocol`, `sandbox-runner`, `gateway`, `watchtower` |
| Phase 1 | Rust Core + First IIT Guards | ✅ Complete | 8 guards total: phi-threshold, ces-fingerprint, boundary-frontier, catastrophe-cusp, attractor-ews, phi-trajectory, workspace-ignition, effect-ethos |
| Phase 2 | Gateway + Runner + Watchtower | ✅ (in-memory) | PG-backed quand watchtower migration 002 lands |
| Phase 0.5 | Regulated P0 (auth, compliance, sovereignty, RBAC) | ✅ Complete | `dsh-permissions`, `dsh-audit-log`, `dsh-policy-engine` |
| Phase 3 | CLI / MCP / SDK | ⚠️ Partial | CLI stub existe |
| **Phase 4** | **Benchmarking + Grafana + Nightly bench** | **✅ Complete** | `BENCHMARKING.md`, `nightly-bench.yml`, Grafana dashboards, `BenchmarkEnvelope` dual-write |
| Phase 4.5 | Regulated P1 (resilience, model-registry, air-gapped Ollama) | ⚠️ Partial | `dsh-local-llm`, `model-registry` stubs |
| **Phase 5** | **otel + cost-tracker + sla-monitor + secrets** | 🔲 Next | Voir §7 |

---

## 4. Packages opérationnels / stubs

### 4.1 Core packages

| Package | Status | Stub? | Tests |
|---------|--------|--------|-------|
| `chains` | ✅ | Non | 1 |
| `cli` | ⚠️ Stub | Oui — init + doctor basiques | 1 |
| `gateway` | ✅ (in-memory) | Partial | 1 |
| `guards-iit` | ✅ | **Non** — 8 guards + WASM | **68** |
| `iit-core` | ⚠️ Partial | Rust stubs pour catastrophe/attractor/boundary (WASM mock) | 0 |
| `mcp` | ⚠️ Stub | Oui — NotImplemented | 1 |
| `sandbox-runner` | ✅ | Non | 1 |
| `sdk` | ✅ | Non (fallback) | 1 |
| `session-protocol` | ✅ | Non | 1 |
| `watchtower` | ✅ (in-memory) | Partial | 3 |

### 4.2 Enterprise plugins (21 packages)

| Package | Status | Stub? | Tests | DEFERRED ceiling |
|---------|--------|--------|-------|-----------------|
| `auth` | ✅ | Non | 1 | — |
| `compliance-erasure` | ✅ | Non | 1 | — |
| `dsh-audit-log` | ✅ | Non | 51 | ponytail: simple hash → crypto.subtle |
| `dsh-cost-tracker` | ⚠️ Stub | Oui — in-memory Map | 1 | watchtower PG |
| `dsh-git-worktree` | ⚠️ Stub | Oui — git worktree stub | 1 | cli --with worktree |
| `dsh-library` | ⚠️ Stub | Oui — .dsh/library stub | 1 | fs.read quand populated |
| `dsh-local-llm` | ⚠️ Stub | Oui — Ollama stub | 1 | Ollama in air-gapped K8s |
| `dsh-mneme` | ⚠️ Stub | Oui — better-sqlite3 stub | 1 | better-sqlite3 ou PG |
| `dsh-model-router` | ⚠️ Stub | Oui — cost/latency stub | 1 | gateway PG |
| `dsh-otel` | ⚠️ **Stub vide** | Oui — pas de spans réels | 1 | wrap gateway/guards/watchtower |
| `dsh-permissions` | ✅ | Non | 38 | — |
| `dsh-policy-engine` | ⚠️ Stub | Oui — OPA mock | 1 | vrai OPA-WASM |
| `dsh-pr-agent` | ⚠️ Stub | Oui — LLM review stub | 1 | PR open automation |
| `dsh-release` | ⚠️ Stub | Oui — CycloneDX/cosign stub | 1 | version bump → SBOM → Helm |
| `dsh-secrets` | ⚠️ Not scaffolded | — | 0 | Vault/1Password injection |
| `dsh-sla-monitor` | ⚠️ Stub | Oui | 1 | gateway-p99 <2s, guard-block <1% |
| `kb-rag` | ⚠️ Stub | Oui — substring search | 1 | PG pgvector cosine |
| `model-registry` | ⚠️ Stub | Oui — Map stub | 2 | gateway PG migration 002 |
| `resilience` | ⚠️ Stub | Oui | 1 | PITR WAL + R2 replica |
| `sbom` | ⚠️ Stub | Oui | 1 | CycloneDX + Cosign |
| `sovereignty` | ⚠️ Stub | Oui | 1 | region egress deny rules |
| `utils` | ✅ | Non | 1 | — |

**Bilan:** 7/21 non-stubs (auth, compliance-erasure, dsh-audit-log, dsh-permissions, guards-iit, chains, utils), 14 stubs with documented ceilings.

---

## 5. DEFERRED.md — ceilings

### 5.1 Rust ceilings (ponytail)

| File:Line | Ceiling | Lift when |
|-----------|---------|-----------|
| `iit-core/src/catastrophe.rs:7` | pure Rust O(n) normal equations | ill-conditioned fits on real trajectories |
| `iit-core/src/attractor.rs:7` | pure std O(n) + power iter 500 | `ews_ac1` > 50ms at n=10k |
| `iit-core/src/boundary.rs:16` | reuse BipartitionIter | `enumerate_frontiers` at n=16 > 1s |
| `sandbox-runner/src/phases.ts:7` | in-memory emit | Postgres `run_events` table lands |
| `gateway/src/budgets.ts:7` | in-memory spendCounters | watchtower PG |
| `watchtower/src/job.ts:6` | in-memory store | watchtower PG |
| `watchtower/src/job.ts:114` | bench stubs | Postgres `run_events` available |

### 5.2 TypeScript ceilings (ponytail)

| File:Line | Ceiling | Lift when |
|-----------|---------|-----------|
| `guards-iit/src/bridge.ts:29` | 5s timeout + uv run python | `services/ict-bridge` FastAPI sidecar deployed |
| `sdk/src/client.ts:4` | stub fallback | `pnpm install` with facility + ruvector |
| `sdk/src/client.ts:60` | pure-JS fallback | SDK in browser without node:crypto |
| `dsh-audit-log/src/plugin.ts:21` | simple deterministic hash | crypto.subtle + SHA-256 WORM |
| `kb-rag/src/plugin.ts:25` | in-memory substring | PG pgvector cosine |
| `dsh-library/src/plugin.ts:25` | in-memory .dsh/library stub | fs.read quand populated |
| `dsh-mneme/src/plugin.ts:19` | in-memory Map | better-sqlite3 ou PG |
| `dsh-local-llm/src/plugin.ts:9` | in-memory Ollama stub | Ollama in air-gapped K8s |
| `dsh-model-router/src/plugin.ts:9` | in-memory router stub | gateway PG + cost/latency |
| `model-registry/src/plugin.ts:6` | in-memory Map | gateway PG migration 002 |

---

## 6. Facility partial ports remaining

| Module Facility | Status | Lift condition |
|----------------|--------|----------------|
| `core/detect.ts` | Stub vide | `guards-iit` besoin réel de runtime context |
| `core/pricing.ts` | Non porté | `dsh-cost-tracker` sort du stub |
| `core/provider-auth.ts` | Stub NotImplemented | `dsh-model-router` ou `dsh-local-llm` besoin WIF |
| `services/gateway/metering.ts` | Partiel — costCents() | watchtower migration 002 |
| `services/gateway/envelope-store.ts` | Types uniquement | `dsh-audit-log` besoin persister envelopes |
| `core/permissions.ts` | Lint markdown-links | `auth` plugin config z.object corrigée |

---

## 7. Phase 5 — Prochaines étapes

### 7.1 `dsh-otel` — P0 (observabilité, débloque tout)

**Pourquoi en premier:** `guards-iit/src/telemetry.ts` émet déjà `iit.phi`, `iit.ews`, `iit.latency` — mais via un stub. `dsh-otel` wire ces metrics à une vraie OTEL pipeline.

**Ce qui existe:** `packages/enterprise/dsh-otel/src/plugin.ts` (stub), `telemetry.ts` dans guards-iit.

**Ce qu'il faut faire:**
- Remplacer le stub par `@opentelemetry/api` + `@opentelemetry/sdk-node`
- Wrap `ctx.llm`, `ctx.tools.guard`, `ctx.sandbox.run` avec spans
- Ajouter histogrammes pour `iit.phi`, `iit.ews`, `iit.latency`
- Tests: 1 span emitted par guard run

**Dépendances:** Aucune (self-contained)

---

### 7.2 `dsh-cost-tracker` + `dsh-sla-monitor` — P1 (PG, dépendance croisée)

**Pourquoi ensemble:** Les deux需要的 PG `run_events` table (watchtower migration 002, existe).

**`dsh-cost-tracker`:**
- Remplacer in-memory Map par `INSERT INTO spend_events` sur `run_events`
- Aggregats par `org_id/project_id/model` window
- Porter `core/pricing.ts` de Facility

**`dsh-sla-monitor`:**
- Query `run_events` pour `gateway_p99_ms`, `guard_block_rate`
- Alertes when `gateway_p99 > 2000ms` ou `guard_block_rate > 0.01`

**Dépendances:** watchtower PG migration 002 ✅ (exists)

---

### 7.3 `dsh-secrets` — P1 (Vault/1Password)

**Pourquoi独立:** Pas de PG, pas d'autre plugin.

- Vault ou 1Password injection pour `gateway` + `model-registry`
- `ctx.get('secrets').get('PROVIDER_API_KEY')`

**Dépendances:** Vault/1Password deployed

---

### 7.4 Remaining P2 plugins (can run in parallel)

| Package | Action |
|---------|--------|
| `dsh-git-worktree` | `cli --with worktree ../worktrees/` |
| `dsh-pr-agent` | Auto-review security/style/test on PR open |
| `dsh-release` | version bump → SBOM → Cosign → Helm |
| `dsh-mneme` | `better-sqlite3` ou switch vers PG |
| `dsh-local-llm` | Real Ollama 7B/70B in air-gapped K8s |

---

## 8. Fichiers de référence

```
dsh-enterprise/
├── DEFERRED.md                           # tous les stubs + conditions de déblocage
├── docs/enterprise/
│   ├── SPEC.md                           # spécification officielle (zero upstream mutation)
│   ├── IMPLEMENTATION_PLAN.md            # plan d'implémentation détaillé (Phase 0-4.5)
│   ├── IMPLEMENTATION_STATUS.md          # CE FICHIER — état actuel
│   ├── BENCHMARKING.md                  # Phase 4: nightly bench + Grafana
│   ├── COMPLIANCE_MATRIX.md
│   └── CRITICAL_REVIEW.md
└── packages/
    ├── guards-iit/src/guard-runner.ts   # 8 guards + WASM bridge
    ├── iit-core/src/bindgen.rs          # calculate_ces_js WASM
    ├── enterprise/*/src/plugin.ts        # 21 plugins
    └── enterprise/dsh-otel/src/plugin.ts # STUB — next to implement
```

---

## Summary: What stays stub vs what gets built

| Stub | Lift condition | Next action |
|------|---------------|-------------|
| `dsh-otel` | none (P0) | Implementer OTEL spans |
| `dsh-cost-tracker` | watchtower PG ✅ | Implementer spendCounters in PG |
| `dsh-sla-monitor` | watchtower PG ✅ | Implementer p99/block_rate queries |
| `dsh-secrets` | Vault deployed | Scaffold + implement |
| `dsh-mneme` | better-sqlite3 ou PG | Implementer SQLite ou PG switch |
| `dsh-local-llm` | Ollama in K8s | Implementer real Ollama client |
| `dsh-model-router` | gateway PG | Implementer cost/latency router |
| `kb-rag` | PG pgvector | Implementer cosine search |
| `iit-core` Rust stubs | latency measurements | Port when >threshold |
