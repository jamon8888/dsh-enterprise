/**
 * DSH Auth Service Definition
 * 
 * Provides authentication and authorization capabilities for DeepSeek Harness.
 * Implementations include OAuth providers, API keys, session tokens, and RBAC.
 */

import type { Context, Service, Plugin } from 'cordis'
import type { Schema } from 'schemastery'

import {
  type UserId,
  type OrgId,
  type SessionToken,
  type Principal,
  type UserProfile,
  type AuthConfig,
  type AuthEvent,
  type PermissionContext,
  type AuthResult,
  type LoginCredentials,
  type TokenValidationResult,
  defaultAuthConfig,
  AuthConfigSchema
} from './types.js'

/**
 * Abstract AuthService - implementations provide concrete auth mechanisms
 */
export abstract class AuthService extends Service {
  static readonly name = 'auth'

  abstract validateToken(token: string): Promise<Principal | null>
  abstract getUser(userId: UserId): Promise<UserProfile | null>
  abstract getPermissions(ctx: PermissionContext): boolean
  abstract createSessionToken(principal: Principal, ttlMs?: number): Promise<SessionToken>
  abstract refreshToken(token: SessionToken): Promise<SessionToken>
  abstract revokeToken(token: SessionToken): Promise<void>

  /**
   * Check if a principal has a specific permission
   */
  hasPermission(principal: Principal, permission: string): boolean {
    return principal.permissions.includes(permission as any)
  }

  /**
   * Check if a principal has a specific role
   */
  hasRole(principal: Principal, role: string): boolean {
    return principal.roles.includes(role as any)
  }

  /**
   * Check if principal can access resource with action
   */
  can(principal: Principal, resource: string, action: string): boolean {
    return this.getPermissions({ principal, resource, action })
  }

  /**
   * Get all effective permissions for a principal (including role-based)
   */
  abstract getEffectivePermissions(principal: Principal): Promise<string[]>

  /**
   * Get all effective roles for a principal
   */
  abstract getEffectiveRoles(principal: Principal): Promise<string[]>

  /**
   * Login with credentials
   */
  abstract login(credentials: LoginCredentials): Promise<AuthResult>

  /**
   * Logout/revoke session
   */
  abstract logout(token: SessionToken): Promise<void>

  /**
   * Get current configuration
   */
  abstract getConfig(): AuthConfig

  /**
   * Update configuration (hot-reload capable)
   */
  abstract setConfig(config: Partial<AuthConfig>): Promise<void>
}

/**
 * Auth service registry key for context
 */
declare module 'cordis' {
  interface Context {
    auth: AuthService
  }
}

/**
 * Default permission resolver - can be overridden by implementations
 */
export function defaultPermissionResolver(ctx: PermissionContext): boolean {
  const { principal, resource, action } = ctx
  const requiredPermission = `${resource}:${action}` as const
  
  // Check direct permissions
  if (principal.permissions.includes(requiredPermission)) {
    return true
  }

  // Check wildcard permissions
  const resourceWildcard = `${resource}:*` as const
  if (principal.permissions.includes(resourceWildcard)) {
    return true
  }

  // Check admin permissions
  if (principal.permissions.includes('sandbox:admin') || principal.permissions.includes('org:admin')) {
    return true
  }

  // Check role-based permissions
  const adminRoles = ['org:admin', 'workspace:owner'] as const
  if (principal.roles.some(r => adminRoles.includes(r as any))) {
    return true
  }

  return false
}

/**
 * Create auth plugin for Cordis
 */
export function createAuthPlugin(config?: Partial<AuthConfig>) {
  return (ctx: Context) => {
    // Apply default config
    const finalConfig: AuthConfig = {
      ...defaultAuthConfig,
      ...config,
      providers: {
        ...defaultAuthConfig.providers,
        ...config?.providers
      }
    }

    // Validate config with schemastery
    const validateConfig = (cfg: AuthConfig): AuthConfig => {
      const result = AuthConfigSchema.parse(cfg)
      return result as AuthConfig
    }

    const validatedConfig = validateConfig(finalConfig)

    // Register config
    ctx.set('auth:config', validatedConfig)

    // Emit auth events
    const emitAuthEvent = (event: AuthEvent) => {
      ctx.emit(event.type, event)
    }

    // Provide base service - implementations should extend and register themselves
    ctx.effect(() => {
      // This is the base service - concrete implementations will override
      const baseService: Partial<AuthService> = {
        getConfig: () => validatedConfig,
        setConfig: async (newConfig: Partial<AuthConfig>) => {
          const updated = validateConfig({ ...validatedConfig, ...newConfig })
          Object.assign(validatedConfig, updated)
        },
        getPermissions: defaultPermissionResolver,
        getEffectivePermissions: async (principal: Principal) => {
          // Base implementation returns direct permissions
          return [...principal.permissions]
        },
        getEffectiveRoles: async (principal: Principal) => {
          return [...principal.roles]
        }
      }

      // Register as auth service
      ctx.auth = baseService as AuthService

      return () => {
        // Cleanup
        delete (ctx as any).auth
      }
    })
  }
}

/**
 * Plugin for registering auth service - implementations should use this pattern
 */
export function defineAuthPlugin<
  T extends AuthService
>(serviceClass: new (ctx: Context, config: AuthConfig) => T) {
  return (ctx: Context) => {
    const config = ctx.get('auth:config') as AuthConfig
    
    ctx.effect(() => {
      const service = new serviceClass(ctx, config)
      ctx.auth = service
      
      return () => {
        // Service cleanup handled by Cordis
      }
    })
  }
}

/**
 * Re-export types for convenience
 */
export type {
  UserId,
  OrgId,
  SessionToken,
  Principal,
  UserProfile,
  AuthConfig,
  AuthEvent,
  PermissionContext,
  AuthResult,
  LoginCredentials,
  TokenValidationResult,
  Permission,
  Role
} from './types.js'

export { defaultAuthConfig, AuthConfigSchema } from './types.js'
