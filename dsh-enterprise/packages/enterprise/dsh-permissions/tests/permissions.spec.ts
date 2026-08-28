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

describe('dsh-permissions', () => {
  it('blocks own approval (SoD)', async () => {
    const ctx = mockCtx();
    apply(ctx);
    const ev = { principal: { userId: 'alice', roles: ['trader'] }, resource: { type: 'deployment', owner: 'alice' }, action: 'approve' };
    await expect(ctx.waterfall('auth/approve', ev, async (e: any) => e)).rejects.toThrow(GuardError);
  });
  it('allows risk approving other', async () => {
    const ctx = mockCtx();
    apply(ctx);
    const ev = { principal: { userId: 'bob', roles: ['risk'] }, resource: { type: 'deployment', owner: 'alice' }, action: 'approve' };
    await expect(ctx.waterfall('auth/approve', ev, async (e: any) => e)).resolves.toBeDefined();
  });
});
