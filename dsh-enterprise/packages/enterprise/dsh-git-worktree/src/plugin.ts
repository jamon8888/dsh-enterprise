/**
 * dsh-git-worktree Cordis plugin — git worktree CLI wrapper.
 * @module @deepseek-ai/dsh-enterprise-dsh-git-worktree/plugin
 */

export const name = 'dsh-enterprise:dsh-git-worktree'
export const inject = [] as const

export type GitWorktreeEntry = {
  name: string
  path: string
  branch: string
  HEAD: string
}

// ponytail: git CLI required on PATH. All operations are standard git commands.
// In-memory mock not provided — CI must have git installed; fallback to skip tests if git unavailable.

export class GitWorktreeService {
  constructor(private cwd?: string) {}

  async list(): Promise<GitWorktreeEntry[]> {
    const { stdout, stderr, exitCode } = await git(['worktree', 'list', '--porcelain'], this.cwd)
    if (exitCode !== 0) throw new Error(stderr)
    return parseWorktreeList(stdout)
  }

  async add(branch: string, path: string): Promise<void> {
    const args = ['worktree', 'add', '-b', branch, path]
    const { stderr, exitCode } = await git(args, this.cwd)
    if (exitCode !== 0) throw new Error(stderr)
  }

  async addFrom(branch: string, path: string): Promise<void> {
    const args = ['worktree', 'add', path, branch]
    const { stderr, exitCode } = await git(args, this.cwd)
    if (exitCode !== 0) throw new Error(stderr)
  }

  async remove(path: string, force = false): Promise<void> {
    const args = ['worktree', 'remove', path]
    if (force) args.push('--force')
    const { stderr, exitCode } = await git(args, this.cwd)
    if (exitCode !== 0) throw new Error(stderr)
  }

  async prune(): Promise<void> {
    const { stderr, exitCode } = await git(['worktree', 'prune'], this.cwd)
    if (exitCode !== 0) throw new Error(stderr)
  }
}

async function git(args: string[], cwd?: string): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  const { spawn } = await import('node:child_process')
  return new Promise((resolve) => {
    const child = spawn('git', args, { cwd })
    let stdout = ''
    let stderr = ''
    child.stdout?.on('data', (chunk: Buffer) => { stdout += chunk.toString() })
    child.stderr?.on('data', (chunk: Buffer) => { stderr += chunk.toString() })
    child.on('close', (code: number | null) => { resolve({ stdout, stderr, exitCode: code ?? 1 }) })
    child.on('error', (err: Error) => { resolve({ stdout, stderr: err.message, exitCode: 1 }) })
  })
}

function parseWorktreeList(stdout: string): GitWorktreeEntry[] {
  const entries: GitWorktreeEntry[] = []
  const blocks = stdout.trim().split('\n\n')
  for (const block of blocks) {
    const lines = block.trim().split('\n')
    let path = ''
    let branch = ''
    let head = ''
    for (const line of lines) {
      const idx = line.indexOf(' ')
      if (idx === -1) continue
      const key = line.slice(0, idx)
      const value = line.slice(idx + 1)
      if (key === 'worktree') path = value
      else if (key === 'branch') branch = value.replace('refs/heads/', '')
      else if (key === 'HEAD') head = value
    }
    if (path) {
      const name = path.split('/').at(-1) ?? path
      entries.push({ name, path, branch, HEAD: head })
    }
  }
  return entries
}

export function apply(_ctx: unknown): void {
  // no-op: standalone service, not a Cordis plugin with event handlers
}
