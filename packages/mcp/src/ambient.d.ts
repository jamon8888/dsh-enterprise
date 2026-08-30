declare module '@deepseek-ai/dsh-enterprise-iit-core/pkg' {
  export function calculate_phi_js(tpmJson: string, state: number, budget: string): unknown
}
declare module '@deepseek-ai/dsh-enterprise-watchtower' {
  export function generateReceipt(run: unknown, outcome: string, prevHash: string, phiSnapshot: unknown): unknown
  export function verifyChain(receipts: unknown[]): boolean
}
declare module '@deepseek-ai/cordis' {
  export type Context = {
    effect(name: string, fn: () => unknown): unknown
    on(name: string, fn: (...args: unknown[]) => unknown, opts?: unknown): unknown
    get(name: string): unknown
    invariants: { register(name: string, installer: unknown): () => void }
  }
}
