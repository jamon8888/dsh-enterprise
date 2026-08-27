# Facility brand

Facility is a **TAM-50** product of The Agile Monkeys' brand system: its own
face on the TAM technical layer, with the TAM relationship named in the footer
signature. Its public language and visuals follow the open-source product
principles and documentation in this repository.

## Name

**facility** — always lowercase in the wordmark, sentence case ("Facility") in
prose. A facility is where units of work enter as signals and leave as shipped,
inspected, signed-off software. The vocabulary is product-wide:

| the facility | in the product |
|---|---|
| the loop | issue → `/architect` → gate → `/builder` → review → gate → merge |
| the two gates | the human decisions: accept the plan, sign the merge |
| every change gets its own world | the provisioned, ephemeral environment |
| the gauntlet | STANDARD.md + guards + reviewer subagents + security sweep |
| the watchtower | outcomes, health monitor, the canary — the SDLC watching itself |
| the doctor | bounded CI repair, stopped cold at security surfaces |

Tagline: **"The AI software factory for your repo."**
Method line: **"Agents build. People decide twice. Everything gets measured."**
Product promise: *"We taught AI to ship like our engineers. Then we made it
prove it."*

## Palette (roles, per TAM-50)

| role | value | use |
|---|---|---|
| void (surface) | `#0A0C10` | dark canvas, the mark's body |
| card | `#161B22` | raised dark surfaces |
| line | `#8B949E` | the pipeline, soft separators |
| gate (ink on dark) | `#F0F3F6` | text on dark, the two gate marks |
| **agent yellow** | `#FFD923` | **reserved for agent work** — the pulse, CLI accent, badges. Never decoration. |

The yellow rule is the palette's one law:
yellow marks something an agent did or is doing. A yellow element with no
agent behind it is off-brand.

## Mark

A unit of work traveling the pipeline between **two human gates** — the method
in one glyph ("people decide twice"). Geometry only (`assets/mark.svg`), 4px
radius per TAM imagery treatment, no strokes around it, no shadows. The
wordmark sets the name in IBM Plex Mono with a yellow full stop.

## Typography

Inherited TAM layer, selected by role (TAM-50): **IBM Plex Sans** for prose
and explanation, **IBM Plex Mono** for the technical voice (CLI, code, file
trees, the wordmark), **Neue Galano Light** only on future commercial web
surfaces. No other typefaces; font files are licensed assets and do not live
in this repository.

## Voice

Sensei, not startup (TAM `foundations/voice.md`): open with the failure mode,
be calmly opinionated, zero hype, no contrarian one-liner templates, end with
implication. Two site-inherited habits: **numbers must be live, not curated**
("these update nightly, straight from the pipeline"), and claims about agents
come with the receipt — measurement language (acceptance, one-shot, fixups,
time-to-merge) over adjectives.

## Signature (non-negotiable for tier membership)

Every published Facility surface closes with the TAM-50 footer signature: the
product mark plus the live-text line
**"An initiative by [The Agile Monkeys](https://theagilemonkeys.com)"** —
IBM Plex, WCAG AA contrast, composed into the footer, never a floating badge.
The README footer is the canonical instance.
