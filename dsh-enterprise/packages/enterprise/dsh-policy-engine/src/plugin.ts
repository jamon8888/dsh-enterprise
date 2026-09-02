/**
 * dsh-policy-engine Cordis plugin — OPA-style region egress + phi guard.
 * @module @deepseek-ai/dsh-enterprise-dsh-policy-engine/plugin
 */

export class GuardError extends Error {
  constructor(message: string, public code = 'GUARD_BLOCKED') {
    super(message);
    this.name = 'GuardError';
  }
}

export type PolicyEvent = {
  principal?: { userId: string; orgId?: string };
  resource?: { type?: string; id?: string };
  region?: { egress?: string; requestedRegion?: string; allowedRegions?: string[]; model?: string };
  sovereignty?: { egress?: string };
  phi?: number;
  minPhi?: number;
  model?: string;
  requestedModel?: string;
  orgType?: string;
  [k: string]: unknown;
};

export type PolicyResult = { allowed: boolean; reason?: string };

/**
 * Evaluate policy: region egress deny + phi threshold.
 */
export async function evaluatePolicy(ev: PolicyEvent): Promise<PolicyResult> {
  // sovereignty region egress deny when region.egress=='deny'
  const egress = (ev.region?.egress ?? ev.sovereignty?.egress) as string | undefined;
  if (egress === 'deny') {
    // if requestedRegion not allowed, deny
    const requested = (ev.region?.requestedRegion ?? (ev as any).requestedRegion) as string | undefined;
    const allowed = (ev.region?.allowedRegions ?? (ev as any).allowedRegions) as string[] | undefined;
    if (requested && allowed && !allowed.includes(requested)) {
      return { allowed: false, reason: `region ${requested} not in allowedRegions [${allowed.join(',')}]` };
    }
    // EU-airgapped org gets local model only
    const model = (ev.model ?? ev.requestedModel ?? ev.region?.model) as string | undefined;
    const orgType = (ev as any).orgType as string | undefined;
    // enforce local model when egress deny: remote models blocked
    if (model && model !== 'local') {
      // if org is EU-airgapped or generic egress deny, only local allowed
      if (orgType === 'eu-airgapped' || egress === 'deny') {
        // allow local only — block non-local
        const isLocal = model === 'local';
        if (!isLocal) return { allowed: false, reason: `egress deny: model ${model} blocked, local only` };
      }
    }
    // generic egress deny without model specified still blocks egress
    if (!model && (orgType === 'eu-airgapped' || requested)) {
      // already handled requestedRegion; otherwise generic deny if any egress attempt
      // if ev has a flag indicating remote egress, block
      if ((ev as any).egressAttempt === true) return { allowed: false, reason: 'egress deny' };
    }
  }

  // guards-iit phi < minPhi rule
  if (typeof ev.phi === 'number' && typeof ev.minPhi === 'number') {
    if (ev.phi < ev.minPhi) return { allowed: false, reason: `phi ${ev.phi} < minPhi ${ev.minPhi}` };
  }

  return { allowed: true };
}

export function createPolicyService() {
  return { evaluate: evaluatePolicy };
}

export const name = 'dsh-enterprise:dsh-policy-engine';
export const inject = [] as const;

export function apply(ctx: any): void {
  const svc = createPolicyService();
  ctx.effect('policyEngine', () => svc);
  // also expose as policy for ctx.get('policy')
  ctx.effect('policy', () => svc);

  ctx.on('policy/evaluate', async (ev: PolicyEvent, next: any) => {
    // wire to sovereignty region egress deny and guards-iit phi rule
    const r = await ctx.get('policyEngine').evaluate(ev);
    if (!r.allowed) throw new GuardError(`policy ${r.reason}`);
    // also check via sovereignty service if available
    try {
      const sov = ctx.get('sovereignty') as { enforceRegion?: (r: string, allowed: string[]) => void } | undefined;
      if (sov?.enforceRegion && ev.region?.requestedRegion && ev.region?.allowedRegions) {
        sov.enforceRegion(ev.region.requestedRegion, ev.region.allowedRegions);
      }
    } catch {
      // sovereignty not available -> already handled via evaluate
    }
    return next(ev);
  });
}
