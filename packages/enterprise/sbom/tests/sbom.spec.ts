import { describe, it, expect } from 'vitest';
import { checkSbomForCritical, sbomHasComponent } from '../src/sbom.js';

describe('SBOM', () => {
  it('contains ruvector 2.1', () => {
    const sbom = { components: [{ name: 'ruvector-consciousness', version: '2.1', purl: 'pkg:cargo/ruvector-consciousness@2.1' }] };
    expect(sbomHasComponent(sbom as any, 'ruvector-consciousness')).toBe(true);
  });
  it('failOnCritical blocks', () => {
    const sbom: any = { components: [], vulnerabilities: [{ severity: 'critical' }] };
    expect(checkSbomForCritical(sbom).ok).toBe(false);
  });
});
