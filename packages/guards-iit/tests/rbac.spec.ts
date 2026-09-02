import { describe, it, expect } from 'vitest'
import {
  hasMinRole,
  canModifyThresholds,
  canOverrideBlock,
  canManageUsers,
  canExportData,
  canReadReceipts,
  requireMinRole,
  requireCanModifyThresholds,
  requireCanOverrideBlock,
  GuardRbacError,
} from '../src/rbac.js'

describe('GuardRole hierarchy', () => {
  it('superadmin >= all roles', () => {
    expect(hasMinRole('superadmin', 'viewer')).toBe(true)
    expect(hasMinRole('superadmin', 'analyst')).toBe(true)
    expect(hasMinRole('superadmin', 'operator')).toBe(true)
    expect(hasMinRole('superadmin', 'tenantadmin')).toBe(true)
    expect(hasMinRole('superadmin', 'superadmin')).toBe(true)
  })

  it('tenantadmin >= operator >= analyst >= viewer', () => {
    expect(hasMinRole('tenantadmin', 'operator')).toBe(true)
    expect(hasMinRole('operator', 'analyst')).toBe(true)
    expect(hasMinRole('analyst', 'viewer')).toBe(true)
  })

  it('viewer cannot access higher roles', () => {
    expect(hasMinRole('viewer', 'analyst')).toBe(false)
    expect(hasMinRole('viewer', 'operator')).toBe(false)
    expect(hasMinRole('viewer', 'tenantadmin')).toBe(false)
    expect(hasMinRole('viewer', 'superadmin')).toBe(false)
  })

  it('operator cannot access tenantadmin+', () => {
    expect(hasMinRole('operator', 'tenantadmin')).toBe(false)
    expect(hasMinRole('operator', 'superadmin')).toBe(false)
  })
})

describe('canModifyThresholds', () => {
  it('viewer/analyst cannot modify thresholds', () => {
    expect(canModifyThresholds('viewer')).toBe(false)
    expect(canModifyThresholds('analyst')).toBe(false)
  })

  it('operator+ can modify thresholds', () => {
    expect(canModifyThresholds('operator')).toBe(true)
    expect(canModifyThresholds('tenantadmin')).toBe(true)
    expect(canModifyThresholds('superadmin')).toBe(true)
  })
})

describe('canOverrideBlock', () => {
  it('viewer/analyst/operator cannot override blocks', () => {
    expect(canOverrideBlock('viewer')).toBe(false)
    expect(canOverrideBlock('analyst')).toBe(false)
    expect(canOverrideBlock('operator')).toBe(false)
  })

  it('tenantadmin+ can override blocks', () => {
    expect(canOverrideBlock('tenantadmin')).toBe(true)
    expect(canOverrideBlock('superadmin')).toBe(true)
  })
})

describe('canManageUsers', () => {
  it('only tenantadmin+ can manage users', () => {
    expect(canManageUsers('viewer')).toBe(false)
    expect(canManageUsers('analyst')).toBe(false)
    expect(canManageUsers('operator')).toBe(false)
    expect(canManageUsers('tenantadmin')).toBe(true)
    expect(canManageUsers('superadmin')).toBe(true)
  })
})

describe('canExportData', () => {
  it('viewer cannot export data', () => {
    expect(canExportData('viewer')).toBe(false)
  })

  it('analyst+ can export data', () => {
    expect(canExportData('analyst')).toBe(true)
    expect(canExportData('operator')).toBe(true)
    expect(canExportData('tenantadmin')).toBe(true)
    expect(canExportData('superadmin')).toBe(true)
  })
})

describe('canReadReceipts', () => {
  it('all roles including viewer can read receipts', () => {
    expect(canReadReceipts('viewer')).toBe(true)
    expect(canReadReceipts('analyst')).toBe(true)
    expect(canReadReceipts('operator')).toBe(true)
    expect(canReadReceipts('tenantadmin')).toBe(true)
    expect(canReadReceipts('superadmin')).toBe(true)
  })
})

describe('requireMinRole', () => {
  it('throws GuardRbacError when role is insufficient', () => {
    expect(() => requireMinRole('viewer', 'operator', 'modify thresholds')).toThrow(GuardRbacError)
    expect(() => requireMinRole('analyst', 'tenantadmin', 'override block')).toThrow(GuardRbacError)
  })

  it('does not throw when role is sufficient', () => {
    expect(() => requireMinRole('operator', 'operator', 'modify thresholds')).not.toThrow()
    expect(() => requireMinRole('tenantadmin', 'operator', 'modify thresholds')).not.toThrow()
    expect(() => requireMinRole('superadmin', 'viewer', 'read receipts')).not.toThrow()
  })
})

describe('requireCanModifyThresholds', () => {
  it('throws for viewer/analyst', () => {
    expect(() => requireCanModifyThresholds('viewer')).toThrow(GuardRbacError)
    expect(() => requireCanModifyThresholds('analyst')).toThrow(GuardRbacError)
    expect(() => requireCanModifyThresholds('operator')).not.toThrow()
  })
})

describe('requireCanOverrideBlock', () => {
  it('throws for viewer/analyst/operator', () => {
    expect(() => requireCanOverrideBlock('viewer')).toThrow(GuardRbacError)
    expect(() => requireCanOverrideBlock('analyst')).toThrow(GuardRbacError)
    expect(() => requireCanOverrideBlock('operator')).toThrow(GuardRbacError)
    expect(() => requireCanOverrideBlock('tenantadmin')).not.toThrow()
  })
})

describe('GuardRbacError', () => {
  it('has correct name and code', () => {
    const err = new GuardRbacError('test message', 'TEST_CODE')
    expect(err.name).toBe('GuardRbacError')
    expect(err.code).toBe('TEST_CODE')
    expect(err.message).toBe('test message')
  })

  it('has default code', () => {
    const err = new GuardRbacError('test')
    expect(err.code).toBe('RBAC_DENIED')
  })
})
