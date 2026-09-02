import { describe, it, expect } from 'vitest';
import { checkPermission } from '../src/plugin.js';

describe('RBAC SoD', () => {
  it('blocks trader approving own signal', () => {
    const p: any = { userId: 'u1', orgId: 'o1', roles: ['trader'] };
    const r: any = { type: 'chain/decision', owner: 'u1' };
    expect(checkPermission(p, r, 'approve')).toBe(false);
  });
  it('allows risk approving other signal', () => {
    const p: any = { userId: 'u2', orgId: 'o1', roles: ['risk'] };
    const r: any = { type: 'chain/decision', owner: 'u1' };
    expect(checkPermission(p, r, 'approve')).toBe(true);
  });
  it('allows audit to approve any', () => {
    const p: any = { userId: 'u9', orgId: 'o1', roles: ['audit'] };
    expect(checkPermission(p, { type: 'chain/decision', owner: 'u9' } as any, 'approve')).toBe(true);
  });
});
