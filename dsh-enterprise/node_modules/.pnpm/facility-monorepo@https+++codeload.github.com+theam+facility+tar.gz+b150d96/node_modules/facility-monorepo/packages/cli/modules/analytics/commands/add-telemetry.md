---
description: Add privacy-safe analytics for a feature, per STANDARD.md's Analytics section
---

Instrument a feature following STANDARD.md's Analytics section.

1. Write the event plan BEFORE touching code, in the task notes or PR
   summary: user story (who acts, what success/failure means), surface
   (entry points, primary actions, failure/empty/completion states), and the
   event catalog — started/completed/failed, validation errors, permission
   denials, cancellations, retries, background-job lifecycle.
2. Add event names to this repo's event catalog file — find it (grep for
   existing event-name constants) and follow its convention. Never hard-code
   event-name strings at call sites.
3. Privacy check on every property: IDs, enums, counts, durations, booleans,
   route paths, and field names only. No message text, no user content, no
   names, no credentials, no full URLs. If a property could identify a person
   or quote their content, it doesn't ship.
4. Add or update telemetry tests when event names, sanitization, or required
   properties change.
5. Verify with the repo's telemetry tests, and finish by listing the events
   added and the failure paths they cover — uninstrumented failure paths are
   the gap reviewers will catch.
