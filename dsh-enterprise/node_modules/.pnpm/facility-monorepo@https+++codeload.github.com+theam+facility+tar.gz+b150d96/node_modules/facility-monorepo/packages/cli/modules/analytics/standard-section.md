### Analytics (facility module)

New features must ship with analytics unless the feature has no runtime
behavior. **Missing analytics on a new feature is a correctness issue, not
polish** — a feature you cannot measure is a feature you cannot operate.

Before implementing, write the event plan in the task notes or PR summary:

- User story: who acts, what they are trying to do, what success/failure means.
- Surface: entry points, primary actions, failure states, completion states.
- Event catalog: started/completed/failed, validation errors, permission
  denials, cancellations, retries, empty results, background-job lifecycle.

Implementation rules:

- Event names live in one catalog file — never hard-coded strings at call
  sites. (Declare the catalog path here once you have one.)
- Product analytics must not capture message text, user content, names,
  credentials, or full URLs. Capture IDs, enums, counts, durations, booleans,
  route paths, and field names.
- Add or update telemetry tests when event names, sanitization, or required
  properties change.
- If a feature intentionally skips analytics, write the reason in the PR.
