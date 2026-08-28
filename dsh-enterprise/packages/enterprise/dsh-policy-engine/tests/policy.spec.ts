import { describe, it, expect, vi } from 'vitest';
import { apply, GuardError } from '../src/plugin.js';

function mockCtx() {
  const handlers: Record<string, any[]> = {};
  const services: Record<string, any> = {};
  const ctx: any = {
    effect: vi.fn((n: string, f: () => any) => { services[n] = f(); return () => {}; }),
    on: vi.fn((e: string, h: any) => { (handlers[e] ??= []).push(h); return () => {}; }),
    get: vi.fn((k: string) => services[k]),
    waterfall: async (event: string, ev: any, next: any) => {
      const list = handlers[event] ?? [];
      let i = -1;
      const dispatch = async (cur: any): Promise<any> => {
        i++;
        if (i < list.length) return list[i](cur, dispatch);
        return next(cur);
      };
      return dispatch(ev);
    },
  };
  return ctx;
}

describe('dsh-policy-engine', () => {
  it('denies egress when region.egress==deny', async () => {
    const ctx = mockCtx();
    apply(ctx);
    const ev = { region: { egress: 'deny', requestedRegion: 'us-east-1', allowedRegions: ['eu-west-1'] }, model: 'gpt-4', orgType: 'eu-airgapped' };
    await expect(ctx.waterfall('policy/evaluate', ev, async (e: any) => e)).rejects.toThrow(GuardError);
  });
  it('allows local model when egress deny', async () => {
    const ctx = mockCtx();
    apply(ctx);
    const ev = { region: { egress: 'deny', requestedRegion: 'eu-west-1', allowedRegions: ['eu-west-1'] }, model: 'local', phi: 0.5, minPhi: 0.1 };
    await expect(ctx.waterfall('policy/evaluate', ev, async (e: any) => e)).resolves.toBeDefined();
  });
  it('denies phi < minPhi', async () => {
    const ctx = mockCtx();
    apply(ctx);
    const ev = { phi: 0.01, minPhi: 0.1 };
    await expect(ctx.waterfall('policy/evaluate', ev, async (e: any) => e)).rejects.toThrow(GuardError);
  });
});
