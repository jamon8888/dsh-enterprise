import { describe, it, expect, vi } from 'vitest'
import { apply as applyGuards, GuardError } from '../src/guard-runner.ts'

function mockCtx(overrides: Record<string, unknown> = {}) {
  const baseServices = {
    calculatePhi: async () => ({ phi: 0.5, cesHash: 'abc' }),
    runCusp: async () => ({ ok: true }),
    ignition_score_wasm: async (broadcast: string, fanOut: number, threshold: number) => {
      const arr = JSON.parse(broadcast)
      const score = arr.reduce((a: number, b: number) => a + b, 0) / arr.length * fanOut
      return { score, ignited: score > threshold, threshold }
    },
    phi_trajectory_wasm: async () => ({ phi_current: 0.2, phi_mean: 0.5, drift: -0.1, slope: -0.01, variance: 0.01, alert: 'none' }),
    teloids_compile_wasm: async (yaml: string) => ({ teloids: [], default_severity: 'warn' }),
    teloids_evaluate_wasm: async () => ({ disposition: 'allow', violated: [], reason: '' }),
  }

  const overrideServices = overrides.services as Record<string, unknown> | undefined
  const services = {
    iitGuards: { ...baseServices, ...(overrideServices?.iitGuards ?? {}) },
  }

  const handlers: Record<string, unknown> = {}
  const ctx: Record<string, unknown> = {
    effect: vi.fn((nameOrFn: unknown, fn?: unknown) => {
      typeof nameOrFn === 'string' ? (fn as () => unknown)() : (nameOrFn as () => unknown)()
      return () => {}
    }),
    on: vi.fn((event: string, handler: unknown) => {
      handlers[event] = handler
      return () => {}
    }),
    get: vi.fn((k: string) => {
      if (k === 'iitGuards') return services.iitGuards
      return undefined
    }),
    emit: async (event: string, ev: unknown) => {
      const handler = handlers[event] as (ev: unknown, next: (ev: unknown) => Promise<unknown>) => Promise<unknown> | undefined
      if (!handler) return ev
      try {
        return await handler(ev, async (e: unknown) => e)
      } catch (e) {
        throw e
      }
    },
    tools: {},
    ...overrides,
  }
  return { ctx }
}

describe('IIT advanced guards integration', () => {
  it('workspace-ignition blocks when ignited', async () => {
    const { ctx } = mockCtx({
      services: {
        iitGuards: {
          ignition_score_wasm: async (broadcast: string, fanOut: number, threshold: number) => {
            const arr = JSON.parse(broadcast)
            const score = arr.reduce((a: number, b: number) => a + b, 0) / arr.length * fanOut
            return { score, ignited: score > threshold, threshold }
          },
        },
      },
    })
    const { apply } = await import('../src/guard-runner.ts')
    apply(ctx as never, { minPhi: 0.1, workspaceIgnition: { enabled: true, threshold: 1.0 } })

    try {
      await ctx.emit('tools/guard', { tpm: {}, state: 0, broadcast: [1.0, 1.0], fan_out: 2 })
    } catch (e) {
      expect((e as Error).message).toContain('workspace ignition')
      return
    }
    throw new Error('Expected workspace ignition to throw')
  })

  it('effect-ethos denies forbidden tool', async () => {
    const { ctx } = mockCtx({
      services: {
        iitGuards: {
          teloids_compile_wasm: async (yaml: string) => ({ teloids: [], default_severity: 'warn' }),
          teloids_evaluate_wasm: async () => ({
            disposition: 'deny' as const,
            violated: ['no-destructive'],
            reason: 'Forbidden by teloid',
          }),
        },
      },
    })
    const { apply } = await import('../src/guard-runner.ts')
    apply(ctx as never, {
      minPhi: 0.1,
      effectEthos: {
        enabled: true,
        teloidsYaml: '- id: "no-destructive"\n  obligation: "forbid"\n  scope: ["tool:bash"]\n',
        severity: 'warn',
      },
    })

    try {
      await ctx.emit('tools/guard', { tool: 'tool:bash', args: { command: 'rm -rf /' } })
    } catch (e) {
      expect((e as Error).message).toContain('effect-ethos')
      return
    }
    throw new Error('Expected effect-ethos to throw')
  })
})
