---
title: Watchtower
---

# The watchtower

An agent pipeline fails politely: a dead trigger stops summoning agents, a
mis-permissioned lane approves silence, and nothing turns red. The watchtower
is the layer that makes silence visible — platformized from the vendored
scripts, per project, with the same non-negotiable design rules:

1. **The monitor keeps an independent evidence path.** Repository-lane
   judgments read the GitHub API directly — never the telemetry the pipeline
   writes about itself. Platform health combines GitHub evidence with
   control-plane state, and a platform canary does not count its own run as a
   pass without independent GitHub evidence.
2. **A watchtower that quietly rots is worse than none.** Watchtower failures
   raise platform issues themselves.

## The instruments

- **Outcomes** (nightly) — every terminal agent PR is joined to its linked
  issue, merger identity, merge-commit shape and policy evidence, review rounds, and human
  fixup commits. **Accepted** means a human squash-merged it; lead time runs
  from issue creation to merge. If GitHub cannot prove the merge method,
  Facility reports the outcome as unassessed instead of guessing. **One-shot**
  means merged with zero change requests and zero human fixup commits.
  Acceptance and one-shot rates are metrics, not anecdotes. Outcomes are
  telemetry and immutable run artifacts; they never create work issues.
- **Health** (daily) — repository workflow failure streaks and run budgets,
  plus control-plane run, gateway, and dispatch health. Repository health
  maintains its incident issue; platform failures open a deduped platform
  issue per fingerprint and resolve themselves on recovery.
- **The canary** (weekly) — a synthetic probe through the real pipeline.
  For repo-lane projects the pinned, hash-authorized `/architect` probe is
  verified; for platform-lane projects Facility dispatches a pinned
  control-plane run and counts its success only when independent GitHub canary
  evidence corroborates it. Monitors tell you a workflow ran; only the canary
  proves the chain works before a human hits the breakage.

## Issues

Everything that goes wrong across the lifecycle — drift, budget breaches,
run failures, stuck sessions, guard failures, canary failures — is a
first-class platform issue with a fingerprint (deduped), a state, and a
trail. The Actions-tab glance becomes an org-wide view.

The issue boundary is deliberate. Health maintains one incident only while
the system is unhealthy. The read-only security agent emits structured
findings; trusted code creates or updates issues only for actionable,
high-confidence, high/critical findings. Receipts and outcomes remain evidence,
not backlog generators.

## How the canary is authorized

The repository-lane canary is the one bot allowed to summon the crew, and its
crew-trigger authority is deliberately narrow — **the message is authorized,
not the sender**:

1. The probe must be posted with a GitHub App token (`CANARY_APP_ID` /
   `CANARY_APP_PRIVATE_KEY`): comments posted with a workflow's own
   `GITHUB_TOKEN` trigger no workflows at all, so a `GITHUB_TOKEN` canary
   would test nothing (see [hardening note 14](../reference/hardening.md)).
2. `facility-crew.yml` admits that bot login only for an `issue_comment` on
   an `agent-canary`-labeled issue, resolving to `/architect` (never
   `/builder`), whose body is **byte-identical — SHA-256, CR-stripped — to
   the pinned probe** in `.github/facility/watchtower/canary.mjs`.
3. The hash in the crew workflow is generated from that same constant at
   `init` time and held in sync by the `watchtower-locked` guard.

Within the crew trigger, the hash gate prevents attacker-chosen instructions:
a leaked canary App key can repeatedly replay only the fixed, read-only
`/architect` probe. It does not cap replay frequency or aggregate cost, and it
does not restrict any other GitHub permissions granted to that App. Use a
dedicated App installed only on the canary repositories, with **Issues: read
and write** as its only requested repository permission, and never reuse a
broader App. Without the App secrets the canary skips with a notice, and
everything else keeps working.

## In the repository lane

Projects that installed the process into their own repository run the same
instruments as vendored scripts, with two differences worth knowing.

**The watchtower has a structural guard.** `watchtower-locked` requires the
three vendored workflow files, checks for at least two `- cron:` entries in
`facility-watchtower.yml` and one each in `facility-canary.yml` and
`facility-security-sweep.yml`, and verifies that `facility-crew.yml` contains
the SHA-256 hash computed from the canonical canary probe. It does not evaluate
job conditions or GitHub repository settings, so it cannot guarantee that
every schedule is enabled or runnable. The monitor also stays out of its own
watchlist — nothing may depend on what it monitors.

**Budgets are a reviewed file.** `.github/facility/watchtower/budgets.json`
caps daily failures and weekly runs per workflow; a breach turns the daily
health run red and lands in the incident issue. Keeping budgets in the
repository means a budget change is a diff with an author and a reason —
"costs will run away" gets answered with a file rather than a promise.

Numbers are published in the Actions run and its uploaded `outcomes.json`
artifact, with no dashboard product to stand up. An optional
`WATCHTOWER_WEBHOOK_URL` repository variable also POSTs each outcomes summary
as JSON. This convenience sink is unsigned and best-effort: failures do not
fail the outcomes job, and there is no durable retry or delivery history. Use
only a trusted HTTPS receiver. It is distinct from Facility's signed `webhook`
integrations described in the [webhooks reference](../reference/webhooks.md).
