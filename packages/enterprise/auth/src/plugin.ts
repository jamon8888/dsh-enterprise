import z from '@deepseek-ai/schemastery';
import * as jose from 'jose';
import type { Principal, Resource } from './types.js';

export const Config = z.object({
  provider: z.string(),
  issuer: z.string(),
  jwksUrl: z.string(),
  clientId: z.string(),
  roles: z.array(z.string()),
  fourEyesThreshold: z.number(),
});

export function checkPermission(principal: Principal, resource: Resource, action: string): boolean {
  if (principal.roles.includes('org:admin') || principal.roles.includes('audit')) return true;
  // SoD: cannot approve own resource (audit/org:admin already passed)
  if (action === 'approve' && resource.owner === principal.userId) return false;
  if (action === 'approve' && !principal.roles.includes('risk') && !principal.roles.includes('audit')) return false;
  return principal.roles.length > 0;
}

export async function validateToken(jwt: string, jwksUrl: string, issuer: string, audience: string): Promise<Principal> {
  const JWKS = jose.createRemoteJWKSet(new URL(jwksUrl));
  const { payload } = await jose.jwtVerify(jwt, JWKS, { issuer, audience });
  return {
    userId: payload.sub as any,
    orgId: (payload.org_id ?? payload.orgId ?? 'default') as any,
    roles: ((payload.roles as string[]) ?? ['org:member']) as any,
    email: payload.email as string | undefined,
  };
}

export const name = 'dsh-enterprise:auth';
export const inject = ['sessions', 'tools'] as const;
export function apply(ctx: any, config: z.infer<typeof Config>) {
  // helper to emit auth/permission-check waterfall so triad can intercept
  async function emitPermissionCheck(ev: any): Promise<void> {
    if (typeof ctx.waterfall === 'function') {
      await ctx.waterfall('auth/permission-check', ev, async (e: any) => e);
    } else if (typeof ctx.emit === 'function') {
      ctx.emit('auth/permission-check', ev);
    }
  }

  // wrapped checkPermission that emits before check
  async function checkPermissionWithEmit(principal: Principal, resource: Resource, action: string): Promise<boolean> {
    const ev = { principal, resource, action };
    await emitPermissionCheck(ev);
    return checkPermission(principal, resource, action);
  }

  ctx.effect('auth', () => ({
    validateToken: (jwt: string) => validateToken(jwt, config.jwksUrl, config.issuer, config.clientId),
    checkPermission: checkPermissionWithEmit,
    checkPermissionSync: checkPermission,
  }));

  // also expose ctx.on hook that emits before check (for direct callers)
  ctx.on('auth/permission-check', async (ev: any, next: any) => {
    return next(ev);
  });

  // Decorate guard waterfall with auth check (SoD) for decision/approval events
  const orig = ctx.tools?.guard?.bind(ctx.tools);
  if (orig) {
    ctx.tools.guard = async (ev: any, next: any) => {
      const action = ev?.action;
      const resource = ev?.resource;
      const principal = ev?.principal || ctx.auth?.principal;
      if (action && resource && principal) {
        const ev2 = { principal, resource, action };
        await emitPermissionCheck(ev2);
        const allowed = checkPermission(principal, resource, action);
        if (!allowed) {
          throw new Error(`Authorization denied: ${principal.userId} cannot ${action} on ${resource.type}:${resource.id}`);
        }
      }
      return next(ev);
    };
  } else {
    ctx.on('tools/guard', async (ev: any, next: any) => {
      const action = ev?.action;
      const resource = ev?.resource;
      const principal = ev?.principal;
      if (action && resource && principal) {
        await emitPermissionCheck({ principal, resource, action });
        const allowed = checkPermission(principal, resource, action);
        if (!allowed) throw new Error(`Authorization denied: ${principal.userId} cannot ${action} on ${resource.type}`);
      }
      return next(ev);
    });
  }
}
