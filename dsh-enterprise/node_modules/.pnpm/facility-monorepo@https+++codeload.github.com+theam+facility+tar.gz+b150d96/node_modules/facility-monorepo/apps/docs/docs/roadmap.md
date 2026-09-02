---
title: Roadmap
---

# Roadmap

This page separates capabilities that exist from direction that is planned.
Roadmap items have no committed date until they move into a release plan.

## Native preview environments

**Status: available with rough edges.** Facility provisions an isolated Docker
or AWS sandbox from a project-defined immutable image, waits for an optional
readiness path, and exposes the private origin only through its SSO-authenticated
proxy. Production creation fails closed until interactive GitHub/OIDC login is configured.

The native preview system now:

- creates an isolated live environment for every implementation pull request;
- supports provider adapters rather than binding the control plane to one cloud;
- attaches the URL, deployment status, and expiry to the Facility run and PR;
- runs a project-defined command, which can seed non-production data before
  starting the service;
- makes preview readiness part of Gate 2 evidence; and
- destroys the environment when the PR closes or its retention window expires.

Current rough edges are explicit: the project must publish the review image
before requesting a preview; the proxy supports browser-safe `GET` and `HEAD`
traffic; and Facility does not inject project secrets. External provider
previews remain a supported adapter path. GitHub review and branch protection
remain the Gate 2 merge boundary in either mode.
