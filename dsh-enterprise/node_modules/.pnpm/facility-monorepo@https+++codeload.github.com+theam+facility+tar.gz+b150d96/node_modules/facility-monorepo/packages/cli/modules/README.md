# Modules

A facility module packages one quality concern in every form a rule needs to
actually hold:

1. **Prose** — a section inserted into your `STANDARD.md`, so agents and
   humans know the rule and the reasoning.
2. **A reviewer** — a subagent in `.claude/agents/` that judges the gray area
   prose can't pin down.
3. **Checks** — deterministic guards and hooks for the part that should never
   depend on judgment.
4. **Workflows** — slash commands in `.claude/commands/` for the procedures
   the module prescribes (e.g. `/new-migration`, `/add-telemetry`), so the
   right way is also the easy way.

Install one with:

```
npx @theagilemonkeys/facility add <module>
```

| module | what it enforces |
|---|---|
| `analytics` | new features ship privacy-safe analytics; missing events are correctness bugs |
| `database` | migrations are immutable and append-only; row-level security by default |
| `ai-queryability` | durable product data is queryable/actionable by AI, or the waiver is written down |
| `design-system` | UI changes conform to your design system and carry browser evidence |

## Writing your own

Copy the shape of any module here: a `module.json` manifest, a
`standard-section.md`, and optional `agents/`, `guards/`, and `hooks/`
fragments. Then `npx @theagilemonkeys/facility add ./path/to/your-module`. If a concern
keeps biting your team, it deserves the full triple — a rule that exists only
as prose will be missed again.
