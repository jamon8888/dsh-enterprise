export interface SbomComponent { name: string; version: string; purl: string; }

export function checkSbomForCritical(sbom: { components: SbomComponent[]; vulnerabilities?: { severity: string }[] }): { ok: boolean; critical: number } {
  const critical = (sbom.vulnerabilities ?? []).filter((v) => v.severity === 'critical').length;
  return { ok: critical === 0, critical };
}

export function sbomHasComponent(sbom: { components: SbomComponent[] }, name: string): boolean {
  return sbom.components.some((c) => c.name === name || c.purl.includes(name));
}
