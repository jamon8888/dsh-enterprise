---
title: Security model
---

# Security model

Security and privacy are first-class concerns; this page is the contract.

## Identity & access

- Humans: GitHub identity through direct OAuth or the SaaS OIDC broker. Machines: argon2id-hashed API keys bound to
  roles. One permission catalog for web, CLI, MCP, and agents; deny by
  default; every route declares its permission and the startup assertion
  refuses undeclared routes.
- Custom roles are named permission sets — no side-channel authority.

## Secrets

- **Stored secrets** — provider API keys and integration signing secrets are
  sealed (libsodium) with a master key from your secret manager/KMS, decrypted
  only in the service that needs them. Provider credentials are never returned;
  integration signing secrets appear only in create/rotate responses and never
  in read responses.
- **Service credentials** — the GitHub App, upstream identity, and OAuth signing credentials
  are supplied to the services as environment variables from your secret
  manager; the platform reads them at boot and does not persist them in its
  database.
- Sandboxes receive no provider secrets — only run-scoped virtual keys and
  short-lived repo tokens fetched after boot.

## Webhooks and outbound network safety

- Facility-signed inbound events bind timestamp, delivery id, event type, and
  exact body bytes into HMAC-SHA256. The receiver enforces a five-minute replay
  window and integration-scoped delivery deduplication.
- Outbound webhooks require HTTPS outside insecure development, reject URL
  credentials and private/reserved IPv4/IPv6 answers, pin the validated address
  for the connection, disable redirects, and use a ten-second deadline. The
  durable outbox gives at-least-once delivery with bounded retry and visible dead
  letters.
- Remote MCP validates `Host` and browser `Origin`, bounds JSON bodies, and asks
  the control plane to authenticate each uncached Bearer credential before MCP
  protocol admission. Invalid credentials cannot enumerate the catalog;
  validation outages fail closed with `503` and `Retry-After`. Accepted caller
  credentials are forwarded to the API, and MCP has no privileged service identity.

## Protected previews

- Preview origins bind only to Docker loopback or an AWS private address;
  Facility rejects public, credential-bearing, and non-HTTP origins.
- Production preview creation, listing, viewing, and deletion fail closed until
  interactive GitHub/OIDC login is configured. Machine keys can request a preview, but cannot view
  or delete it.
- Preview HTML and JavaScript are served only from `FACILITY_PREVIEW_URL`, a
  browser site isolated at the registered-site boundary that routes to the
  existing API tasks. The AWS module creates a dedicated AWS-assigned
  CloudFront origin by default; custom deployments must provide a separately
  registered site. The preview host denies every control-plane route, and the
  control-plane hosts deny preview content routes.
- Opening a preview exchanges the Facility session for a single-use,
  60-second handoff and then a short-lived HttpOnly cookie bound to one user,
  organization, and preview. Every request rechecks active membership and
  `runs:read`; the proxy strips cookies and authorization before forwarding
  only browser-safe `GET` and `HEAD` requests.
- Do not configure a custom preview hostname as a sibling of the app/API
  hostnames, and never widen Facility cookies with a parent `Domain` attribute.
  The AWS-assigned origin or a separate registered site prevents untrusted
  preview JavaScript from tossing cookies into the control-plane site.
- No provider or production secrets are injected. Projects publish an immutable
  review image whose command prepares only non-production data.
- Preview application containers currently have outbound network access. Place
  production preview workers in a dedicated subnet/network whose policy blocks
  metadata endpoints and internal services; treat the review image as untrusted.
- Readiness is a project-defined HTTP path. PR close and retention expiry queue
  sandbox destruction, and each lifecycle transition enters the audit log.

## Untrusted text

Issue, PR, review, and comment text is data, never instructions — the rule
holds in webhook handlers (no interpolation into shell/prompts/SQL), in
operating contracts, and in the rendered workflows (jq event parsing,
start-of-line slash commands, bot-refusal, message-hash canary
authorization). The fifteen production hardening notes ship encoded in
templates, handlers, and guards — not as advice.

## Audit & privacy

- Append-only, hash-chained audit log; tamper evidence is a query.
- Store-everything default (envelopes, transcripts). Expiry is by the object
  store's lifecycle policy — configured by our AWS Terraform, and operator-
  configured for other S3-compatible stores; there is no app-level enforcement yet
  (a per-org `retention_days` setting is recorded; app-enforced per-org expiry is a
  follow-up). Access is gated by permission + project scope — the full transcript
  needs `audit:read`.
- Receipts and analytics are metrics-only: no prompts, no code, hashed
  actors. Self-hosted telemetry to the vendor: none.

## The invariants that never move

Agents never approve, never merge, never push to protected branches. Every
outward action carries a named principal. Every merge carries a human
decision.

Report vulnerabilities per [SECURITY.md](https://github.com/theam/facility/blob/main/SECURITY.md).
