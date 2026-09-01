/**
 * RBAC for IIT guards — hierarchical GuardRole enum.
 * @module @deepseek-ai/dsh-enterprise-guards-iit/rbac
 */

export const GUARD_ROLE_LEVELS = {
  'superadmin': 0,
  'tenantadmin': 1,
  'operator': 2,
  'analyst': 3,
  'viewer': 4,
} as const

export type GuardRoleKey = keyof typeof GUARD_ROLE_LEVELS
export type GuardRole = GuardRoleKey

export class GuardRbacError extends Error {
  constructor(message: string, public code = 'RBAC_DENIED') {
    super(message)
    this.name = 'GuardRbacError'
  }
}

function roleLevel(role: GuardRole): number {
  return GUARD_ROLE_LEVELS[role] ?? 99
}

export function hasMinRole(actual: GuardRole, min: GuardRole): boolean {
  return roleLevel(actual) <= roleLevel(min)
}

export function canModifyThresholds(role: GuardRole): boolean {
  return hasMinRole(role, 'operator')
}

export function canOverrideBlock(role: GuardRole): boolean {
  return hasMinRole(role, 'tenantadmin')
}

export function canManageUsers(role: GuardRole): boolean {
  return hasMinRole(role, 'tenantadmin')
}

export function canExportData(role: GuardRole): boolean {
  return hasMinRole(role, 'analyst')
}

export function canReadReceipts(role: GuardRole): boolean {
  return hasMinRole(role, 'viewer')
}

export function requireMinRole(actual: GuardRole, min: GuardRole, action: string): void {
  if (!hasMinRole(actual, min)) {
    throw new GuardRbacError(
      `${action} requires ${min} role, got ${actual}`,
      'INSUFFICIENT_ROLE',
    )
  }
}

export function requireCanModifyThresholds(actual: GuardRole): void {
  requireMinRole(actual, 'operator', 'modify guard thresholds')
}

export function requireCanOverrideBlock(actual: GuardRole): void {
  requireMinRole(actual, 'tenantadmin', 'override block decision')
}

export function requireCanExportData(actual: GuardRole): void {
  requireMinRole(actual, 'analyst', 'export data')
}

export function requireCanManageUsers(actual: GuardRole): void {
  requireMinRole(actual, 'tenantadmin', 'manage org users')
}
