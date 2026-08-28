/**
 * model-registry Cordis plugin — AI Act model version + deployment tracking.
 * @module @deepseek-ai/dsh-enterprise-model-registry/plugin
 */

import { registerModel, getModel, type ModelVersion } from './registry.js'

// ponytail: in-memory Map, PG when gateway pg lands
export const modelDeployments = new Map<string, { modelVersion: string; region: string; teloidHash: string; ts: number }>()

export function clearDeployments(): void {
  modelDeployments.clear()
}

export const name = 'dsh-enterprise:model-registry'
export const inject = [] as const

export function apply(ctx: any): void {
  ctx.effect('model-registry', () => ({ registerModel, getModel, modelDeployments, deployments: modelDeployments, clearDeployments }))
  ctx.effect('modelDeployments', () => modelDeployments)
  ctx.on('gateway/request', async (ev: any, next: any) => {
    const modelVersion = ev?.modelVersion ?? ev?.model ?? ev?.modelId ?? 'unknown'
    const region = ev?.region ?? ev?.sovereignty?.region ?? 'unknown'
    const teloidHash = ev?.teloidHash ?? ev?.hash ?? ev?.trainingDataHash ?? ''
    const ts = Date.now()
    const key = `${String(modelVersion)}:${String(region)}:${ts}:${Math.random().toString(36).slice(2, 6)}`
    modelDeployments.set(key, { modelVersion: String(modelVersion), region: String(region), teloidHash: String(teloidHash), ts })
    const out = { ...(ev as object), deploymentRecorded: true }
    return typeof next === 'function' ? next(out) : out
  })
}

export type { ModelVersion }
export { registerModel, getModel }
