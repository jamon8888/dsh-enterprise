import { describe, it, expect } from 'vitest'
import { mkdtempSync, rmSync, existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { runInit } from '../src/init.js'
import { runDoctor } from '../src/doctor.js'
import { verifyReceipt } from '../src/receipt.js'
import { generateReceipt } from '../../watchtower/src/receipts.js'
import type { Run, RunId, SessionId } from '../../watchtower/src/types.js'

function tmp(): string {
  return mkdtempSync(join(tmpdir(), 'cli-test-'))
}

describe('init', () => {
  it('writes .dsh.json + .dsh/iit-config.yaml on tmpdir', async () => {
    const dir = tmp()
    try {
      await runInit({ dir })
      expect(existsSync(join(dir, '.dsh.json'))).toBe(true)
      const j = JSON.parse(readFileSync(join(dir, '.dsh.json'), 'utf8'))
      expect(j.profile).toBe('enterprise')
      expect(existsSync(join(dir, '.dsh/iit-config.yaml'))).toBe(true)
      const yaml = readFileSync(join(dir, '.dsh/iit-config.yaml'), 'utf8')
      expect(yaml).toContain('minPhi')
      // idempotent second run does not duplicate AGENTS block
      await runInit({ dir })
      const agents = readFileSync(join(dir, 'AGENTS.md'), 'utf8')
      const count = (agents.match(/BEGIN dsh-enterprise/g) ?? []).length
      expect(count).toBe(1)
    } finally { rmSync(dir, { recursive: true, force: true }) }
  })
})

describe('doctor', () => {
  it('catches missing workflow', async () => {
    const dir = tmp()
    try {
      await runInit({ dir })
      // remove one workflow
      rmSync(join(dir, '.github/workflows/plan.yml'), { force: true })
      const res = await runDoctor({ dir })
      expect(res.ok).toBe(false)
      expect(res.issues.join('\n')).toContain('missing workflow')
    } finally { rmSync(dir, { recursive: true, force: true }) }
  })
})

describe('receipt verify deterministic', () => {
  it('verifies and is deterministic', async () => {
    const dir = tmp()
    try {
      await runInit({ dir })
      const run: Run = { runId: 'run-xyz' as RunId, sessionId: 'sess-1' as SessionId, agentId: 'a1', log: [{ seq: 1 }], builtAt: 1700000000000, builder: { gitSha: 'abc', crateVersions: {} } }
      const receipt = generateReceipt(run, 'accepted', 'genesis', { phi: 0.5, method: 'exact', cesHash: 'h1' })
      mkdirSync(join(dir, '.dsh/receipts'), { recursive: true })
      writeFileSync(join(dir, '.dsh/receipts', 'run-xyz.json'), JSON.stringify(receipt))
      const r1 = await verifyReceipt('run-xyz', { dir })
      const r2 = await verifyReceipt('run-xyz', { dir })
      expect(r1.ok).toBe(true)
      expect(r2.ok).toBe(true)
      expect(r1.message).toBe(r2.message)
      // tamper detection
      const tampered = { ...receipt, hash: 'badbad' }
      writeFileSync(join(dir, '.dsh/receipts', 'run-xyz.json'), JSON.stringify(tampered))
      const r3 = await verifyReceipt('run-xyz', { dir })
      expect(r3.ok).toBe(false)
    } finally { rmSync(dir, { recursive: true, force: true }) }
  })
})
