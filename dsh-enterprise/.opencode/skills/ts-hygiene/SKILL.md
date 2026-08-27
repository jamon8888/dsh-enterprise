---
name: ts-hygiene
description: TypeScript hygiene for DSH monorepo — oxlint, tsc, knip, jscpd, vitest per-file 100% coverage. Use for any TS edit, lint, test, or hygiene question.
---

# TS Hygiene

DSH is `pnpm` workspaces at `dsh/packages/*/*/src` with `oxlint 1.76 + tsgolint`, `tsc strict`, `vitest 4.1.8` per-file 100%.

## Gates (run before push)

```sh
pnpm -C dsh run typecheck          # tsc -b tsconfig.host/client
pnpm -C dsh run lint               # oxlint + tsgolint (built host)
pnpm -C dsh run duplication        # jscpd cross-file clones
pnpm -C dsh run knip               # unused exports/files
pnpm -C dsh run test:coverage      # per-file 100% — CI gate, not pnpm test
```

- `pnpm test` is local dev only; CI uses `test:coverage`. See `dsh/vitest.config.ts:280` thresholds.
- Heavy suites: `COORDINATION_EXEMPT=1` or partitioned `scripts/coverage-partitions.ts`.
- Snapshot: `pnpm -C dsh run test:snapshot` (keyless replay vs `dsh/examples/*/tests`).

## Conventions

- ESM only (`"type":"module"`), `*.ts` imports, package names across packages `dsh/AGENTS.md:18`.
- Registrations are effects `ctx.effect()`; `register()` returns disposer.
- Typed events need `@mode` + `@param`; Waterfall listeners must call `next()`.
- No hardcoded tunables — `Config` field in `cordis.yml`, no `DEFAULT_*`.

## OpenCode hygiene

- `opencode.json:2` enables `formatter` (prettier/biome) and `lsp.typescript` auto — but CLI gates are authoritative per `/docs/lsp#best-practices`.
