---
name: test-strategy
description: Unified test + coverage strategy — vitest per-file 100%, cargo nextest, pytest, snapshots, e2e. Use for any test planning or coverage gate question.
---

# Test Strategy

## TS (DSH) — authoritative

`dsh/vitest.config.ts:280` per-file 100% `statements/branches/functions/lines`.
- Dev: `pnpm -C dsh run test` (forks, thread-safe + process-bound `vitest.config.ts:137`)
- CI: `pnpm -C dsh run test:coverage` — fails if any file <100% (custom `coverage-uncovered-locations.cjs:14`)
- Snapshot (keyless): `pnpm -C dsh run test:snapshot` — re-record with `DSH_SNAPSHOT=record`
- E2E (real API): `pnpm -C dsh run test:e2e` — skips without `DEEPSEEK_API_KEY` `dsh/AGENTS.md:44`
- Web stress/perf: `vitest.web-stress.config.ts`, `vitest.web.perf.config.ts`

Exemptions: `windowsUnsupported` `vitest.config.ts:22`, `coveragePartitionMode` `vitest.config.ts:284`, `heavySuites` via `COVERAGE_EXEMPT=1`.

## Rust

```sh
cargo nextest run --workspace          # faster than cargo test, shardable
cargo llvm-cov --workspace --lcov --output-path lcov.info
```

Clippy is gate: `-D warnings` with `[lints.clippy] pedantic=warn` `dsh-enterprise/Cargo.toml:14`.

## Python

```sh
uv run pytest -q                       # respects pytest.ini:2 testpaths
uv run pytest --cov --cov-report=term-missing
```

`norecursedirs = node_modules .git dist-exe` prevents worktree/venv collision.

## Gate composition

```
pnpm -C dsh run check:all   → typecheck + lint + duplication + knip + test:coverage + doc-sync
cargo clippy + nextest
uv run ruff check + pyright + pytest
```

CI owns exhaustive matrix; local pre-push runs `typecheck` only `dsh/lefthook.yml:52` — add `cargo clippy` + `ruff` there (done).
