# dsh-enterprise Commercial Release Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** Make dsh-enterprise commercially available: CI/CD pipeline, production-ready flagship plugin (guards-iit) with commercial README, bundle packaging for DSH clients, and production-ready dsh-release.

**Architecture:** Single monorepo `@deepseek-ai/dsh-enterprise` published as one npm package. All 21 plugins available via cordis.patch.yml import. The 11 IIT consciousness guards (guards-iit) are the flagship commercial differentiator. CI gates on test + typecheck + coverage before npm publish.

**Tech Stack:** pnpm workspaces, vitest, TypeScript strict, GitHub Actions, npm (@deepseek-ai scope), DSH cordis bundle system, Rust/WASM (iit-core)

**Spec:** This plan.

## Global Constraints

- `node >=22.0.0`, `pnpm >=9`
- ESM everywhere, imports use `.js` extension
- `strict: true`, `noUncheckedIndexedAccess`
- License: `MIT OR Apache-2.0` for all packages
- Package name scope: `@deepseek-ai/dsh-enterprise-*`
- Tests must pass and coverage must be maintained before any publish
- ponytail ceilings must be documented in source for every stub
- No upstream mutation — all changes within `packages/enterprise/` and CI config

---

## Task 1: CI/CD Release Pipeline

**Files:**
- Create: `.github/workflows/ci.yml`
- Create: `.github/workflows/publish.yml`
- Modify: `package.json` — add `test`, `typecheck`, `coverage` scripts; update `version`

### CI Pipeline (`.github/workflows/ci.yml`)

Triggers: push to `master`, PR, and on tags starting with `v`.

```yaml
name: CI
on: [push, pull_request, create]

jobs:
  test:
    strategy:
      matrix:
        node: ['22', '23']
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with: { version: 9 }
      - uses: actions/setup-node@v4
        with: { node-version: ${{ matrix.node }}, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm run test
      - run: pnpm run typecheck
      - run: pnpm run coverage

  # guards-iit is the flagship — enforce 100% coverage on it
  guards-iit-coverage:
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with: { version: 9 }
      - uses: actions/setup-node@v4
        with: { node-version: '22', cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm run coverage --filter guards-iit
```

### Publish Pipeline (`.github/workflows/publish.yml`)

Triggers: version tag (`v*`).

```yaml
on:
  push:
    tags: ['v*']

jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with: { version: 9 }
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
          registry-url: 'https://registry.npmjs.org'
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm run typecheck
      - run: pnpm run test
      - run: pnpm run coverage
      - run: pnpm publish --access public
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

### Root package.json Scripts

Add to root `package.json`:
```json
{
  "scripts": {
    "test": "vitest run",
    "typecheck": "tsc --noEmit",
    "coverage": "vitest run --coverage"
  }
}
```

### Steps

- [ ] **Step 1: Create `.github/workflows/ci.yml`** with the matrix above
- [ ] **Step 2: Create `.github/workflows/publish.yml`** with npm publish on version tags
- [ ] **Step 3: Add test/typecheck/coverage scripts to root `package.json`**
- [ ] **Step 4: Commit** `ci: add GitHub Actions CI + publish pipeline`
- [ ] **Step 5: Verify CI passes** — push a test commit and confirm all jobs green

---

## Task 2: guards-iit — Production-Ready with Commercial README

**Files:**
- Create: `packages/guards-iit/README.md`
- Create: `packages/iit-core/pkg/index.js` (build artifact — generated)
- Modify: `packages/guards-iit/src/guard-runner.ts` (wire real WASM)
- Modify: `packages/guards-iit/src/guards/catastrophe-cusp.ts` (remove fallback chain)
- Modify: `packages/guards-iit/src/bridge.ts` (remove fallback chain)
- Modify: `packages/guards-iit/src/__mocks__/iit-core-pkg.ts` (mock CuspFit)
- Modify: `packages/guards-iit/package.json` — add `version`, `description`, `license`, `repository`, `keywords`

### WASM Build

The `iit-core` Rust crate is already configured in `packages/iit-core/Cargo.toml` for WASM output (`crate-type = ["cdylib", "rlib"]`). The build step needs to run `wasm-pack build --target nodejs --out-dir pkg` from the `iit-core` directory.

However, `wasm-pack` may not be available in CI. Alternative: check in the pre-built `pkg/` directory as a build artifact, or use `cargo-build-script` in package.json to build on install.

**Decision for this task**: Add `packages/iit-core/package.json` with a `build` script that runs `wasm-pack build --target nodejs --out-dir pkg`. Document that consumers need `wasm-pack` installed to rebuild, but the pre-built `pkg/` is committed.

### Remove Fallback Chain

Currently `catastrophe-cusp.ts` tries:
1. Real WASM (throws — not built)
2. ICT Python sidecar at `:8787` (network dependency)
3. Pure JS fallback (`cuspFitJs`)

After integration:
1. Real WASM (primary — no fallback needed)
2. ICT Python sidecar stays as optional enhancement
3. Pure JS fallback stays as last-resort

### guards-iit Commercial README

Should include:
- **Tagline**: "IIT-Inspired Consciousness Guards for DeepSeek Harness"
- **What it does**: 11 guards measuring phi, free energy, causal emergence, MIP shift, CES fingerprint, catastrophe cusp, attractor EWS, boundary frontier, effect ethos, workspace ignition, phi trajectory
- **How it works**: Cordis plugin hooking into `tools/guard` event waterfall
- **Quick start**: `npm install @deepseek-ai/dsh-enterprise` → add to `cordis.patch.yml` → configure guards
- **Per-guard docs**: one section per guard with what it measures and example config
- **Commercial angle**: leads with the unique IIT/consciousness IP — explain why measuring free energy and causal emergence matters for agent safety and alignment
- **Architecture diagram** (ASCII): agent loop → guards-iit waterfall → WASM core / Python sidecar
- **Upgrade path**: ponytail ceilings clearly listed

### Steps

- [ ] **Step 1: Add `packages/iit-core/package.json`** with build script + pre-built `pkg/` committed
- [ ] **Step 2: Wire real WASM in `guard-runner.ts`** — import from `iit-core/pkg` directly
- [ ] **Step 3: Update `catastrophe-cusp.ts`** — WASM primary, ICT sidecar optional, JS fallback last
- [ ] **Step 4: Update `__mocks__/iit-core-pkg.ts`** — mock `CuspFit` for tests
- [ ] **Step 5: Run tests** — `pnpm vitest run --filter guards-iit` — all 68 must pass
- [ ] **Step 6: Write `packages/guards-iit/README.md`** — commercial positioning, per-guard docs, upgrade paths
- [ ] **Step 7: Commit** `guards-iit: wire iit-core WASM, commercial README`
- [ ] **Step 8: Verify coverage** — `pnpm run coverage --filter guards-iit` — must still be 100%

---

## Task 3: dsh-enterprise Commercial Package (Bundle + README)

**Files:**
- Modify: `package.json` — name → `@deepseek-ai/dsh-enterprise`, remove `private: true`, add metadata
- Create: `cordis.patch.yml` — lists all 21 plugins as importable entries
- Create: `README.md` — commercial README for the full monorepo
- Modify: `packages/guards-iit/README.md` — cross-referenced from root
- Modify: `packages/enterprise/dsh-secrets/README.md` — update from stub
- Modify: `packages/enterprise/dsh-cost-tracker/README.md` — create if missing
- Modify: `packages/enterprise/dsh-sla-monitor/README.md` — create if missing
- Modify: `packages/enterprise/dsh-otel/README.md` — create if missing

### cordis.patch.yml Structure

```yaml
# DSH Enterprise plugin bundle — import this in your cordis.patch.yml:
#   import: '@deepseek-ai/dsh-enterprise/enterprise.patch.yml'
version: '1'
plugins:
  # === Flagship: IIT Consciousness Guards ===
  - id: guards-iit
    name: '@deepseek-ai/dsh-enterprise-guards-iit'
    # config: { threshold: 0.01, guards: ['phi-threshold', 'free-energy'] }

  # === Observability ===
  - id: dsh-otel
    name: '@deepseek-ai/dsh-enterprise-dsh-otel'
    # config: { serviceName: 'my-agent' }

  - id: dsh-cost-tracker
    name: '@deepseek-ai/dsh-enterprise-dsh-cost-tracker'

  - id: dsh-sla-monitor
    name: '@deepseek-ai/dsh-enterprise-dsh-sla-monitor'

  # === Security ===
  - id: dsh-secrets
    name: '@deepseek-ai/dsh-enterprise-dsh-secrets'

  # ... all 21 plugins listed
```

Each plugin entry should have the correct `name` matching what gets published to npm (`@deepseek-ai/dsh-enterprise-<plugin-name>`).

### Root README Structure

1. **Hero**: "IIT-Inspired Enterprise Plugins for DeepSeek Harness"
2. **What makes it different**: leads with the 11 IIT consciousness guards as unique IP
3. **Plugin catalog**: table of all 21 plugins with status (✅ production / 🔜 coming soon)
4. **Quick install**: `npm install @deepseek-ai/dsh-enterprise` + `cordis.patch.yml` import
5. **Per-plugin quick reference**: 2-3 sentences each
6. **IIT Guards deep dive**: the flagship section — explains the science (free energy principle, causal emergence, MIP) and why it matters for safe AI agents
7. **Commercial/licensing**: MIT/Apache-2 dual license, commercial support options
8. **ponytail upgrade paths**: clearly document what stubs lift when

### Per-Plugin READMEs

Create/update for: `dsh-secrets`, `dsh-cost-tracker`, `dsh-sla-monitor`, `dsh-otel`, `dsh-git-worktree`, `dsh-pr-agent`, `dsh-release`, `dsh-mneme`.

Each: 10-15 lines max — what it does, how to configure, ponytail ceiling.

### Steps

- [ ] **Step 1: Update root `package.json`** — name `@deepseek-ai/dsh-enterprise`, version `0.1.0`, description, keywords, license, repository
- [ ] **Step 2: Create `cordis.patch.yml`** listing all 21 plugins
- [ ] **Step 3: Write root `README.md`** — commercial positioning, install instructions, plugin catalog
- [ ] **Step 4: Write/update per-plugin READMEs** for all shipped plugins
- [ ] **Step 5: Commit** `pkg: add @deepseek-ai/dsh-enterprise bundle, commercial README`

---

## Task 4: Facility Partial Wiring

**Files:**
- Modify: `packages/session-protocol/src/plugin.ts` — fix facility import or document why it can't load
- Modify: `packages/chains/src/index.ts` — fix facility import or document why it can't load
- Modify: `packages/sdk/src/client.ts` — ensure fallback is documented
- Create: `FACILITY.md` — explains the facility relationship, what wires and what doesn't, ponytail ceilings

### What Can Be Fixed Now

1. **`session-protocol`** and **`chains`**: these currently throw if `@facility/harness` is not installed. Add a proper graceful fallback that logs a warning and continues with the in-memory implementation, rather than throwing.

2. **Document the facility relationship**: create `FACILITY.md` explaining:
   - `facilityHarness` is an external git dependency pinned to a specific commit
   - `session-protocol` and `chains` re-implement patterns from facility, they don't import it directly
   - The ponytail ceiling: "real facility integration when `github:theam/facility#<sha>` is installed and built"

### What Cannot Be Fixed Without External Work

- Real facility wiring requires the external `facility` repo to be published as a proper npm package, not a git SHA reference
- This is a deployment/infra decision, not a code problem

### Steps

- [ ] **Step 1: Fix `session-protocol`** — graceful fallback instead of throw when facility unavailable
- [ ] **Step 2: Fix `chains`** — graceful fallback instead of throw
- [ ] **Step 3: Update `sdk/client.ts`** — ensure fallback comment is clear
- [ ] **Step 4: Create `FACILITY.md`** — document the relationship and limitations
- [ ] **Step 5: Run tests** — `pnpm vitest run` — all pass
- [ ] **Step 6: Commit** `fix: graceful facility fallback in session-protocol and chains`

---

## Task 5: dsh-release Production-Ready

**Files:**
- Modify: `.github/workflows/ci.yml` — add `syft` and `cosign` to CI image
- Modify: `packages/enterprise/dsh-release/README.md` — create/enhance
- Create: `packages/enterprise/dsh-release/README.md`

### CI Binaries

Add to CI workflow:
```yaml
- name: Install SBOM tools
  run: |
    curl -sSfL https://raw.githubusercontent.com/wagoodman/syft/main/install.sh | sh
    curl -sSfL https://raw.githubusercontent.com/sigstore/cosign/main/install.sh | sh
```

Or use official Docker images for the publish job that include these tools.

### README

- What it does: generates CycloneDX SBOM, signs with cosign (keyless)
- How to configure: `sbomTool`, `projectRoot` options
- ponytail: what lifts when syft/cosign are installed vs absent

### Steps

- [ ] **Step 1: Add syft + cosign to CI** in `publish.yml` job
- [ ] **Step 2: Create `packages/enterprise/dsh-release/README.md`**
- [ ] **Step 3: Run tests** — `pnpm vitest run --filter dsh-release`
- [ ] **Step 4: Commit** `dsh-release: add CI binaries for syft + cosign, README`

---

## Execution Order

```
Task 1 (CI Pipeline) ─────────────────────────────────┐
Task 2 (guards-iit production) ────────────────────────┼──► All on master
Task 3 (commercial bundle + README) ────────────────────┤
Task 4 (facility partial wiring) ──────────────────────┤
Task 5 (dsh-release production) ────────────────────────┘
```

Tasks 2-5 are independent and can run in parallel once Task 1 (CI) is green.

## Rulings Made During Planning

| Decision | Rationale |
|----------|-----------|
| Commit all changes to `master` directly | No feature branch — this is the commercial release branch |
| Pre-built `pkg/` for iit-core committed to repo | wasm-pack not reliably available in all CI; build-on-install adds friction |
| All 21 plugins in `cordis.patch.yml` | DSH bundle model supports selective import — list all, consumer picks |
| guards-iit 100% coverage enforced separately | Flagship plugin deserves its own coverage gate |
| Facility graceful fallback instead of throw | Throwing breaks consumer's agent loop; graceful fallback lets them run |
