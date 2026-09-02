---
title: Registry
---

# Registry: the knowledge, versioned

Skills, rules, agent contracts, harnesses, guards, modules, and template
sets are **registry items** — scoped bundled, organization, or project, with
immutable published versions.

Skill bodies may be stored as plain Markdown or as a complete `SKILL.md` with
YAML frontmatter. At run start Facility materializes a valid skill package for
both supported agent discovery paths; existing frontmatter is preserved.

## Scopes

- **bundled** — ships with the platform: the crew contracts (architect,
  builder, doctor, sweep), the Project Owner and learning contracts, the
  quality modules, the standard template set. Production-proven defaults.
- **org** — your organization's own skills and rules, shared across projects.
- **project** — local craft that hasn't generalized yet.

## Versioning

Items version linearly; a published version is immutable — the content hash
is the identity. Draft → active → deprecated. Agents always resolve the
active version at run start, so "which prompt was this agent running?" has
an exact answer, forever.

## Custom agents

An agent definition is data: engine (Claude Code, Codex, BYO), model tier,
contract (registry item), optional harness, triggers (slash command,
schedule, webhook, manual), permissions, sandbox profile. Creating a
project-specific agent is a declarative definition (via the API/CLI/MCP), not a
fork of the platform.

## The ratchet

Recurring failures become guards; craft that turns out to be checkable
graduates from prose to deterministic checks. Learning mode drafts these
promotions nightly. Humans approve them in the inbox. Skill and rule versions
land here; repository guard work becomes a deduplicated GitHub task and follows
the normal architect/builder delivery loop before the reviewed guard lands.
