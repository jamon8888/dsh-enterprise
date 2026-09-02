# Facility open-source roadmap

Facility is an open-source control plane for a complete, traceable AI software
delivery lifecycle. The roadmap covers both execution lanes:

- the **repository lane**, installed as versioned GitHub workflows; and
- the **platform lane**, run in Facility-owned protected sandboxes.

A capability is complete only when public automated tests and a reproducible
reference installation prove the user journey, not merely when an API or
template exists.

## Definition of done

The reference journey is:

1. A signal creates a traceable issue with an owner.
2. An architect investigates the real repository and posts an evidenced plan.
3. A human accepts or rejects the plan. Agents cannot accept their own plan.
4. The builder changes the repository, runs non-empty deterministic checks,
   pushes a branch, and opens a pull request. A no-op is not delivery success.
5. A protected preview is provisioned in a Facility-owned sandbox. Access is
   authenticated through the configured SSO provider.
6. Contract checks, specialist reviews, repository guards, the full build, and
   end-to-end tests report independently.
7. A human reviews the preview and pull request, then decides what merges.
   Agents cannot approve, merge, or push to the protected branch.
8. Deployment and production signals are joined back to the issue, run, pull
   request, and outcome.
9. Every agent job emits a schema-valid, privacy-preserving, tamper-evident
   receipt containing identity, timing, usage, cost, checks, and result.
10. Health monitoring distinguishes platform failures from agent failures.
    Repeated patterns create evidence-backed improvement proposals; a human
    remains the activation gate.

The authoritative acceptance target is a disposable reference repository and
project. Its tests must exercise both lanes from intake through human gates,
preview, receipts, outcome collection, and an improvement proposal.

## Milestone 1 — Trustworthy delivery

- [x] Seed ready-to-run architect, builder, reviewer, feedback, doctor, and
      security agents for each new platform project.
- [x] Post platform architect output to the originating GitHub issue and open a
      `plan_acceptance` proposal automatically.
- [x] Dispatch the linked builder only after approval by a separate human
      principal.
- [x] Require configured deterministic checks for delivery modes.
- [x] Require a change, pushed commit, and opened pull request before a builder
      run can succeed.
- [x] Apply the configured model for every supported engine and record the
      actual engine/provider identity.
- [x] Advance configured project boards through Planning, In Progress, and In
      Review without moving work backwards.

## Milestone 2 — Receipts and operational truth

- [x] Emit `facility.run.v1` for every repository- and platform-lane agent job,
      including architect, builder, review, feedback addressing, CI doctor,
      security sweep, Project Owner, learning, and canary.
- [x] Validate receipts before ingestion or artifact publication.
- [x] Chain platform receipts to the previous project receipt and include the
      digest in the append-only audit log. Repository receipts are independently
      bound to their workflow identity with GitHub OIDC provenance attestations.
- [x] Keep prompts, source, tool payloads, secrets, and raw model output outside
      receipts.
- [x] Make the canary prove one causally linked authorization → run → reply →
      valid receipt chain.
- [x] Classify infrastructure versus agent failures and enforce per-mode spend
      budgets from trusted receipts.

## Milestone 3 — Governed self-improvement

- [x] Join GitHub review threads, deterministic guard results, budget breaches,
      run receipts, outcomes, platform incidents, and historical proposal
      rejections into the learning evidence window.
- [x] Cluster repeated patterns over a rolling window and propose skills,
      rules, documentation, workflows, or deterministic guards.
- [x] Publish an approved skill/rule proposal as the active immutable version.
- [x] Turn an approved guard candidate into an active registry guard or a
      reviewable implementation pull request.
- [x] Preserve separation of duties: the proposing agent cannot approve or
      activate its own improvement.
- [x] Measure whether accepted improvements reduce recurrence.

## Milestone 4 — Protected previews and production feedback

- [x] Provision one isolated preview per implementation pull request through a
      Facility-owned sandbox driver.
- [x] Seed project-defined non-production data and run project-defined readiness
      checks.
- [x] Require SSO authentication for preview access; previews must never become
      anonymously reachable because a provider default changed.
- [x] Attach URL, readiness, expiry, run, commit, and pull-request identity as
      Gate 2 evidence.
- [x] Destroy previews on pull-request close or retention expiry.
- [x] Provide generalized deployment and telemetry adapters that map external
      provider events to typed Facility signals without embedding
      product-specific assumptions.

## Milestone 5 — First-run developer experience

- [x] Provide one guided quickstart for the repository lane and one for the
      platform lane.
- [x] Detect checks, deployment provider, preview requirements, branch
      protection, project board, and missing credentials before the first run.
- [x] Explain every required GitHub App permission, environment, secret, SSO
      setting, budget, and sandbox choice with copy-pasteable verification.
- [x] Make `facility doctor` distinguish local installation, repository-lane
      readiness, platform readiness, preview protection, and receipt health.
- [x] Keep upgrade and drift handling safe for repositories that customize the
      generated method.

## Generalization rules

- Product-specific checks belong in optional modules or project configuration,
  not the core. For example, Supabase, MCP, mobile, or a particular analytics
  provider can contribute security evidence without becoming universal
  requirements.
- Deterministic evidence is preferred to agent self-report. Agent judgment may
  explain or prioritize evidence but cannot rewrite its provenance.
- Provider adapters must expose stable outcomes—provisioned, ready, protected,
  expired, destroyed—rather than leak provider-specific concepts into the
  workflow contract.
- Human gates are product invariants. Agents may propose, implement, review,
  and repair, but they cannot approve their own plan, publish their own learned
  rule, approve a pull request, or merge protected code.

## Success metrics and product guarantees

Facility measures reviewer coverage, guard coverage, acceptance rate, one-shot
delivery rate, lead time, spend, recurrence, and model-lane outcomes. Each
project establishes its own baseline; Facility provides comparable evidence,
not universal performance guarantees.

## Acceptance evidence and known rough edges

- Repository-lane fixtures verify generated workflows, delivery guards,
  privacy-preserving receipts, provenance, health monitoring, and upgrade
  behavior without embedding a particular product stack in Facility core.
- Platform integration tests exercise the architect → human plan gate → builder
  delivery → SSO preview → receipt/outcome path against the same generalized
  contract. A production deployment still needs GitHub App, identity provider,
  runner-image, and project-preview configuration before that lane can run.
- Facility-owned previews currently consume a prebuilt immutable image, proxy
  browser-safe `GET`/`HEAD` traffic, and inject no project secrets. Those are
  deliberate pre-1.0 boundaries rather than hidden provider assumptions.
  Preview application egress must be isolated with the worker network/subnet
  policy until Facility exposes a first-class per-project egress profile.
