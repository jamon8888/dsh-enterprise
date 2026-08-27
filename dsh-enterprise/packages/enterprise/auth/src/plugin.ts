import { z } from '@deepseek-ai/schemastery';
import * as jose from 'jose';
import type { Principal, Resource } from './types.js';

export const Config = z.object({
  provider: z.enum(['oidc', 'saml']).default('oidc'),
  issuer: z.string().url(),
  jwksUrl: z.string().url(),
  clientId: z.string(),
  roles: z.array(z.string()).default(['org:member']),
  fourEyesThreshold: z.number().int().min(2).default(2),
});

export function checkPermission(principal: Principal, resource: Resource, action: string): boolean {
  // SoD: cannot approve own resource
  if (action === 'approve' && resource.owner === principal.userId) return false;
  if (principal.roles.includes('org:admin') || principal.roles.includes('audit')) return true;
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
  ctx.effect('auth', () => ({
    validateToken: (jwt: string) => validateToken(jwt, config.jwksUrl, config.issuer, config.clientId),
    checkPermission,
  }));
  // Decorate guard waterfall with auth check (SoD) for decision/approval events
  const orig = ctx.tools?.guard?.bind(ctx.tools);
  if (orig) {
    ctx.tools.guard = async (ev: any, next: any) => {
      // Only guard events that require authorization
      const action = ev?.action;
      const resource = ev?.resource;
      const principal = ev?.principal || ctx.auth?.principal;
      if (action && resource && principal) {
        const allowed = checkPermission(principal, resource, action);
        if (!allowed) {
          throw new Error(`Authorization denied: ${principal.userId} cannot ${action} on ${resource.type}:${resource.id}`);
        }
      }
      return next(ev);
    };
  }
}
