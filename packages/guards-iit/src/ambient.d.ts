declare module '@deepseek-ai/schemastery' {
  const z: {
    object: (o: any) => any
    string: () => any
    number: () => any
    boolean: () => any
    array: (t: any) => any
    enum: (vals: any) => any
  } & {
    infer: any
  } & ((...args: any[]) => any)
  export default z
  export = z
}
declare module '@deepseek-ai/cordis' {
  export type Context = any
}
declare module '@deepseek-ai/dsh-invariants' {
  export type InvariantInstaller = (ctx: any) => void
}
declare module '@deepseek-ai/dsh-enterprise-iit-core/pkg' {
  export function calculate_phi_js(tpmJson: string, state: number, budget: string): unknown
  export function enumerate_frontiers(n: number): unknown[]
  export function best_frontier(tpm: unknown): { phi: number }
  export function ews_variance(trajectory: number[]): number
  export function ews_ac1(trajectory: number[]): number
  export const CuspFit: { from_trajectory(trajectory: number[]): { distance_to_bifurcation: number; hysteresis: boolean; alpha: number; beta: number } }
}
