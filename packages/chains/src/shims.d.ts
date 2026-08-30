declare module '@facility/harness/chains' {
  export type ChainTypeConfig = { prefix: string; name: string; parentTypes: string[]; schema: unknown }
  export type ArtifactChainConfig = { id: 'research' | 'product'; name: string; activeName: string; charterName: string; types: Record<string, ChainTypeConfig> }
  export const productChain: ArtifactChainConfig
  export const researchChain: ArtifactChainConfig
  export const bundledChains: Record<string, ArtifactChainConfig>
  export function chainFromConfig(config: unknown): ArtifactChainConfig
}
declare module '@facility/harness/validate' {
  export function validate(input: unknown): { ok: boolean; errors: Array<{ code: string }>; warnings: unknown[] }
}
declare module '@deepseek-ai/cordis' {
  export type Context = {
    effect(name: string, fn: () => unknown): unknown
    on(name: string, fn: (...args: unknown[]) => unknown, opts?: unknown): unknown
    get(name: string): unknown
    invariants: { register(name: string, installer: unknown): () => void }
    plugin(fn: unknown): Promise<unknown>
    events: { dispatch(mode: string, args: unknown[]): unknown[] }
    logger: { warn(msg: string): void }
    sessions: { list(): unknown[] }
  }
  export class Service { constructor(ctx: Context, name: string) }
}
declare module '@deepseek-ai/dsh-invariants' {
  export type InvariantFailure = (msg: string) => never
  export interface InvariantInstaller { (ctx: any, fail: InvariantFailure): void | Promise<void>; inject?: readonly string[] }
  export class InvariantError extends Error {}
}
declare module 'node:module' {
  export function createRequire(filename: string): NodeRequire
}
