# DSH Enterprise — Plan Détaillé & Revue d'Implémentation

**Date:** 2026-08-29
**Status:** Work in Progress — Worktree: `iit-advanced-guards`

---

## Table des Matières

1. [État des branches et worktrees](#1--état-des-branches-et-worktrees)
2. [Packages implémentés vs stubs](#2--packages-implémentés-vs-stubs)
3. [Ce qu'on a pris de Facility](#3--ce-quon-a-pris-de-facility)
4. [Ce qu'on a pris partiellement ⚠](#4--ce-quon-a-pris-partiellement-)
5. [Ce qu'on n'a pas pris ✗](#5--ce-quon-na-pas-pris-)
6. [Prochaines étapes prioritaires](#6--prochaines-étapes-prioritaires)

---

## 1. État des branches et worktrees

### Branches

| Branche | HEAD | Relation | Packages |
|---------|------|----------|----------|
| `master` | `ad15c02` | base | 12 packages + 21 enterprise |
| `regulated-hardening` | `de75973` | divergée (historique différent) | même structure que master |
| `iit-advanced-guards` (worktree) | `c1b3e76` | 1 commit ahead of master | +3 guards, +cache.ts, +3 tests |

### Worktree `iit-advanced-guards` — ce qui diffère de master

```
guards-iit/src/guard-runner.ts        +75 -24
guards-iit/src/guards/effect-ethos.ts  NEW
guards-iit/src/guards/phi-trajectory.ts NEW
guards-iit/src/guards/workspace-ignition.ts NEW
guards-iit/src/session-events.ts      NEW
guards-iit/src/types.ts               +2
guards-iit/tests/integration.spec.ts   +108
guards-iit/tests/session-events.spec.ts +164
Total: +577 lignes
```

### Fichiers critiques de référence

| Fichier | Rôle |
|---------|------|
| `dsh-enterprise/DEFERRED.md` | Ledger de tous les stubs + conditions de déblocage |
| `dsh-enterprise/docs/enterprise/SPEC.md` | Spécification officielle (zero upstream mutation) |
| `dsh-enterprise/docs/enterprise/IMPLEMENTATION_PLAN.md` | Plan d'implémentation détaillé |
| `facility/` (clone `b150d96`) | Source de vérité pour les imports Facility |

---

## 2. Packages implémentés vs stubs

### 2.1 Packages opérationnels (pas des stubs)

| Package | Statut | Tests |
|---------|--------|-------|
| `chains` | ✅ Opérationnel | 1 |
| `cli` | ✅ Opérationnel (init + doctor) | 1 |
| `gateway` | ✅ Opérationnel (budgets in-memory) | 1 |
| `guards-iit` | ✅ Opérationnel (5 guards sur master, **8 dans worktree**) | 3 → **6** |
| `iit-core` | ⚠ Stubs Rust (catastrophe, attractor, boundary) | 0 |
| `mcp` | ⚠ Stub (NotImplemented) | 1 |
| `sandbox-runner` | ✅ Opérationnel (RunPhaseRecorder) | 1 |
| `sdk` | ✅ Opérationnel (client avec fallback) | 1 |
| `session-protocol` | ✅ Opérationnel (buildHarnessBundle) | 1 |
| `watchtower` | ✅ Opérationnel (job in-memory) | 3 |

### 2.2 Enterprise plugins (21 packages)

| Package | Statut | Stub? | Tests |
|---------|--------|-------|-------|
| `auth` | ✅ | Non | 1 |
| `compliance-erasure` | ✅ | Non | 1 |
| `dsh-audit-log` | ✅ | Non | 1 |
| `dsh-cost-tracker` | ⚠ | Oui (in-memory Map) | 1 |
| `dsh-git-worktree` | ⚠ | Oui (git worktree stub) | 1 |
| `dsh-library` | ⚠ | Oui (.dsh/library stub) | 1 |
| `dsh-local-llm` | ⚠ | Oui (Ollama stub) | 1 |
| `dsh-mneme` | ⚠ | Oui (better-sqlite3 stub) | 1 |
| `dsh-model-router` | ⚠ | Oui (cost/latency stub) | 1 |
| `dsh-otel` | ⚠ | Stub | 1 |
| `dsh-permissions` | ⚠ | Oui (RBAC pending auth fix) | 1 |
| `dsh-policy-engine` | ⚠ | Oui (OPA mock) | 1 |
| `dsh-pr-agent` | ⚠ | Oui (LLM review stub) | 1 |
| `dsh-release` | ⚠ | Oui (CycloneDX/cosign stub) | 1 |
| `dsh-sla-monitor` | ⚠ | Stub | 1 |
| `kb-rag` | ⚠ | Oui (substring search) | 1 |
| `model-registry` | ⚠ | Oui (Map stub) | 2 |
| `resilience` | ⚠ | Stub | 1 |
| `sbom` | ⚠ | Stub | 1 |
| `sovereignty` | ⚠ | Stub | 1 |
| `utils` | ✅ | Non | 1 |

**Bilan:** 4/21 non-stubs, 17/21 sont des stubs avec ceiling documenté.

---

## 3. Ce qu'on a pris de Facility

### ✅ Opérationnel (lib import)

| Facility | Import | Où |
|----------|--------|-----|
| `harness/chain.ts` | `productChain`, `researchChain`, `bundledChains`, `chainFromConfig` | `chains/src/plugin.ts` |
| `harness/session.ts` | `buildHarnessBundle` | `session-protocol/src/plugin.ts` |
| `harness/validate.ts` | `validate()` | `chains/src/invariant.ts` |

### ✅ Portage (réimplémenté avec divergence)

| Facility | Porté dans | Différence documentée |
|----------|------------|----------------------|
| `services/gateway/budgets.ts` (9941 B) | `gateway/budgets.ts` | In-memory vs Postgres |
| `runner/phases.ts` | `sandbox-runner/phases.ts` | In-memory emit vs Postgres |
| `packages/cli/init.mjs` | `cli/init.ts` | TS port,27KB |
| `services/api` (jobs) | `watchtower/job.ts` | Cordis in-process vs REST |
| `core/receipts.ts` | `watchtower/receipts.ts` | Compatible |

---

## 4. Ce qu'on a pris partiellement ⚠

### `core/detect.ts` — Runtime context

**Status:** Stub vide dans `guards-iit/ambient.d.ts`

```typescript
// Ce qui manque:
export interface RuntimeContext {
  sandbox: 'none' | 'bwrap' | 'landlock' | 'seatbelt' | 'k8s'
  os: 'linux' | 'macos' | 'windows'
  arch: 'x64' | 'arm64'
  containerized: boolean
  memoryLimitMb?: number
  networkEgress: 'full' | 'partial' | 'none'
}
export function detect(): RuntimeContext
```

**Intérêt:** Permettrait aux guards IIT de s'adapter au contexte runtime. Currently les guards fonctionnent sans savoir s'ils tournent dans un sandbox restrictif.

**Lift condition:** `guards-iit` besoin réel de runtime context pour policy-as-code.

---

### `core/pricing.ts` — Coût par modèle

**Status:** Non porté, zero occurrence

```typescript
export const PRICING: Record<string, { input: number; output: number }> = {
  'deepseek-chat': { input: 0.27, output: 1.1 },
  'deepseek-coder': { input: 0.55, output: 2.2 },
}
export function costCents(model: string, inputTokens: number, outputTokens: number): number
```

**Intérêt:**
- `dsh-cost-tracker` actuellement en stub in-memory Map
- `dsh-model-router` pourrait utiliser pour du cost-based routing
- Billing réel par équipe/projet

**Lift condition:** `dsh-cost-tracker` sort du stub (PG spendCounters).

---

### `core/provider-auth.ts` — WIF/OIDC

**Status:** Stub `NotImplemented` dans `gateway/provider-auth.ts`

```typescript
export async function getProviderToken(
  provider: 'bedrock' | 'vertex' | 'groq',
  scope?: string
): Promise<string>
// WIF token exchange — pas de static keys
```

**Intérêt:** Enterprise ne veut pas de clés API statiques. WIF = Workforce Identity Federation (OIDC).

**Lift condition:** `dsh-model-router` ou `dsh-local-llm` a besoin d'authentification provider.

---

### `services/gateway/metering.ts` — Métrologie fine

**Status:** Partiel — `costCents()` basique existe dans `gateway/metering.ts`,缺少 `MeteringStore`

```typescript
export interface MeteringRecord {
  runId: string
  orgId: string
  projectId?: string
  model: string
  inputTokens: number
  outputTokens: number
  costCents: number
  timestamp: number
}
export interface MeteringStore {
  insert(record: MeteringRecord): Promise<void>
  aggregateSpend(orgId: string, projectId: string, window: TimeWindow): Promise<SpendAgg>
}
```

**Intérêt:** Billing par utilisateur/équipe, dashboards spend temps réel.

**Lift condition:** `watchtower` migration 002 (`run_events` table).

---

### `services/gateway/envelope-store.ts` — Store d'enveloppes

**Status:** Types uniquement (`EnvelopeStore` interface)

**Intérêt:** Sessions enterprise contiennent des secrets (API keys). WORM compliance.

**Lift condition:** `dsh-audit-log` a besoin de persister les envelopes chiffrées.

---

### `core/permissions.ts` — Moteur RBAC

**Status:** Lint markdown-links uniquement dans `dsh-permissions/`

**Intérêt:** Permissions par projet/équipe (admin, developer, viewer). Integration avec `ctx.tools` et `ctx.sessions`.

**Lift condition:** `auth` plugin a sa config `z.object` corrigée.

---

## 5. Ce qu'on n'a pas pris ✗

| Facility | Pourquoi |
|----------|----------|
| `packages/ui/**` | Hors scope (pas de web UI enterprise) |
| `packages/run-objective/**` | Pas encore évalué |
| `packages/sdk/**` | Propre SDK divergence |
| `packages/db/**` | Propre DB schema via DSH session-persistence |
| `packages/mcp/**` | Stub uniquement (services-bound) |
| `services/api` (REST server) | Cordis in-process |
| `core/crypto.ts`, `core/ids.ts`, `core/fingerprints.ts` | DSH a ses propres impls |
| `core/object-store.ts` | DSH a `objectStore` effect |

---

## 6. Prochaines étapes prioritaires

### Phase 0 — Déja fait (sur master)

- [x] `chains` — harness adapter
- [x] `session-protocol` — buildHarnessBundle
- [x] `sandbox-runner` — RunPhaseRecorder
- [x] `gateway` — budgets in-memory
- [x] `watchtower` — job in-memory
- [x] `cli` — init + doctor
- [x] `guards-iit` — 5 guards
- [x] `iit-core` — stubs Rust (catastrophe, attractor, boundary)

### Phase 1 — Worktree `iit-advanced-guards` (1 commit ahead)

- [x] `effect-ethos.ts` — guard
- [x] `phi-trajectory.ts` — guard
- [x] `workspace-ignition.ts` — guard
- [x] `cache.ts` — cache pour les guards
- [ ] Merge vers master (review en cours)

### Phase 2 — stubs → production (DEFERRED lift conditions)

| # | Package | Blocker | Action |
|---|---------|---------|--------|
| 1 | `dsh-cost-tracker` | watchtower PG | Porter `pricing.ts` de Facility |
| 2 | `dsh-model-router` | gateway PG | Porter `provider-auth.ts` (WIF) |
| 3 | `dsh-otel` | wrap gateway/guards/watchtower | Ajouter OTel spans |
| 4 | `dsh-permissions` | auth config fix | Fix `z.object` manquant dans `auth` |
| 5 | `dsh-policy-engine` | OPA mock | Utiliser vrai OPA-WASM |
| 6 | `kb-rag` | PG pgvector | Implémenter `EnvelopeStore` + cosine search |

### Phase 3 — Facility partial → full

| Module Facility | Action |
|----------------|--------|
| `core/detect.ts` | Porter `detect()` pour IIT guards |
| `core/pricing.ts` | Porter pour `dsh-cost-tracker` |
| `core/provider-auth.ts` | Porter WIF pour Bedrock/Vertex/Groq |
| `services/gateway/metering.ts` | Full `MeteringStore` pour billing |
| `services/gateway/envelope-store.ts` | S3/R2 + envelope encryption |
| `core/permissions.ts` | Full RBAC engine |

---

## Annexe: Fichiers critiques

```
dsh-enterprise/
├── DEFERRED.md                    # stubs + conditions de déblocage
├── docs/enterprise/
│   ├── SPEC.md                    # zero upstream mutation
│   ├── IMPLEMENTATION_PLAN.md     # plan détaillé
│   ├── DETAILED_PLAN.md           # revue critique
│   └── CRITICAL_REVIEW.md         # revue indépendante
└── packages/
    ├── chains/src/plugin.ts       # harness adapter
    ├── guards-iit/src/guard-runner.ts  # bridge vers IIT
    └── enterprise/*/src/plugin.ts  # 21 plugins
```
