import { describe, it, expect, vi } from 'vitest';
import { AuditStore, apply } from '../src/plugin.js';

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
  return { ctx, services, handlers };
}

describe('dsh-audit-log', () => {
  it('hash-chained prevHash and verifyChain', () => {
    const store = new AuditStore();
    store.append('watchtower/receipt-generated', { runId: 'r1' });
    store.append('auth/permission-check', { principal: 'alice' });
    expect(store.entries[1]!.prevHash).toBe(store.entries[0]!.hash);
    expect(store.verifyChain()).toBe(true);
  });
  it('tamper detection', () => {
    const store = new AuditStore();
    store.append('a', { x: 1 });
    store.append('b', { x: 2 });
    expect(store.verifyChain()).toBe(true);
    (store.entries[0] as any).hash = 'tampered';
    expect(store.verifyChain()).toBe(false);
  });
  it('mirrors events via ctx.on', async () => {
    const { ctx, services } = mockCtx();
    apply(ctx);
    const store: AuditStore = services['auditLog'];
    await ctx.waterfall('watchtower/receipt-generated', { runId: 'r1' }, async (e: any) => e);
    await ctx.waterfall('auth/permission-check', { principal: 'alice' }, async (e: any) => e);
    await ctx.waterfall('policy/evaluate', { phi: 0.5 }, async (e: any) => e);
    expect(store.entries.length).toBe(3);
    expect(store.verifyChain()).toBe(true);
  });
});
