# IIT Guards Enterprise Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integrate IIT guards as a Cordis-only monotone guard with session audit, OTEL metrics, RBAC and WORM export.

**Architecture:** `dsh-enterprise-guards-iit` registers `ctx.tools.guard` + `ctx.effect('iitGuards')` WASM bridge. Enterprise hardening (audit, RBAC, metrics) lives in separate packages wired via `ctx.on` hooks into the `policy/evaluate` waterfall chain. Fail-closed.

**Spec:** `docs/superpowers/specs/2026-08-28-iit-guards-enterprise-design.md`

## Global Constraints
- Strict Cordis-only, no Harness core modifications
- Fail-closed on error/timeout
- Per-file 100% coverage on packages/*/*/src
- MIT/Apache license

---

### Task 1: Guard Monotone Integration ✅ DONE

**Files:**
- `packages/guards-iit/src/guard-runner.ts` — waterfall integration, `policy/evaluate` emission, TPM-gated guard loop
- `packages/guards-iit/src/index.ts` — re-exports
- `packages/guards-iit/tests/guard-runner.spec.ts` — 5 tests

**Guards implemented:**
- `phi-threshold` — blocks if phi < minPhi
- `phi-trajectory` — sliding-window phi drift + slope via `phi_trajectory_wasm`
- `workspace-ignition` — GWT ignition score via `ignition_score_wasm`
- `ces-fingerprint` — CES hash verification
- `boundary-frontier`, `attractor-ews`, `catastrophe-cusp` — EWS phase1 guards
- `effect-ethos` — Teloids YAML deontic evaluation via `teloids_compile_wasm` / `teloids_evaluate_wasm`

**Enterprise chain (from Phase 4, `56aea80`):**
- `dsh-policy-engine` — OPA bundle evaluation on `policy/evaluate`
- `dsh-permissions` — RBAC SoD 4-eyes on `auth/approve`
- `dsh-audit-log` — hash-chain audit on `policy/evaluate` + `auth/approve`
- `dsh-otel` — OTEL metrics (separate package, not yet wired into guard-runner)

---

### Task 2: Session Events Typed

**Files:**
- Create: `packages/guards-iit/src/session-events.ts`
- Modify: `packages/guards-iit/src/guard-runner.ts`
- Test: `packages/guards-iit/tests/session-events.spec.ts`

**Interfaces:**
- Produces: `SessionEvent` with type `iit-guard.decision`

**Status:** Not yet implemented. Guard decisions do not emit to the session log.

- [ ] Write failing test for event emission
- [ ] Run test fail
- [ ] Implement emitter using `ctx.session.emit`
- [ ] Run test pass
- [ ] Commit

---

### Task 3: CES Cache LRU

**Files:**
- Create: `packages/guards-iit/src/cache.ts`
- Modify: `packages/guards-iit/src/guard-runner.ts`
- Test: `packages/guards-iit/tests/cache.spec.ts`

**Interfaces:**
- Consumes: `cesHash`
- Produces: `getCached(hash): Decision|undefined`

**Status:** Not yet implemented. CES hash computed on every guard invocation.

- [ ] Write failing test cache hit/miss
- [ ] Run fail
- [ ] Implement LRU with max 1000 entries
- [ ] Run pass
- [ ] Commit

---

### Task 4: OTEL Metrics

**Files:**
- Modify: `packages/guards-iit/src/guard-runner.ts`
- Create: `packages/guards-iit/src/telemetry.ts`
- Test: `packages/guards-iit/tests/telemetry.spec.ts`

**Interfaces:**
- Produces: metrics `iit.phi`, `iit.ews`, `iit.latency`

**Status:** `dsh-otel` package exists (Phase 2B) but not wired into `guard-runner`. No IIT-specific metrics emitted yet.

- [ ] Write failing test metric emission
- [ ] Run fail
- [ ] Implement telemetry wrapper using Harness OTEL or dsh-otel
- [ ] Run pass
- [ ] Commit

---

### Task 5: Audit WORM Signature ✅ DONE (separate package)

**Files:**
- `packages/enterprise/dsh-audit-log/src/plugin.ts` — hash-chained `AuditStore`
- `packages/enterprise/dsh-audit-log/tests/audit.spec.ts` — 51 tests

**Wired via:** `ctx.on('policy/evaluate', ...)` and `ctx.on('auth/approve', ...)` hooks in Phase 4.

**Not inside guards-iit:** Audit is a shared concern across all Enterprise plugins. WORM不可篡改 is achieved via hash-chain, not Ed25519 (Ed25519 noted as future upgrade path in DEFERRED.md).

- [x] Done — separate package `dsh-audit-log`, hash-chain audit, wired to `policy/evaluate`

---

### Task 6: RBAC & Config ✅ DONE (separate package)

**Files:**
- `packages/enterprise/dsh-permissions/src/plugin.ts` — SoD 4-eyes RBAC
- `packages/enterprise/dsh-permissions/tests/permissions.spec.ts` — 38 tests

**Wired via:** `ctx.on('auth/approve', ...)` hook.

**Config:** `packages/guards-iit/src/config.ts` handles nested guard config (`workspaceIgnition.threshold`, `effectEthos.teloidsYaml`, etc.) with `??` fallbacks.

- [x] Done — separate package `dsh-permissions`, SoD 4-eyes wired to `auth/approve`

---

## Revised Task Summary

| # | Task | Package | Status |
|---|------|---------|--------|
| 1 | Guard monotone + 7 guards + WASM bridge | `guards-iit` | ✅ Done |
| 2 | Session events typed | `guards-iit` | ❌ Remaining |
| 3 | CES cache LRU | `guards-iit` | ❌ Remaining |
| 4 | OTEL metrics | `guards-iit` (use `dsh-otel`) | ❌ Remaining |
| 5 | Audit WORM hash-chain | `dsh-audit-log` | ✅ Done |
| 6 | RBAC SoD | `dsh-permissions` | ✅ Done |
