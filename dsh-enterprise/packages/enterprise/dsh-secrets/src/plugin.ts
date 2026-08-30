/**
 * dsh-secrets Cordis plugin — Vault/1Password injection for gateway + model-registry.
 * @module @deepseek-ai/dsh-enterprise-secrets/plugin
 */

export const name = 'dsh-enterprise:dsh-secrets'
export const inject = [] as const

export interface SecretsProvider {
  get(key: string): string | undefined
  set(key: string, value: string): void
  list(): string[]
  delete(key: string): boolean
}

export class InMemoryProvider implements SecretsProvider {
  private map = new Map<string, string>()

  get(key: string): string | undefined {
    return this.map.get(key) ?? process.env[key]
  }

  set(key: string, value: string): void {
    this.map.set(key, value)
  }

  list(): string[] {
    return [...this.map.keys()]
  }

  delete(key: string): boolean {
    return this.map.delete(key)
  }

  clear(): void {
    this.map.clear()
  }
}

export class SecretsService {
  constructor(private providers: SecretsProvider[] = [new InMemoryProvider()]) {}

  get(key: string): string | undefined {
    for (const provider of this.providers) {
      const value = provider.get(key)
      if (value !== undefined) return value
    }
    return undefined
  }

  set(key: string, value: string): void {
    this.providers[0]?.set(key, value)
  }

  delete(key: string): boolean {
    return this.providers[0]?.delete(key) ?? false
  }

  list(): string[] {
    return this.providers[0]?.list() ?? []
  }

  clear(): void {
    const p = this.providers[0]
    if (p && 'clear' in p && typeof p.clear === 'function') {
      p.clear()
    }
  }
}

// ponytail: real Vault/1Password when enterprise secrets infra deployed
export function apply(ctx: any): void {
  const svc = new SecretsService()
  ctx.effect('secrets', () => svc)
  ctx.effect('secretsManager', () => svc)

  ctx.on('gateway/request', async (ev: any, next: any) => {
    const keys = svc.list()
    const snap: Record<string, string | undefined> = {}
    for (const k of keys) {
      snap[k] = process.env[k]
      process.env[k] = svc.get(k)
    }
    try {
      return await next(ev)
    } finally {
      for (const k of keys) {
        if (snap[k] === undefined) {
          delete process.env[k]
        } else {
          process.env[k] = snap[k]
        }
      }
    }
  })
}
