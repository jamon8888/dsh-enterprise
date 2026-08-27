---
title: Guards
---

# Guards

A guard is a deterministic check for a repo-specific invariant — the things
your team agrees on that no off-the-shelf linter knows about. *Migrations are
append-only. Actions are SHA-pinned. No service-role key in the public API
surface. Event names come from the catalog.*

Facility vendors a tiny zero-dependency runner into your repo (`guards/run.mjs`,
~100 lines, yours to read and change) plus one starter guard. There is no
framework to depend on and no version to chase.

```
node guards/run.mjs                 # run all guards
node guards/run.mjs --only=<name>   # run one
node guards/run.mjs --json          # machine-readable, for CI and agents
node guards/run.mjs --list          # what's registered
```

## Why this exists

Quality systems for agents tend to accumulate prose: standards, prompts,
review checklists. Prose handles judgment well and invariants badly — an
agent (or a tired human) will eventually miss a rule that lives only as a
sentence. The meta-rule in `STANDARD.md` closes the loop:

> If a rule is repeatedly missed, add a deterministic check instead of more
> prose.

The second time a review catches the same problem, the problem graduates to a
guard. From then on it is caught in seconds, locally and in CI, by humans and
agents alike — and the review bandwidth goes back to judgment.

## The shape of a guard

One file, one invariant, one default export:

```js
// guards/no-fixme-in-api.mjs
import { listFiles, readText, applyAllowlist } from "./_kit.mjs";

const ALLOWLIST = {
  // "src/api/legacy.ts": "scheduled for deletion in #142 — 2026-07",
};

export default {
  name: "no-fixme-in-api",
  description: "the public API surface ships no FIXME markers",
  run() {
    const violations = [];
    for (const file of listFiles("src/api", [".ts"])) {
      readText(file).split("\n").forEach((line, i) => {
        if (line.includes("FIXME")) {
          violations.push({ file, line: i + 1, key: file, message: "FIXME in public API surface" });
        }
      });
    }
    return applyAllowlist(violations, ALLOWLIST);
  },
};
```

Three conventions carry the weight:

- **In-code allowlists with written reasons.** Exceptions are visible in the
  diff, owned by the guard, and `applyAllowlist` reports stale entries so the
  list cannot quietly rot.
- **`requires` for external state.** A guard that needs a database declares
  `requires: ["DATABASE_URL"]` and is *skipped* (not failed) when it's absent
  — local runs stay instant, CI runs everything.
- **`commandGuard` for wrapping.** If a check already exists as a CLI, wrap
  it instead of re-implementing security-relevant logic.

## In CI

Run guards as one umbrella status, separate from build/lint/test:

```yaml
- run: node guards/run.mjs
```

One status means one place to look, and adding the tenth guard costs no CI
configuration at all. Keep toolchain checks (typecheck, lint, tests, build)
as their own statuses — guards are only for what is specific to your repo.

## For agents

Guards are part of the crew's contract: `node guards/run.mjs` is in the
default permission allowlist, the reviewer subagents run it, and `--json`
exists so agents can consume results without scraping. When the crew itself
writes a new invariant into `STANDARD.md`, ask it for the guard in the same
PR — it knows the shape.
