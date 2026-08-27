# Critical Review — DSH Enterprise Plan (Engineering Structure)

**Reviewer stance: high-level, library-first. Goal: DSH and Facility are installed as libraries from their repos, never vendored or copied.**

---

## 1. What the plan gets right

* Correctly identifies the two upstream seams: `dsh/packages/core/session/src/types.ts:236` `SessionEventMap` and `facility/packages/harness/src/chain.ts:4642` (harness), `facility/services/gateway/src/budgets.ts:9941` (gateway), `facility/runner/src/phases.ts:3769` (runner).
* Correctly isolates new code in `packages/enterprise/**` and enforces `ctx.effect()` / `inject` (follows `dsh/packages/AGENTS.md`).
* Correctly chooses MIT/Apache Rust core `ruvector-consciousness 2.1` + `elara-active-inference 0.1` over AGPL `symthaea-*`, and bridge-first for `ict/*.py` (50 modules, `pyphi==1.2.0` ≤3.9).

---

## 2. Critical flaws — why "copy verbatim" and "test-root packages" breaks library installation

### 2.1 `test/` is not a workspace — pnpm and Cargo cannot resolve `workspace:*`

* Verified: `test/package.json` is `{ "devDependencies": { "shadcn": "^4.19.0" } }` — no `pnpm-workspace.yaml`, no `workspaces` field. `pnpm up`, `pnpm install --filter @deepseek-ai/dsh-enterprise-*` will fail: there is no workspace graph.
* `dsh/pnpm-workspace.yaml` lists `packages/*/*`, `vendor/*`, `apps/*` — it does **not** include `../packages/enterprise/*` or `../../packages/enterprise/*`. A package created at `test/packages/enterprise/chains` is invisible to `dsh`'s resolver and invisible to its own resolver (no workspace at `test/`).
* `Cargo.toml` at `test/packages/enterprise/Cargo.toml` as a cargo workspace with `members = ["iit-core"]` will not be found by `dsh`'s `cargo` (none) nor by `facility`'s `cargo` (none). Two independent package managers (pnpm, cargo) with no root manifest cannot share a lockfile or publish.

**Consequence:** The plan as written cannot be installed, cannot be published, and cannot be CI-built. `git -C dsh diff` will stay clean, but `pnpm --filter` and `cargo metadata` will both be broken.

### 2.2 Package names prove Facility is private and DSH is public — the plan treats both as copy sources

* Verified:
  * `dsh/packages/core/session/package.json:2` → `"name": "@deepseek-ai/dsh-session", "version": "0.1.1-rc.2", "publishConfig": { "access": "public" }, "repository": "deepseek-ai/deepseek-harness"` — **public on npm**.
  * `facility/package.json:2` → `"name": "facility-monorepo", "private": true, "version": "0.3.0", "license": "Apache-2.0"` and `facility/packages/harness/package.json:2` → `"name": "@facility/harness", "private": true, "exports": { ".": "./dist/index.js", "./chains": "./dist/chain.js" }` — **private, not on npm, built via `tsup` to `dist/`**.

* The plan's `3.1` says `facility/packages/harness/src/chain.ts` — copy verbatim, replace `zod` with `schemastery`. This is **vendoring**. If Facility is installed as a library, the correct import is:

```ts
import { productChain, chainFromConfig } from '@facility/harness/chains';
import { buildHarnessBundle } from '@facility/harness/session';
import { validateChain } from '@facility/harness/validate';
```

  No copy. No `schemastery` replacement — `@facility/harness` already declares its own schema dep (zod) and its `dist/` is the public API. Copying its `src/` into `packages/enterprise/chains/src/chain.ts` creates a fork that will drift on every `facility@b150d96 → next` and is not covered by Facility's `src/invariant.ts` or `facility/packages/harness` tests.

* Same for `services/gateway/src/budgets.ts` and `runner/src/phases.ts` — they are **not packages**. They are `services/*` and `runner` — never intended to be imported as libraries. The plan's "port budgets.ts" by copying its source into `packages/enterprise/gateway/src/budgets.ts` is again vendoring a service, not using a library. If the intent is library installation, the service must first be extracted to a publishable package (or consumed via its HTTP API, not its source).

### 2.3 Dependency declarations are missing — no `package.json` dependency graph

The plan never writes the consumer `package.json` that actually installs DSH/Facility. The correct library installation is:

**DSH (public, semver-pinned):**

```json
{
  "dependencies": {
    "@deepseek-ai/dsh-session": "0.1.1-rc.2",
    "@deepseek-ai/dsh-skill": "0.1.1-rc.2",
    "@deepseek-ai/cordis": "4.0.0-rc.7",
    "@deepseek-ai/schemastery": "3.18.0"
  }
}
```

**Facility (private, git-pinned, integrity-checked):**

```json
{
  "dependencies": {
    "@facility/harness": "github:theam/facility#b150d96",
    "@facility/db": "github:theam/facility#b150d96"
  },
  "pnpm": {
    "overrides": {
      "@facility/harness": "github:theam/facility#b150d96"
    }
  }
}
```

Or, for a local monorepo checkout (what we have at `test/dsh` + `test/facility`), the correct `file:` link is:

```json
{ "dependencies": { "@facility/harness": "file:../facility/packages/harness" } }
```

— but `file:` requires the target to have a `dist/` already built (`tsup`), and `pnpm` will symlink, not copy. The plan does not state which form is used, nor where `pnpm-workspace.yaml` lives to make `file:` resolvable.

### 2.4 `scripts/verify-no-upstream-mutation.sh` does not guarantee library purity

```bash
git -C dsh diff --quiet && git -C facility diff --quiet
```

This only catches uncommitted edits inside the two clones. It does **not** catch:

* `pnpm patch @facility/harness` (writes to `patches/` outside the clones)
* `pnpm.overrides` that rewrites `@facility/harness` to a local file
* `Cargo.toml [patch.crates-io]` that replaces `ruvector-consciousness`
* A `postinstall` that writes into `dsh/packages/*`

A real library gate is `pnpm --filter ... ls --depth 0` + `cargo tree | grep -v "enterprise"` + `npm pack --dry-run` hash check.

### 2.5 Python bridge via ad-hoc `spawn('python3.9')` is not enterprise-grade

The plan's `guards-iit/src/bridge.ts` does per-guard `spawn('python3.9', ['-c', ...])` with `PYTHONPATH=IIT/ICT-Series`. This is:

* **Not supervised** — no lifecycle, no healthcheck, no backpressure, no timeout budget (a stuck `ict/catastrophe.py fit_cusp` blocks the Cordis waterfall).
* **Not reproducible** — `pyphi==1.2.0` requires `Python ≤3.9, NumPy<2` per `IIT/ICT-Series/pyproject.toml:10`; `python3.9` may not exist on the host (our host has `python3.12`, `pip3: not found`). The plan does not declare a lockfile or a container.
* **Not auditable** — `span python3.9 -c` does not emit a `BenchmarkEnvelope` or a `Receipt` entry, so the audit chain breaks at the language boundary.

An enterprise library installation would run `ict/*.py` as a **sidecar service** (or `PyO3`/`maturin` NAPI, or `candle` WASM) with a typed RPC, not a per-call spawn.

---

## 3. What "installed as libraries" must mean

### 3.1 The enterprise repo is its own repo, not `test/packages/enterprise`

```
dsh-enterprise/                       # NEW git repo: github:your-org/dsh-enterprise
├── package.json                     # private, type: module, packageManager: pnpm@9
├── pnpm-workspace.yaml              # packages: ["packages/*"]
├── Cargo.toml                       # cargo workspace, members = ["packages/iit-core"]
├── packages/
│   ├── iit-core/                    # Rust → WASM, depends on ruvector (crates.io), not on dsh/facility source
│   ├── chains/                      # depends on @facility/harness (git) + @deepseek-ai/dsh-session (npm)
│   ├── session-protocol/
│   ├── guards-iit/
│   ├── gateway/
│   ├── sandbox-runner/
│   ├── watchtower/
│   ├── cli/                         # bin: dsh-enterprise
│   ├── mcp/
│   └── sdk/
├── pyproject.toml                   # python 3.9 pin for ict bridge sidecar (uv)
└── scripts/verify-deps.sh           # checks npm + cargo + py lockfiles
```

**Not** `test/packages/enterprise` inside an untracked `test/` directory with two nested git clones.

### 3.2 `packages/*/package.json` must declare real dependencies, not copy source

**Wrong (current plan `§5`):**

```
packages/enterprise/chains/src/chain.ts  // copy of facility/packages/harness/src/chain.ts
```

**Correct (library install):**

```json
// packages/chains/package.json
{
  "name": "@deepseek-ai/dsh-enterprise-chains",
  "version": "0.1.0",
  "type": "module",
  "dependencies": {
    "@facility/harness": "github:theam/facility#b150d96",
    "@deepseek-ai/dsh-session": "0.1.1-rc.2",
    "@deepseek-ai/cordis": "4.0.0-rc.7"
  },
  "peerDependencies": { "@deepseek-ai/cordis": "*" }
}
```

```ts
// packages/chains/src/plugin.ts
import { productChain, bundledChains, chainFromConfig } from '@facility/harness/chains';
import { validateChain } from '@facility/harness/validate';
```

No `zod → schemastery` replacement; `@facility/harness` already exports its own types. If a type mismatch exists, open an issue on `theam/facility`, don't fork.

For **services** (`gateway`, `runner`) that are not packages, the library boundary is **the HTTP API**, not the source:

```ts
// packages/gateway/src/plugin.ts — do NOT copy services/gateway/src/budgets.ts
// Call the running Facility gateway via its HTTP API, or extract budgets.ts to a new publishable package @facility/gateway-core first.
import { GatewayClient } from '@facility/gateway-client'; // hypothetical publishable package
```

Until `theam/facility` publishes `services/gateway` as a library, the enterprise `gateway` package must be explicit: "this is a **new service** that reimplements the Facility gateway pattern, not a library import."

### 3.3 DSH capabilities are consumed via their published seams, not their repo paths

**Wrong:**

```ts
import type { SessionEventMap } from '../../../dsh/packages/core/session/src/types.ts' // file path
```

**Correct:**

```ts
import type { SessionEventMap, SessionId } from '@deepseek-ai/dsh-session';
```

The `dsh` clone at `test/dsh` is for **reference and basemind indexing only**. At build time, `pnpm install` fetches `@deepseek-ai/dsh-session@0.1.1-rc.2` from the registry (or `file:../dsh/packages/core/session` if `pnpm-workspace.yaml` declares a `file:` override for local dev). The `dsh-enterprise` repo's `pnpm-workspace.yaml` must not list `../../dsh/packages/*/*` — that leaks the dev checkout into the publish graph.

### 3.4 Python `ict/` is a library, not a subprocess string

**Wrong (current `§7.4`):**

```ts
spawn('python3.9', ['-c', `import ict.catastrophe as cat; fit = cat.fit_cusp(traj)`])
```

**Correct (library, supervised):**

```
pyproject.toml (uv):
[project]
name = "dsh-enterprise-ict-bridge"
requires-python = "==3.9.*"
dependencies = ["pyphi==1.2.0", "numpy<2", "ict @ file://IIT/ICT-Series"]  # if ict were publishable, else file:./IIT

services/ict-bridge/
  main.py  # FastAPI: POST /catastrophe/fit {traj} -> CuspFit, healthcheck, timeout, BenchmarkEnvelope emit
  Dockerfile (python:3.9-slim, uv sync --locked)
```

Or, for pure-Rust guards, port `ict/catastrophe.py` (16 KB) + `ict/early_warning.py` (192 LOC) to `iit-core/src/{catastrophe,attractor}.rs` (as the plan already does for Rust) and **do not spawn Python at all** on the hot path. The Python sidecar is only for off-line Gates (ICT-14 free_energy 20KB, ICT-22 S4 .npz) that are not latency-sensitive.

---

## 4. Required patches to the plan

### P1 — Create the enterprise repo, not `test/packages/enterprise`

* `git init` at `dsh-enterprise/` (or rename `test/` and add a root `pnpm-workspace.yaml` + `Cargo.toml` that makes `test/` a real workspace). Do **not** keep `dsh/` and `facility/` as untracked siblings inside an un-tracked `test/` — they are library checkouts for `basemind` and `git log` reference only.

### P2 — Rewrite `§3` (Crate Inventory) and `§5` (chains) to import, not copy

* Delete `chains/src/chain.ts` copy. Replace with `dependencies: { "@facility/harness": "github:theam/facility#b150d96" }` + `from '@facility/harness/chains'`.
* Mark `services/gateway` and `runner` as **service reimplementations**, not library imports, until Facility publishes them. Document the divergence risk.

### P3 — Add a dependency manifest section

Add to `IMPLEMENTATION_PLAN.md:0` a table:

| Upstream | Package | Install | Pin | License |
|----------|---------|---------|-----|---------|
| DSH session | `@deepseek-ai/dsh-session` | `npm: 0.1.1-rc.2` | `package.json` + `pnpm-lock.yaml` | MIT/Apache (verify) |
| Facility harness | `@facility/harness` | `github:theam/facility#b150d96` | `pnpm-lock.yaml` git sha + integrity | Apache-2.0 (facility `LICENSE`) |
| Rust IIT | `ruvector-consciousness` | `crates.io: 2.1` | `Cargo.lock` | MIT |

And a gate `scripts/verify-deps.sh: pnpm ls --depth 0 && cargo tree --locked && uv lock --check`.

### P4 — Replace `spawn('python3.9')` with a supervised bridge

Either (a) a `services/ict-bridge` FastAPI sidecar (Docker `python:3.9-slim`, `uv sync --locked`, `HEALTHCHECK`, timeout 5s, emits `BenchmarkEnvelope`), or (b) pure-Rust ports for the hot-path guards (`catastrophe`, `early_warning`, `workspace` 677 LOC numpy-only, no pyphi). Document which guards are bridge (off-line) vs Rust (on-path).

### P5 — Strengthen `verify-no-upstream-mutation`

Replace `git -C dsh diff --quiet` with:

```bash
pnpm --filter "@deepseek-ai/dsh-enterprise-*" list --depth 0 | grep -v "test/dsh"
cargo tree --manifest-path packages/iit-core/Cargo.toml | grep -v "test/facility"
npm pack --dry-run --filter @deepseek-ai/dsh-enterprise-chains | tar tz | grep -v "src/chain.ts"
```

---

## 5. Residual question for you

Do you want Facility installed as:

* **A)** `github:` git dep (exact SHA `b150d96`, cheapest, no publishing needed), or
* **B)** a proper publish to a private registry (e.g., `npmjs` scope `@facility` with `access: restricted`, or `verdaccio`), or
* **C)** `file:` links inside a single pnpm monorepo that vendors both checkouts as path dependencies (what `test/` currently is, but then `test/` must become the monorepo root with a real `pnpm-workspace.yaml`)?

The plan currently assumes (C) but never writes the workspace. Option (A) is the only honest "installed as libraries from their repo" without a `test/` workspace. Pick one and I'll patch `SPEC.md:2.2` + `IMPLEMENTATION_PLAN.md:1` to it.

