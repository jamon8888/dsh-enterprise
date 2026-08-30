import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { GitWorktreeService } from '../src/plugin.js'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { exec } from 'node:child_process'

const uuid = randomUUID().slice(0, 8)
const TEST_DIR = `/tmp/dsh-git-worktree-test-${uuid}`

async function setupGitRepo(dir: string): Promise<void> {
  await mkdir(dir, { recursive: true })
  await writeFile(join(dir, 'README.md'), '# test')
  await execPromise('git init && git config user.email "test@test.com" && git config user.name "Test"', dir)
  await execPromise('git add . && git commit -m "init"', dir)
}

function execPromise(cmd: string, cwd: string): Promise<void> {
  return new Promise((res, rej) => {
    exec(cmd, { cwd }, (err) => (err ? rej(err) : res()))
  })
}

async function cleanupTestDir(): Promise<void> {
  try {
    const { rmSync } = await import('node:fs')
    rmSync(TEST_DIR, { recursive: true, force: true })
  } catch {
    // ignore
  }
}

describe('dsh-git-worktree', () => {
  beforeEach(async () => {
    await cleanupTestDir()
    await setupGitRepo(TEST_DIR)
  })

  afterEach(async () => {
    await cleanupTestDir()
  })

  // ponytail: all tests use real git worktree commands; git CLI availability is assumed.

  it('list() — empty worktree list (only main)', async () => {
    const svc = new GitWorktreeService(TEST_DIR)
    const entries = await svc.list()
    expect(entries.length).toBeGreaterThanOrEqual(1)
    expect(entries[0]!.path).toBe(TEST_DIR)
    expect(entries[0]!.branch).toBeTruthy()
  })

  it('list() — parses one worktree correctly', async () => {
    const wtPath = `/tmp/test-wt-one-${uuid}`
    await execPromise(`git worktree add "${wtPath}" -b feature/one-${uuid}`, TEST_DIR)
    try {
      const svc = new GitWorktreeService(TEST_DIR)
      const entries = await svc.list()
      const worktreeEntry = entries.find((e) => e.path === wtPath)
      expect(worktreeEntry).toBeDefined()
      expect(worktreeEntry!.branch).toBe(`feature/one-${uuid}`)
      expect(worktreeEntry!.HEAD).toBeTruthy()
    } finally {
      await rm(wtPath, { recursive: true, force: true }).catch(() => {})
    }
  })

  it('list() — parses multiple worktrees', async () => {
    const wt1 = `/tmp/test-wt-multi1-${uuid}`
    const wt2 = `/tmp/test-wt-multi2-${uuid}`
    await execPromise(`git worktree add "${wt1}" -b feature/multi1-${uuid}`, TEST_DIR)
    await execPromise(`git worktree add "${wt2}" -b feature/multi2-${uuid}`, TEST_DIR)
    try {
      const svc = new GitWorktreeService(TEST_DIR)
      const entries = await svc.list()
      expect(entries.length).toBeGreaterThanOrEqual(3)
      const paths = entries.map((e) => e.path)
      expect(paths).toContain(wt1)
      expect(paths).toContain(wt2)
    } finally {
      await rm(wt1, { recursive: true, force: true }).catch(() => {})
      await rm(wt2, { recursive: true, force: true }).catch(() => {})
    }
  })

  it('add() — creates new worktree with new branch', async () => {
    const wtPath = `/tmp/test-wt-add1-${uuid}`
    const svc = new GitWorktreeService(TEST_DIR)
    await svc.add(`feature/add1-${uuid}`, wtPath)
    try {
      const entries = await svc.list()
      const found = entries.find((e) => e.path === wtPath)
      expect(found).toBeDefined()
      expect(found!.branch).toBe(`feature/add1-${uuid}`)
    } finally {
      await rm(wtPath, { recursive: true, force: true }).catch(() => {})
    }
  })

  it('add() — creates worktree from existing branch', async () => {
    const branchName = `feature/existing-${uuid}`
    await execPromise(`git branch "${branchName}"`, TEST_DIR)
    const wtPath = `/tmp/test-wt-from-existing-${uuid}`
    const svc = new GitWorktreeService(TEST_DIR)
    await svc.addFrom(branchName, wtPath)
    try {
      const entries = await svc.list()
      const found = entries.find((e) => e.path === wtPath)
      expect(found).toBeDefined()
      expect(found!.branch).toBe(branchName)
    } finally {
      await rm(wtPath, { recursive: true, force: true }).catch(() => {})
    }
  })

  it('add() — fails when branch already has a worktree', async () => {
    const branchName = `feature/dupe-${uuid}`
    const wtPath1 = `/tmp/test-wt-dupe1-${uuid}`
    const wtPath2 = `/tmp/test-wt-dupe2-${uuid}`
    const svc = new GitWorktreeService(TEST_DIR)
    await svc.add(branchName, wtPath1)
    try {
      await expect(svc.add(branchName, wtPath2)).rejects.toThrow()
    } finally {
      await rm(wtPath1, { recursive: true, force: true }).catch(() => {})
    }
  })

  it('remove() — removes clean worktree', async () => {
    const wtPath = `/tmp/test-wt-rm-${uuid}`
    await execPromise(`git worktree add "${wtPath}" -b feature/rm-${uuid}`, TEST_DIR)
    const svc = new GitWorktreeService(TEST_DIR)
    await svc.remove(wtPath)
    const entries = await svc.list()
    const found = entries.find((e) => e.path === wtPath)
    expect(found).toBeUndefined()
    await rm(wtPath, { recursive: true, force: true }).catch(() => {})
  })

  it('remove() — remove with force flag', async () => {
    const wtPath = `/tmp/test-wt-force-${uuid}`
    await execPromise(`git worktree add "${wtPath}" -b feature/force-${uuid}`, TEST_DIR)
    const svc = new GitWorktreeService(TEST_DIR)
    await svc.remove(wtPath, true)
    const entries = await svc.list()
    const found = entries.find((e) => e.path === wtPath)
    expect(found).toBeUndefined()
    await rm(wtPath, { recursive: true, force: true }).catch(() => {})
  })

  it('prune() — prunes stale entries', async () => {
    const wtPath = `/tmp/test-wt-prune-${uuid}`
    await execPromise(`git worktree add "${wtPath}" -b feature/prune-${uuid}`, TEST_DIR)
    await rm(wtPath, { recursive: true, force: true })
    const svc = new GitWorktreeService(TEST_DIR)
    await svc.prune()
    const entries = await svc.list()
    const found = entries.find((e) => e.path === wtPath)
    expect(found).toBeUndefined()
  })

  it('error path — throws Error on git failure with stderr message', async () => {
    const svc = new GitWorktreeService(TEST_DIR)
    await expect(svc.remove('/tmp/nonexistent-worktree-xyz')).rejects.toThrow(Error)
    try {
      await svc.remove('/tmp/nonexistent-worktree-xyz')
    } catch (e) {
      expect((e as Error).message).toBeTruthy()
    }
  })
})
