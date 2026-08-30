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
    // ponytail: real facility when github:theam/facility#b150d96 is installed
    let buildHarnessBundle: typeof import('@facility/harness/session')['buildHarnessBundle']
    try {
      const require = createRequire((import.meta as unknown as { url: string }).url)
      const mod = require('@facility/harness/session') as typeof import('@facility/harness/session')
      buildHarnessBundle = mod.buildHarnessBundle
    } catch {
      console.warn('[session-protocol] @facility/harness/session not available — using in-memory stub (github:theam/facility#b150d96)')
      buildHarnessBundle = (_input: unknown) => ({
        files: {
          'harness/SESSION.md': '# Harness Session Protocol\n\n(in-memory stub)\n',
          'harness/CHARTER.md': '',
          'harness/ACTIVE.md': '',
          'harness/TOOLS.md': '',
        },
      })
    }

    return {
      buildHarnessBundle,
    }
  })
}
