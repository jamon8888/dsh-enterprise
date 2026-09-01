/**
 * RBAC Cordis plugin for IIT guards — enforces role-based access control.
 * Attaches GuardRole to ctx.actor and provides permission-checked guard operations.
 * @module @deepseek-ai/dsh-enterprise-guards-iit/rbac-plugin
 */

import type { Context } from '@deepseek-ai/cordis'
import type { Config } from './config.js'
import {
  type GuardRole,
  canOverrideBlock,
  canModifyThresholds,
  canExportData,
  GuardRbacError,
} from './rbac.js'

declare module '@deepseek-ai/cordis' {
  interface Actor {
    guardRole?: GuardRole
  }
}

export type GuardRbacOps = {
  modifyThresholds: (cfg: Partial<Config>, actor: GuardRole) => void
  overrideBlock: (sessionId: string, guardId: string, actor: GuardRole) => void
  getActorRole: () => GuardRole | undefined
}

export function applyGuardRbac(ctx: Context): void {
  ctx.effect('guardRbac', (): GuardRbacOps => ({
    modifyThresholds: (cfg: Partial<Config>, actor: GuardRole) => {
      if (!canModifyThresholds(actor)) {
        throw new GuardRbacError(
          `cannot modify guard thresholds: ${actor} role cannot modify thresholds (requires operator+)`,
          'THRESHOLD_MODIFY_DENIED',
        )
      }
    },

    overrideBlock: (sessionId: string, _guardId: string, actor: GuardRole) => {
      if (!canOverrideBlock(actor)) {
        throw new GuardRbacError(
          `cannot override block for session ${sessionId}: ${actor} role cannot override blocks (requires tenantadmin+)`,
          'BLOCK_OVERRIDE_DENIED',
        )
      }
    },

    getActorRole: () => (ctx.actor as { guardRole?: GuardRole } | undefined)?.guardRole,
  }))

  ctx.on('guard/modifyThresholds', (ev: { config: Partial<Config> }, next: () => unknown) => {
    const actor = (ctx.actor as { guardRole?: GuardRole } | undefined)?.guardRole
    if (!actor) throw new GuardRbacError('no guardRole on actor', 'ACTOR_MISSING')
    if (!canModifyThresholds(actor)) {
      throw new GuardRbacError(
        `cannot modify guard thresholds: ${actor} role requires operator+`,
        'THRESHOLD_MODIFY_DENIED',
      )
    }
    return next()
  })

  ctx.on('guard/overrideBlock', (ev: { sessionId: string; guardId: string }, next: () => unknown) => {
    const actor = (ctx.actor as { guardRole?: GuardRole } | undefined)?.guardRole
    if (!actor) throw new GuardRbacError('no guardRole on actor', 'ACTOR_MISSING')
    if (!canOverrideBlock(actor)) {
      throw new GuardRbacError(
        `cannot override block on session ${ev.sessionId}: ${actor} role requires tenantadmin+`,
        'BLOCK_OVERRIDE_DENIED',
      )
    }
    return next()
  })
}
