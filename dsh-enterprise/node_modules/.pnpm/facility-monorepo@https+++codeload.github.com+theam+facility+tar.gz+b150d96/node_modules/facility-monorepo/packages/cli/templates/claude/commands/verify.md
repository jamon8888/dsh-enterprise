---
description: Run the right checks for the current change and report honestly
---

Verify the current working-tree change per STANDARD.md's verification ladder.

1. Look at the diff (`git status`, `git diff`) and classify what it touches:
   pure code, data/migrations, security surface, UI, analytics, agent
   surface.
2. Run the lightest relevant checks first, escalating by risk:

{{CHECKS_LIST}}

3. Report a short table: check → result. Name every relevant check you did
   NOT run and why. Never summarize a failure away — paste the meaningful
   tail of the output and say what you'd try next.
