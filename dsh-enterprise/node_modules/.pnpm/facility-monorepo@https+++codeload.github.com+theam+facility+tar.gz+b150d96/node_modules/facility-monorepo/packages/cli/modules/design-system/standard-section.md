### Design system (facility module)

A UI that conflicts with the design system is a product-quality issue, not a
matter of taste. Declare your source of truth here (a spec doc, a tokens
file, a published package) — the design reviewer reads it before judging.

- Use existing design tokens and shared components before inventing values.
  Ad-hoc colors, spacing, and radii that bypass the token layer are defects.
- UI flow changes include browser evidence — a Playwright run, screenshots,
  or a recorded check — or an explicit reason why UI verification did not
  apply. "It compiles" is not evidence for layout.
- Verify responsive behavior at the breakpoints your product supports when a
  change can affect layout, text fit, navigation, modals, or tables.
- Empty states, error states, and loading states are part of the surface —
  design them, don't let them fall out of the happy path.
