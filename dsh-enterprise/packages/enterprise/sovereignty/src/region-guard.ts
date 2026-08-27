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
