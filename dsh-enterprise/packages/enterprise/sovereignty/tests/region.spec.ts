import { describe, it, expect } from 'vitest';
import { enforceRegion, RegionViolationError } from '../src/region-guard.js';

describe('sovereignty region', () => {
  it('allows eu-west-1 when allowed', () => {
    expect(() => enforceRegion('eu-west-1', ['eu-west-1', 'eu-west-3'])).not.toThrow();
  });
  it('rejects us-east-1 when eu-only', () => {
    expect(() => enforceRegion('us-east-1', ['eu-west-1'])).toThrow(RegionViolationError);
  });
});
