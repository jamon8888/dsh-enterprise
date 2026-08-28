import { describe, it, expect, vi } from 'vitest';
import { apply as permissionsApply, GuardError as PermGuardError } from '../../packages/enterprise/dsh-permissions/src/plugin.js';
import { apply as policyApply, GuardError as PolicyGuardError } from '../../packages/enterprise/dsh-policy-engine/src/plugin.js';
import { AuditStore, apply as auditApply } from '../../packages/enterprise/dsh-audit-log/src/plugin.js';

function mockCtx() {
  const handlers: Record<string, Array<(ev: any, next: any) => Promise<any>>> = {};
  const services: Record<string, any> = {};
  const ctx: any = {
    effect: vi.fn((name: string, factory: () => any) => {
      services[name] = factory();
      return () => {};
    }),
    on: vi.fn((event: string, handler: any) => {
      if (!handlers[event]) handlers[event] = [];
      handlers[event].push(handler);
      return () => {};
    }),
    get: vi.fn((k: string) => services[k]),
    waterfall: async (event: string, ev: any, next: any) => {
      const list = handlers[event] ?? [];
      let idx = -1;
      const dispatch = async (curEv: any): Promise<any> => {
        idx++;
        if (idx < list.length) {
          const h = list[idx]!;
          return h(curEv, dispatch);
        }
        return next(curEv);
      };
      return dispatch(ev);
    },
    emit: vi.fn((event: string, ev: any) => {
      const list = handlers[event] ?? [];
      for (const h of list) h(ev, async (x: any) => x);
    }),
  };
  return { ctx, handlers, services };
}

describe('security triad integration', () => {
  it('Alice cannot approve own deployment (SoD)', async () => {
    const { ctx } = mockCtx();
    permissionsApply(ctx);
    // also need policy and audit not needed for this test
    const alice = { userId: 'alice', orgId: 'org1', roles: ['trader'] } as any;
    const resource = { type: 'deployment', id: 'dep1', owner: 'alice' } as any;
    const ev = { principal: alice, resource, action: 'approve', approvals: ['alice'] };
    await expect(ctx.waterfall('auth/approve', ev, async (e: any) => e)).rejects.toThrow(PermGuardError);
    await expect(ctx.waterfall('auth/permission-check', ev, async (e: any) => e)).rejects.toThrow(PermGuardError);
  });

  it('EU-airgapped org gets local model only (region)', async () => {
    const { ctx } = mockCtx();
    policyApply(ctx);
    // remote model should be blocked when egress deny
    const evRemote = {
      region: { egress: 'deny', requestedRegion: 'us-east-1', allowedRegions: ['eu-west-1'] },
      model: 'gpt-4',
      orgType: 'eu-airgapped',
      phi: 0.5,
      minPhi: 0.1,
    };
    await expect(ctx.waterfall('policy/evaluate', evRemote, async (e: any) => e)).rejects.toThrow(PolicyGuardError);
    // local model should pass
    const evLocal = {
      region: { egress: 'deny', requestedRegion: 'eu-west-1', allowedRegions: ['eu-west-1'] },
      model: 'local',
      orgType: 'eu-airgapped',
      phi: 0.5,
      minPhi: 0.1,
    };
    await expect(ctx.waterfall('policy/evaluate', evLocal, async (e: any) => e)).resolves.toBeDefined();
    // phi threshold also enforced
    const evLowPhi = { phi: 0.01, minPhi: 0.1, region: { egress: 'allow' } };
    await expect(ctx.waterfall('policy/evaluate', evLowPhi, async (e: any) => e)).rejects.toThrow(PolicyGuardError);
  });

  it('tamper detection (verifyChain false after entries[0].hash=\'tampered\')', async () => {
    const store = new AuditStore();
    store.append('watchtower/receipt-generated', { runId: 'r1', hash: 'abc' });
    store.append('auth/permission-check', { principal: 'alice', action: 'approve' });
    store.append('policy/evaluate', { phi: 0.5 });
    expect(store.verifyChain()).toBe(true);
    // also verify mirroring via ctx.on works
    const { ctx, services } = mockCtx();
    auditApply(ctx);
    const store2: AuditStore = services['auditLog'];
    await ctx.waterfall('watchtower/receipt-generated', { runId: 'r2' }, async (e: any) => e);
    expect(store2.entries.length).toBe(1);
    expect(store2.verifyChain()).toBe(true);
    // tamper
    (store.entries[0] as any).hash = 'tampered';
    expect(store.verifyChain()).toBe(false);
  });
});
