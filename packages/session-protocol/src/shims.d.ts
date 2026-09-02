declare module '@facility/harness/chains' {
  export type ChainTypeConfig = { prefix: string; name: string; parentTypes: string[]; schema: unknown }
  export type ArtifactChainConfig = { id: string; name: string; activeName: string; charterName: string; types: Record<string, ChainTypeConfig> }
  export const productChain: ArtifactChainConfig
  export const researchChain: ArtifactChainConfig
  export function chainFromConfig(config: unknown): ArtifactChainConfig
}
declare module '@facility/harness/session' {
  export function buildHarnessBundle(input: { chain: import('@facility/harness/chains').ArtifactChainConfig; charterMd: string; activeMd: string; runId: string; mode?: string }): { files: Record<string, string> }
}
declare module '@deepseek-ai/cordis' {
  export type Context = {
    effect(name: string, fn: () => unknown): unknown
    on(name: string, fn: (...args: unknown[]) => unknown, opts?: unknown): unknown
    get(name: string): unknown
    invariants: { register(name: string, installer: unknown): () => void }
  }
  export class Service { constructor(ctx: Context, name: string) }
}
declare module '@deepseek-ai/dsh-invariants' {
  export type InvariantFailure = (msg: string) => never
  export interface InvariantInstaller { (ctx: any, fail: InvariantFailure): void | Promise<void>; inject?: readonly string[] }
}
declare module 'node:module' {
  export function createRequire(filename: string): NodeRequire
}
declare module '@deepseek-ai/dsh-session' {
  export interface SessionEventMap {}
}
