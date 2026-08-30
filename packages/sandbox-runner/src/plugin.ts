/**
 * Cordis plugin: dsh-enterprise:sandbox-runner
 * Wraps ctx.sandbox.run with RunPhaseRecorder (9 phases) + redaction.
 * Never edits sandbox source; decorates via ctx.sandbox.run.
 * @module @deepseek-ai/dsh-enterprise-sandbox-runner/plugin
 */

import { RunPhaseRecorder } from './phases.js'
import { redactSecrets } from './redaction.js'

export const name = 'dsh-enterprise:sandbox-runner'
export const inject = ['sandbox', 'audit', 'gateway?'] as const

export function apply(ctx: any, _cfg?: unknown): void {
  const orig = ctx.sandbox.run.bind(ctx.sandbox)
  ctx.sandbox.run = async (bundle: unknown) => {
    const recorder = new RunPhaseRecorder((evs) => ctx.audit.emit('run/event', evs))
    // bootstrap — hello fetch stub for P0: return bundle
    await recorder.measure('bootstrap', async () => bundle)
    await recorder.measure('workspace', () => Promise.resolve(undefined))
    await recorder.measure('runner_runtime', () => Promise.resolve(undefined))
    await recorder.measure('package_install', () => Promise.resolve(undefined))
    await recorder.measure('provision', () => Promise.resolve(undefined))
    const result = await recorder.measure('agent', () => orig(bundle))
    // collect secrets from credentials seam if available
    let secrets: string[] = []
    try {
      const creds = ctx.get?.('credentials')
      if (creds) {
        if (Array.isArray(creds.secrets)) secrets = creds.secrets
        else if (typeof creds.getSecrets === 'function') secrets = creds.getSecrets()
        else if (Array.isArray(creds)) secrets = creds
      }
    } catch {
      // best-effort
    }
    await recorder.measure('result_capture', () => Promise.resolve(redactSecrets(result, secrets)))
    await recorder.measure('acceptance', () => Promise.resolve(undefined))
    await recorder.measure('delivery', () => Promise.resolve(undefined))
    return result
  }
}
