/**
 * Core authentication and identity types for DSH Auth seam
 */

import type { Schema } from 'schemastery'

/**
 * Branded string types for type-safe identifiers
 */
export type Brand<T, B> = T & { __brand: B }

export type UserId = Brand<string, 'UserId'>
export type OrgId = Brand<string, 'OrgId'>
export type SessionToken = Brand<string, 'SessionToken'>

/**
 * Create branded identifiers
 */
export const UserId = (value: string): UserId => value as UserId
export const OrgId = (value: string): OrgId => value as OrgId
export const SessionToken = (value: string): SessionToken => value as SessionToken

/**
 * Permission strings for fine-grained access control
 */
export type Permission =
  | 'session:create'
  | 'session:join'
  | 'session:read'
  | 'session:write'
  | 'session:delete'
  | 'agent:spawn'
  | 'agent:read'
  | 'agent:write'
  | 'agent:delete'
  | 'tool:execute'
  | 'tool:read'
  | 'tool:write'
  | 'sandbox:admin'
  | 'sandbox:read'
  | 'sandbox:write'
  | 'org:admin'
  | 'org:read'
  | 'org:write'
  | 'workspace:admin'
  | 'workspace:read'
  | 'workspace:write'

/**
 * Role strings for RBAC
 */
export type Role =
  | 'org:admin'
  | 'org:member'
  | 'workspace:owner'
  | 'workspace:editor'
  | 'workspace:viewer'

/**
 * Principal represents an authenticated entity with roles and permissions
 */
export interface Principal {
  userId: UserId
  orgId: OrgId
  roles: Role[]
  permissions: Permission[]
}

/**
 * User profile information
 */
export interface UserProfile {
  userId: UserId
  orgId: OrgId
  email: string
  name: string
  avatarUrl?: string
  metadata: Record<string, unknown>
}

/**
 * Auth configuration schema
 */
export interface AuthConfig {
  /** Token time-to-live in milliseconds (default: 24 hours) */
  tokenTtlMs: number
  /** Refresh token time-to-live in milliseconds (default: 7 days) */
  refreshTtlMs: number
  /** Issuer identifier for tokens */
  issuer: string
  /** Audience identifier for tokens */
  audience: string
  /** Allowed clock skew in milliseconds (default: 60 seconds) */
  clockSkewMs: number
  /** Provider-specific settings */
  providers: Record<string, unknown>
}

/**
 * Default auth configuration
 */
export const defaultAuthConfig: AuthConfig = {
  tokenTtlMs: 24 * 60 * 60 * 1000, // 24 hours
  refreshTtlMs: 7 * 24 * 60 * 60 * 1000, // 7 days
  issuer: 'dsh',
  audience: 'dsh-api',
  clockSkewMs: 60 * 1000, // 60 seconds
  providers: {}
}

/**
 * Schemastery schema for AuthConfig validation
 */
export const AuthConfigSchema: Schema<AuthConfig> = {
  type: 'object',
  properties: {
    tokenTtlMs: { type: 'number', minimum: 1, default: defaultAuthConfig.tokenTtlMs },
    refreshTtlMs: { type: 'number', minimum: 1, default: defaultAuthConfig.refreshTtlMs },
    issuer: { type: 'string', minLength: 1, default: defaultAuthConfig.issuer },
    audience: { type: 'string', minLength: 1, default: defaultAuthConfig.audience },
    clockSkewMs: { type: 'number', minimum: 0, default: defaultAuthConfig.clockSkewMs },
    providers: { type: 'object', default: {}}
  },
  required: ['tokenTtlMs', 'refreshTtlMs', 'issuer', 'audience'],
  additionalProperties: false
} as const

/**
 * Session token payload for JWT or similar token formats
 */
export interface SessionTokenPayload {
  sub: UserId
  org: OrgId
  roles: Role[]
  permissions: Permission[]
  iat: number
  exp: number
  iss: string
  aud: string
  jti: string
}

/**
 * Token validation result
 */
export interface TokenValidationResult {
  valid: boolean
  principal?: Principal
  error?: string
  expired?: boolean
}

/**
 * Auth events for token lifecycle
 */
export type AuthEvent =
  | { type: 'auth/token-issued'; token: SessionToken; principal: Principal; ttlMs: number }
  | { type: 'auth/token-refreshed'; oldToken: SessionToken; newToken: SessionToken; principal: Principal; ttlMs: number }
  | { type: 'auth/token-revoked'; token: SessionToken; principal: Principal; reason: string }
  | { type: 'auth/token-validated'; token: SessionToken; principal: Principal; success: boolean }

/**
 * Login credentials (for provider implementations)
 */
export interface LoginCredentials {
  type: 'password' | 'oauth' | 'api-key' | 'sso'
  username?: string
  password?: string
  oauthProvider?: string
  oauthCode?: string
  apiKey?: string
  ssoToken?: string
  metadata?: Record<string, unknown>
}

/**
 * Authentication result
 */
export interface AuthResult {
  success: boolean
  principal?: Principal
  sessionToken?: SessionToken
  refreshToken?: SessionToken
  error?: string
  expiresAt?: number
}

/**
 * Permission check context
 */
export interface PermissionContext {
  principal: Principal
  resource: string
  action: string
  metadata?: Record<string, unknown>
}

/**
 * Resource-action permission mapping
 */
export interface ResourcePermission {
  resource: string
  actions: string[]
  roles?: Role[]
  permissions?: Permission[]
}
