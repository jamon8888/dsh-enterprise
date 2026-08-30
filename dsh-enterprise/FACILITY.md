# Facility Integration

`dsh-enterprise` re-implements patterns from [facility](github:theam/facility#b150d96) locally rather than importing it as a direct dependency.

## Why

- `facility` is not published as a standard npm package
- The git SHA pin (`#b150d96`) is not a proper version
- Re-implementation gives us control over the API surface

## What Wires to Facility

| Package | facility module | Status |
|---------|----------------|--------|
| session-protocol | @facility/harness/session | Graceful fallback (in-memory) |
| chains | @facility/harness/chains | Graceful fallback (in-memory) |
| sdk/client | @facility/harness/chains | Falls back to in-memory |

## What Is Re-implemented

| DSH service | facility pattern | Status |
|-------------|----------------|--------|
| watchtower | facility/services/api | In-memory; PG deferred |
| gateway | facility/services/gateway | In-memory; PG deferred |

## ponytail Upgrade Path

Real facility integration unblocks when:
1. `facility` is published as proper npm packages (not git SHA)
2. `session-protocol` and `chains` are updated to import directly
3. watchtower and gateway are updated to use facility's PG schemas

Until then: in-memory stubs are production-ready for single-node deployments.
