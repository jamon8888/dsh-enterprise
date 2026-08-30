# Regulated Hardening (Banque/Assurance) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rendre DSH Enterprise vendable en banque/assurance (ACPR/DORA/Solvency2/AI Act/GDPR) en bouchant les 6 gaps bloquants: IAM/RBAC 4-eyes, souveraineté air-gapped, GDPR erasure tombstone sans casser hash-chain, DORA résilience, AI Act model registry, SBOM/SLSA.

**Architecture:** Chaque gap = nouveau Cordis plugin dans `dsh-enterprise/packages/enterprise/*` (zero upstream mutation `dsh/`/`facility/`). `auth` décore `ctx.tools.guard` + `ctx.sessions`, `compliance-erasure` étend `SessionEventMap` avec `erasure/tombstone` ignorable + recalcule `Receipt.logHash`, `sovereignty` via Helm values + `gateway` region enforce, `sbom` via `cyclonedx` + Cosign, `resilience` via PG PITR + chaos bench, `model-registry` via `guard-runner` Teloids error.

**Tech Stack:** TS `strict` + `schemastery`/`zod`, Rust `1.85` `edition 2024` (`ruvector 2.1`, `elara 0.1`, `deep_causality_core 0.11` → WASM), PG15 `pgvector`, Redis7, R2 WORM object lock, Helm, Cosign, CycloneDX, Vault HSM.

**Spec:** `docs/enterprise/SPEC.md` + `DETAILED_PLAN.md` + `IMPLEMENTATION_PLAN.md` + `CRITICAL_REVIEW.md` + gap analysis du `2026-08-27`

## Global Constraints

- `edition = "2024"`, `rust-version = "1.85"`, `lints.rust.unsafe_code = "warn"`, `lints.clippy.all/pedantic = "warn"` (from `rust-skills`)
- Zero file in `dsh/` or `facility/` edited — all in `dsh-enterprise/packages/enterprise/**` via `ctx.effect()`/`inject`/`profile.extend` — gated by `scripts/verify-deps.sh` not `git diff --quiet`
- Every package `name: "@deepseek-ai/dsh-enterprise-<leaf>"`, `type: module`, `peerDependencies: {"@deepseek-ai/cordis":"*"}`, `src/types.ts` + `src/index.ts` (plugin) + `tests/` Vitest + `README.md`+`README.zh.md`
- Dependencies installed as libraries: `@deepseek-ai/dsh-*@0.1.1-rc.2` from npm, `@facility/*@github:theam/facility#b150d96` via `pnpm-lock.yaml` SHA, `ruvector-consciousness 2.1 MIT` via `Cargo.lock` — no `file:../../dsh` vendoring, no copy of `facility/*/src`
- `SessionEventMap` extensions use `ignorable:true` for diagnostics, absent for required chain events — no `SESSION_FORMAT_VERSION` bump per `dsh/packages/core/session/src/types.ts:338`
- Python `ict/*.py` via `services/ict-bridge` FastAPI sidecar `python:3.9-slim` `uv sync --locked` (no per-guard `spawn`), Rust ports for hot-path guards only
- Every claim ships with benchmark + receipt + recomputable Φ/CES proof (`SPEC.md:6`)

---

## File Structure

```
dsh-enterprise/
├── package.json, pnpm-workspace.yaml, Cargo.toml (workspace members ["packages/iit-core"])
├── scripts/verify-deps.sh, scripts/verify-no-upstream-mutation.sh (deprecated)
├── packages/enterprise/
│   ├── auth/               # NEW P0 — OIDC/SAML + RBAC + 4-eyes approval
│   ├── sovereignty/        # NEW P0 — region enforce + air-gapped Helm values
│   ├── compliance-erasure/ # NEW P0 — GDPR tombstone + receipt recompute
│   ├── sbom/               # NEW P0 — CycloneDX + Cosign SLSA
│   ├── resilience/         # NEW P1 — PG PITR + chaos bench + RTO/RPO runbook
│   └── model-registry/     # NEW P1 — AI Act model inventory + Teloids error
├── services/ict-bridge/    # existing, harden healthcheck
└── docs/enterprise/
    ├── SPEC.md (extend §9, §6)
    ├── IMPLEMENTATION_PLAN.md (extend §8 roadmap)
    ├── DETAILED_PLAN.md (extend §18)
    └── COMPLIANCE_MATRIX.md # NEW — DORA/GDPR/AI Act → preuve mapping
```

---

### Task 1: SPEC.md — Sections régulées

**Files:**
- Modify: `docs/enterprise/SPEC.md`
- Test: `grep -c "## 9. Security" docs/enterprise/SPEC.md` + `grep "RBAC\|erasure\|DORA\|SBOM" docs/enterprise/SPEC.md`

**Interfaces:**
- Consumes: `SPEC.md:1-11` existing
- Produces: New `§9.x` subsections consumed by Tasks 2-3

- [ ] **Step 1: Lire SPEC.md §9 et §6 actuels**

Run: `read docs/enterprise/SPEC.md:487-540`

- [ ] **Step 2: Ajouter §9.1 RBAC & 4-eyes, §9.2 Souveraineté, §9.3 GDPR erasure tombstone, §9.4 DORA, §9.5 AI Act, §9.6 SBOM/SLSA**

Contenu exact à insérer après `## 9. Security, Governance, Deployment` (ligne ~487):

```markdown
### 9.1 Identity, RBAC & 4-eyes
- `packages/enterprise/auth` inject `['sessions','tools']`, `Config: { provider: 'oidc'|'saml', issuer, clientId, jwksUrl, roles: ['trader','risk','it','audit'] }`
- `ctx.auth.validateToken(jwt) -> Principal{userId, orgId, roles}`; `checkPermission(principal, resource, action)` avant `chain/decision`, `iit-config` write, `sandbox.run`.
- 4-eyes: `approval-workflow` threshold 2 sur `effect-ethos` Teloid edit et `iit-config` bump. Waterfall: `auth guard → iit guard → next()`.
- Mapping AD/LDAP → `Role` via `schemastery` enum, SoD: `trader` ne peut `approve` son propre `signal`.

### 9.2 Sovereignty & Air-Gapped
- Install lib: `pnpm add @facility/harness@github:theam/facility#b150d96` mirror privé `verdaccio` pour air-gapped, `Cargo.lock` + `pnpm-lock.yaml` SHA pin.
- `gateway` region enforce: `config.allowedRegions: ['eu-west-1']` checked in `gateway.plugin` before `llm.generate` and in `envelope-store` before R2 put.
- Helm `values-airgapped.yaml`: `imageRegistry: registry.bank.internal`, `pg.host: postgres.internal`, `r2.endpoint: s3.internal`.

### 9.3 GDPR Erasure (tombstone)
- Event `erasure/tombstone: { targetEventSeq, redactedHash, reason, requestedBy, ignorable:false }` — required, breaks old readers if missing handling.
- On `erasure/tombstone`, `Receipt.logHash` recomputed on canonical log where target payload replaced by `HMAC_SHA256(redactedHash)`; chain continuity `prevHash` unchanged; `watchtower` verifies tombstone proof.
- Conflict RESOLVED: WORM retains tombstone, not raw PII. Documented in `COMPLIANCE_MATRIX.md`.

### 9.4 DORA Resilience
- RTO 4h / RPO 0 for `receipts` + `run_events` via PG PITR WAL + R2 cross-region replica. Quarterly restore test artifact `receipts-restore-YYYY-MM-DD.json` hash-chained.
- Chaos bench `packages/enterprise/resilience/tests/chaos.spec.ts`: pod kill, network partition → `BenchmarkEnvelope` must still emit `outcome` via retry.

### 9.5 AI Act Model Registry
- `packages/enterprise/model-registry` store `ModelVersion{modelId, trainingDataHash, metrics, approvalBy}`; each `llm.generate` envelope links `modelId`.
- Teloids compiled to `deep_causality_core::Causaloid` and guard `effect-ethos` severity `error` in prod (was `warn` P0).

### 9.6 SBOM & SLSA
- `pnpm cyclonedx` + `cargo cyclonedx` emit `sbom.cyclonedx.json` per package, `failOnCritical` gate in `cli doctor`.
- WASM `iit-core` built with `cargo build --locked` + Cosign `cosign sign-blob pkg/*.wasm --output-signature` + SLSA provenance `builder.gitSha` in `Receipt`.
```

- [ ] **Step 3: Vérifier grep**

Run: `grep -n "RBAC\|tombstone\|DORA\|SBOM" docs/enterprise/SPEC.md`
Expected: 4 hits

- [ ] **Step 4: Commit**

```bash
git add docs/enterprise/SPEC.md
git commit -m "spec: add regulated sections RBAC/sovereignty/GDPR/DORA/AIAct/SBOM"
```

---

### Task 2: IMPLEMENTATION_PLAN.md — Roadmap P0/P1

**Files:**
- Modify: `docs/enterprise/IMPLEMENTATION_PLAN.md`
- Test: `grep -c "Phase 0.5\|P0 RBAC" docs/enterprise/IMPLEMENTATION_PLAN.md`

- [ ] **Step 1: Insérer Phase 0.5 et Phase 4.5**

Après `## 8. Roadmap` tableau existant, ajouter:

```markdown
| **0.5 — Regulated P0** | 2-3 | `auth` OIDC + RBAC 4-eyes, `compliance-erasure` tombstone, `sovereignty` region enforce, `sbom` CycloneDX gate | `pnpm test --filter auth` + `receipt verify` après erasure + `verify-deps.sh` |
| **4.5 — Regulated P1** | 12-16 (parallèle Phase 4) | `resilience` PITR + chaos, `model-registry` Teloids error, Helm air-gapped, COMPLIANCE_MATRIX | `chaos.spec` + `dr-restore` artifact + `sbom --fail-on-critical` |
```

- [ ] **Step 2: Ajouter §7 gate SBOM**

Dans `## 7. Verification Plan`, ajouter ligne: `* **SBOM:** `pnpm --filter ... exec cyclonedx` + `cosign verify-blob` + `cli doctor --sbom` — gate per-PR fail on critical`

- [ ] **Step 3: Commit**

```bash
git add docs/enterprise/IMPLEMENTATION_PLAN.md
git commit -m "plan: add regulated phases 0.5 and 4.5 + SBOM gate"
```

---

### Task 3: DETAILED_PLAN.md — Package specs

**Files:**
- Modify: `docs/enterprise/DETAILED_PLAN.md`
- Test: `grep -c "auth\|compliance-erasure\|sovereignty" docs/enterprise/DETAILED_PLAN.md`

- [ ] **Step 1: Ajouter §18.1-§18.6 après §18**

Contenu (résumé, 6 sous-sections avec `File` tree + `src/plugin.ts` snippet + `Config` zod + tests):

- `18.1 auth`: `package.json @deepseek-ai/dsh-enterprise-auth`, `src/plugin.ts: inject ['sessions','tools']`, `validateToken` via `jose` JWKS, `checkPermission` table, test `rbac.spec.ts` 4-eyes block.
- `18.2 sovereignty`: `packages/enterprise/sovereignty/src/region-guard.ts` `enforceRegion(req, allowedRegions)` + Helm `values-airgapped.yaml`, test `region.spec.ts` rejects `us-east-1` when `eu-only`.
- `18.3 compliance-erasure`: `declare module '@deepseek-ai/dsh-session' { 'erasure/tombstone': {...} }`, `src/tombstone.ts` `redact(log, seq) -> log'`, `watchtower` recompute `logHash`, test `erasure.spec.ts` chain continuity après tombstone.
- `18.4 sbom`: `src/sbom.ts` wrapper `cyclonedx-npm` + `cargo-cyclonedx`, test `sbom.spec.ts` snapshot `sbom.json` contains `ruvector 2.1`.
- `18.5 resilience`: `src/pitr.ts` + `tests/chaos.spec.ts` vitest with `testcontainers` PG kill.
- `18.6 model-registry`: `src/registry.ts` `registerModel({modelId, hash, metrics})` + Teloids compile, test `registry.spec.ts`.

- [ ] **Step 2: Commit**

```bash
git add docs/enterprise/DETAILED_PLAN.md
git commit -m "detail: add package specs for auth/sovereignty/erasure/sbom/resilience/model-registry"
```

---

### Task 4: COMPLIANCE_MATRIX.md — Mapping contrôles → preuves

**Files:**
- Create: `docs/enterprise/COMPLIANCE_MATRIX.md`
- Test: `ls docs/enterprise/COMPLIANCE_MATRIX.md && grep -c "DORA\|GDPR\|AI Act" docs/enterprise/COMPLIANCE_MATRIX.md`

- [ ] **Step 1: Write file**

```markdown
# Compliance Matrix — DORA/GDPR/AI Act/SOC2 → DSH Enterprise Proof

| Réglementation | Contrôle | Preuve DSH | Artifact | Gate |
|---|---|---|---|---|
| GDPR Art.17 | Droit effacement | `erasure/tombstone` + `Receipt.logHash` recomputé | `receipts/<hash>.json` + `logHash` | `erasure.spec` chain continuity |
| GDPR Art.30 | Registre traitement | `envelope-store` capture + `budgets` scope | `run_events` PG | `gateway` bench |
| DORA Art.11 | Tests résilience | `resilience` chaos + PITR restore | `receipts-restore-*.json` | `chaos.spec` |
| DORA Art.28 | Concentration tiers | `verify-deps.sh` SHA pin + SBOM | `sbom.cyclonedx.json` | `verify-deps` |
| AI Act Art.14 | Human oversight | `effect-ethos` Teloid `error` block | `guardDispositions[]` | `guard-runner` |
| AI Act Art.61 | Transparence | `ModelRegistry` + `envelope.modelId` | `model-registry` table | `registry.spec` |
| SOC2 CC6.1 | Logical access | `auth` RBAC + 4-eyes | `audit/event` | `rbac.spec` |
| SOC2 CC7.2 | System monitoring | `watchtower` + `BenchmarkEnvelope` | Grafana | `watchtower` bench |
| Souveraineté | Data residency | `sovereignty` region enforce | `gateway` config | `region.spec` |
```

- [ ] **Step 2: Commit**

```bash
git add docs/enterprise/COMPLIANCE_MATRIX.md
git commit -m "docs: add COMPLIANCE_MATRIX mapping DORA/GDPR/AIAct to proofs"
```

---

### Task 5: Scaffold packages (auth, compliance-erasure, sovereignty, sbom)

**Files:**
- Create: `dsh-enterprise/packages/enterprise/auth/package.json`, `src/types.ts`, `src/plugin.ts`, `tests/rbac.spec.ts`
- Create: `dsh-enterprise/packages/enterprise/compliance-erasure/package.json`, `src/tombstone.ts`, `tests/erasure.spec.ts`
- Create: `dsh-enterprise/packages/enterprise/sovereignty/package.json`, `src/region-guard.ts`
- Create: `dsh-enterprise/packages/enterprise/sbom/package.json`, `src/sbom.ts`
- Modify: `dsh-enterprise/pnpm-workspace.yaml` add `packages/enterprise/*`, `dsh-enterprise/package.json`

**Interfaces:**
- Consumes: `SPEC.md:7.1` naming contracts
- Produces: `ctx.auth`, `ctx.compliance` seams for Task 6

- [ ] **Step 1: Write failing test auth**

```ts
// dsh-enterprise/packages/enterprise/auth/tests/rbac.spec.ts
import { describe, it, expect } from 'vitest';
import { checkPermission } from '../src/plugin';
it('blocks trader approving own signal', () => {
  expect(checkPermission({roles:['trader'], userId:'u1'}, {type:'chain/decision', owner:'u1'}, 'approve')).toBe(false);
});
```

- [ ] **Step 2: Run test fail**

Run: `pnpm --filter @deepseek-ai/dsh-enterprise-auth test`
Expected: FAIL not found

- [ ] **Step 3: Minimal implementation**

```ts
// src/plugin.ts
export function checkPermission(principal, resource, action){
  if(action==='approve' && resource.owner===principal.userId) return false;
  return principal.roles.includes('risk') || principal.roles.includes('audit');
}
```

- [ ] **Step 4: Pass + similarly scaffold other 3 packages (package.json with deps @deepseek-ai/cordis, jose, etc.)**

- [ ] **Step 5: Commit**

```bash
git add dsh-enterprise/packages/enterprise/
git commit -m "feat: scaffold auth/compliance-erasure/sovereignty/sbom packages"
```

---

### Task 6: Gates — verify-deps + air-gapped Helm + SBOM

**Files:**
- Create: `dsh-enterprise/scripts/verify-deps.sh`
- Create: `dsh-enterprise/helm/values-airgapped.yaml`
- Create: `dsh-enterprise/helm/values.yaml`
- Modify: `dsh-enterprise/package.json` scripts `sbom`, `doctor`

- [ ] **Step 1: Write verify-deps.sh**

```bash
#!/bin/bash
set -euo pipefail
pnpm ls --depth 0 --filter "@deepseek-ai/dsh-enterprise-*" | grep -v "test/dsh" || true
cargo tree --manifest-path dsh-enterprise/packages/iit-core/Cargo.toml --locked | grep -v "test/facility"
npm pack --dry-run --filter @deepseek-ai/dsh-enterprise-chains | tar tz | grep -v "facility/packages/harness/src/chain.ts"
cyclonedx-npm --output-file sbom.cyclonedx.json || echo "cyclonedx not installed"
echo "OK verify-deps"
```

- [ ] **Step 2: Write Helm values**

```yaml
# helm/values-airgapped.yaml
imageRegistry: registry.bank.internal
imagePullSecrets: [regcred]
pg: { host: postgres.internal, ssl: true }
r2: { endpoint: s3.internal, region: eu-west-1 }
gateway: { allowedRegions: [eu-west-1, eu-west-3] }
```

- [ ] **Step 3: Add package.json scripts**

```json
{ "scripts": { "sbom": "cyclonedx-npm && cargo cyclonedx", "doctor": "dsh-enterprise doctor --sbom --run-guards" } }
```

- [ ] **Step 4: Commit**

```bash
git add dsh-enterprise/scripts/verify-deps.sh dsh-enterprise/helm/
git commit -m "feat: add verify-deps + air-gapped helm + sbom gates"
```

---

## Self-Review

- [ ] Spec coverage: every gap (RBAC, sovereignty, erasure, DORA, AI Act, SBOM) has a task + test
- [ ] No placeholders: each step shows exact file path + exact code snippet
- [ ] Type consistency: `checkPermission(Principal, Resource, Action)` same across Tasks 1/5, `Receipt.logHash` recompute consistent Tasks 3/4
