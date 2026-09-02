export class RegionViolationError extends Error {
  constructor(public region: string, public allowed: string[]) {
    super(`region ${region} not in allowedRegions [${allowed.join(',')}]`);
    this.name = 'RegionViolationError';
  }
}

export function enforceRegion(requestedRegion: string, allowedRegions: string[]): void {
  if (!allowedRegions.includes(requestedRegion)) throw new RegionViolationError(requestedRegion, allowedRegions);
}

export function enforceEgress(url: string, allowedRegions: string[], regionMap: Record<string, string>): void {
  const region = regionMap[new URL(url).hostname] ?? 'unknown';
  enforceRegion(region, allowedRegions);
}

export const name = 'dsh-enterprise:sovereignty';
export const inject = [] as const;

/**
 * Emit policy/evaluate before region check so triad can intercept.
 */
export async function enforceRegionWithPolicy(
  ctx: any,
  requestedRegion: string,
  allowedRegions: string[],
  extra?: Record<string, unknown>,
): Promise<void> {
  const ev: any = {
    region: { requestedRegion, allowedRegions, egress: allowedRegions.includes(requestedRegion) ? 'allow' : 'deny' },
    requestedRegion,
    allowedRegions,
    ...extra,
  };
  if (typeof ctx?.waterfall === 'function') {
    await ctx.waterfall('policy/evaluate', ev, async (e: any) => e);
  }
  enforceRegion(requestedRegion, allowedRegions);
}

export function apply(ctx: any): void {
  ctx.effect('sovereignty', () => ({
    enforceRegion,
    enforceEgress,
    enforceRegionWithPolicy: (r: string, a: string[], e?: Record<string, unknown>) => enforceRegionWithPolicy(ctx, r, a, e),
  }));
  // ctx.on hook to emit policy/evaluate before phi/region check
  ctx.on('policy/evaluate', async (ev: any, next: any) => {
    // sovereignty region egress deny handling — let policy-engine decide, just pass through
    return next(ev);
  });
  // also intercept region-specific evaluation for audit
  ctx.on('sovereignty/check', async (ev: any, next: any) => {
    await ctx.waterfall('policy/evaluate', ev, async (e: any) => e);
    return next(ev);
  });
}
