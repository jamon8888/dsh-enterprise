/**
 * Cordis plugin: `dsh-enterprise:session-protocol`.
 * Imports `buildHarnessBundle` from `@facility/harness/session` — no copy.
 * @module @deepseek-ai/dsh-enterprise-session-protocol
 */

import type { Context } from '@deepseek-ai/cordis'
import { createRequire } from 'node:module'

export const name = 'dsh-enterprise:session-protocol'

export function apply(ctx: Context): void {
  ctx.effect('sessionProtocol', () => {
    // Library import per SPEC.md:2.2 — do NOT copy facility/packages/harness/src/session.ts
    // Divergence: if dist not built, require throws; consumer must pnpm install.
    let buildHarnessBundle: typeof import('@facility/harness/session')['buildHarnessBundle']
    try {
      const require = createRequire((import.meta as unknown as { url: string }).url)
      const mod = require('@facility/harness/session') as typeof import('@facility/harness/session')
      buildHarnessBundle = mod.buildHarnessBundle
    } catch (err) {
      throw new Error(
        `@facility/harness/session not resolvable — run pnpm install (github:theam/facility#b150d96). Original: ${String(err)}`,
      )
    }

    return {
      buildHarnessBundle,
    }
  })
}
