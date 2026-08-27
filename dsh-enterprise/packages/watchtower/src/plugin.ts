/**
 * Watchtower Cordis plugin — exposes generateReceipt/verifyChain/runWatchtowerJob + hourly scheduler.
 * @module @deepseek-ai/dsh-enterprise-watchtower/plugin
 */

import { generateReceipt, verifyChain } from './receipts.js'
import { runWatchtowerJob } from './job.js'

export const name = 'dsh-enterprise:watchtower'
export const inject = ['sessions', 'audit', 'scheduler?'] as const

// minimal scheduler type for ctx.scheduler.every
type Scheduler = { every(interval: string, fn: () => unknown): void }

export function apply(ctx: any): void {
  ctx.effect('watchtower', () => ({
    generateReceipt,
    verifyChain,
    runWatchtowerJob,
  }))

  const scheduler: Scheduler | undefined = ctx.scheduler as Scheduler | undefined
  if (scheduler?.every) {
    scheduler.every('1h', () => {
      // db/github are expected to be injected via ctx — fallback to no-op in-memory if absent
      const db = ctx.db ?? ctx.sessions?.db ?? {
        findRunsWithoutOutcome: async () => [],
        insertReceipt: async () => {},
      }
      const github = ctx.github ?? {
        getPR: async () => ({ merged: false, closed: false }),
        getChecks: async () => ({ green: false }),
      }
      return runWatchtowerJob(ctx, db, github)
    })
  }
}
