# @deepseek-ai/dsh-auth

Authentication & Identity capability seam for DeepSeek Harness (DSH).

## Overview

This package defines the core authentication and authorization service for DSH. It provides:

- **Service Definition**: Abstract AuthService class with standard auth operations
- **Type System**: Branded types for UserId, OrgId, SessionToken with compile-time safety
- **RBAC**: Role-based access control with Role and Permission types
- **Configuration**: Schema-validated config via schemastery
- **Cordis Integration**: Plugin registration with ctx.auth key

## Installation

```bash
pnpm add @deepseek-ai/dsh-auth
```

## Quick Start

```typescript
import { createAuthPlugin, AuthService } from '@deepseek-ai/dsh-auth'
import { Context } from 'cordis'

// Create a custom auth implementation
class MyAuthService extends AuthService {
  async validateToken(token: string) { /* ... */ }
  async getUser(userId) { /* ... */ }
  getPermissions(ctx) { /* ... */ }
  async createSessionToken(principal, ttlMs) { /* ... */ }
  async refreshToken(token) { /* ... */ }
  async revokeToken(token) { /* ... */ }
  // ... other abstract methods
}

// Register with Cordis
const ctx = new Context()
ctx.plugin(createAuthPlugin())
ctx.plugin(defineAuthPlugin(MyAuthService))

// Use auth service
const principal = await ctx.auth.validateToken(sessionToken)
if (principal && ctx.auth.can(principal, 'session', 'create')) {
  // Authorized
}
```

## Core Types

### Branded Identifiers

```typescript
type UserId = Brand<string, 'UserId'>
type OrgId = Brand<string, 'OrgId'>
type SessionToken = Brand<string, 'SessionToken'>
```

### Permissions

Fine-grained permissions for DSH resources:

- session:* - Session management
- agent:* - Agent lifecycle
- tool:* - Tool execution
- sandbox:* - Sandbox administration
- org:* - Organization management
- workspace:* - Workspace access

### Roles

Predefined roles for common access patterns:

- org:admin - Organization administrator
- org:member - Organization member
- workspace:owner - Workspace owner
- workspace:editor - Workspace editor
- workspace:viewer - Workspace viewer (read-only)

### Principal

Authenticated entity with roles and permissions:

```typescript
interface Principal {
  userId: UserId
  orgId: OrgId
  roles: Role[]
  permissions: Permission[]
}
```

### UserProfile

Extended user information:

```typescript
interface UserProfile {
  userId: UserId
  orgId: OrgId
  email: string
  name: string
  avatarUrl?: string
  metadata: Record<string, unknown>
}
```

## Service API

### validateToken(token: string): Promise<Principal | null>

Validate a session token and return the associated principal.

### getUser(userId: UserId): Promise<UserProfile | null>

Fetch user profile by ID.

### getPermissions(ctx: PermissionContext): boolean

Check if a principal has permission for a resource/action.

### createSessionToken(principal: Principal, ttlMs?: number): Promise<SessionToken>

Create a new session token for a principal.

### refreshToken(token: SessionToken): Promise<SessionToken>

Refresh an existing session token.

### revokeToken(token: SessionToken): Promise<void>

Revoke a session token.

### can(principal: Principal, resource: string, action: string): boolean

Convenience method for permission checks.

### getEffectivePermissions(principal: Principal): Promise<string[]>

Get all effective permissions including role-derived ones.

### getEffectiveRoles(principal: Principal): Promise<string[]>

Get all effective roles including inherited ones.

### login(credentials: LoginCredentials): Promise<AuthResult>

Authenticate with credentials.

### logout(token: SessionToken): Promise<void>

Log out and revoke session.

## Configuration

```typescript
interface AuthConfig {
  tokenTtlMs: number        // Default: 24 hours
  refreshTtlMs: number      // Default: 7 days
  issuer: string            // Default: 'dsh'
  audience: string          // Default: 'dsh-api'
  clockSkewMs: number       // Default: 60 seconds
  providers: Record<string, unknown>
}
```

## Events

Auth lifecycle events emitted on the Cordis context:

- auth/token-issued - New token created
- auth/token-refreshed - Token refreshed
- auth/token-revoked - Token revoked
- auth/token-validated - Token validation attempted

## Implementing a Provider

Create a concrete implementation by extending AuthService:

```typescript
import { AuthService, defineAuthPlugin } from '@deepseek-ai/dsh-auth'

class OAuthAuthService extends AuthService {
  constructor(ctx: Context, config: AuthConfig) {
    super()
    // Initialize OAuth client
  }

  async validateToken(token: string) {
    // Validate JWT, check expiry, fetch user
  }

  // ... implement all abstract methods
}

// Register
ctx.plugin(defineAuthPlugin(OAuthAuthService))
```

## Integration Points

### Session Header Extension (dsh-session)

Adds ownerId: UserId and collaborators: UserId[] to session headers.

### Session Creation/Join

ctx.sessions.create/join validates caller via ctx.auth.

### Web GUI

Login flow and session ownership UI consume ctx.auth.

### Subagents

Principal propagated to child sessions automatically.

## License

MIT
