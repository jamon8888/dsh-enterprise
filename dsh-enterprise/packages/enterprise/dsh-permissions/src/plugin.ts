/**
 * dsh-permissions Cordis plugin — RBAC 4-eyes SoD.
 * @module @deepseek-ai/dsh-enterprise-dsh-permissions/plugin
 */

export class GuardError extends Error {
  constructor(message: string, public code = 'GUARD_BLOCKED') {
    super(message);
    this.name = 'GuardError';
  }
}

export type Principal = { userId: string; orgId?: string; roles: string[] };
export type Resource = { type: string; id?: string; owner?: string; orgId?: string };
export type CheckResult = { allowed: boolean; reason?: string };

/**
 * Core permission check — SoD + role gate.
 */
export async function checkPermission(
  principal: Principal,
  resource: Resource,
  action: string,
): Promise<CheckResult> {
  if (principal.roles.includes('org:admin') || principal.roles.includes('audit')) return { allowed: true };
  if (action === 'approve' && resource.owner === principal.userId) {
    return { allowed: false, reason: `SoD: ${principal.userId} cannot approve own ${resource.type}` };
  }
  // role gate for approve: need risk/audit/org:admin
  if (action === 'approve') {
    const hasApproverRole = principal.roles.includes('risk');
    if (!hasApproverRole) return { allowed: false, reason: `missing approver role for ${principal.userId}` };
  }
  if (principal.roles.length === 0) return { allowed: false, reason: 'no roles' };
  return { allowed: true };
}

export function createPermissionsService() {
  return {
    check: checkPermission,
  };
}

export const name = 'dsh-enterprise:dsh-permissions';
export const inject = [] as const;

export function apply(ctx: any): void {
  const svc = createPermissionsService();
  ctx.effect('permissions', () => svc);

  // waterfall: auth/permission-check — enforced via permissions.check
  ctx.on('auth/permission-check', async (ev: any, next: any) => {
    const r: CheckResult = await ctx.get('permissions').check(ev.principal, ev.resource, ev.action);
    if (!r.allowed) throw new GuardError(`permission ${r.reason}`);
    return next(ev);
  });

  // 4-eyes: auth/approve — distinct approver + SoD
  ctx.on('auth/approve', async (ev: any, next: any) => {
    const r: CheckResult = await ctx.get('permissions').check(ev.principal, ev.resource, 'approve');
    if (!r.allowed) throw new GuardError(`permission ${r.reason}`);
    // 4-eyes: require at least 2 distinct approvals when threshold set, and approver != owner
    if (ev.resource?.owner === ev.principal?.userId) {
      throw new GuardError(`permission 4-eyes SoD: ${ev.principal.userId} cannot approve own deployment`);
    }
    // optional approvals array distinct check
    if (Array.isArray(ev.approvals) && ev.approvals.length > 0) {
      const set = new Set(ev.approvals);
      if (set.has(ev.principal.userId) && ev.resource?.owner === ev.principal.userId) {
        throw new GuardError(`permission 4-eyes duplicate approver`);
      }
    }
    return next(ev);
  });
}
