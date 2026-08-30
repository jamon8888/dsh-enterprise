import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { PrAgentService } from '../src/plugin.js'

const MOCK_PR_WITH_LABELS = {
  number: 42,
  title: 'Fix bug',
  state: 'open',
  labels: [
    { name: 'bug' },
    { name: 'priority:high' },
  ],
}

const MOCK_FILES_TWO = [
  { filename: 'src/foo.ts', status: 'added', additions: 10, deletions: 2 },
  { filename: 'src/bar.ts', status: 'modified', additions: 5, deletions: 1 },
]

describe('PrAgentService', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('review() happy path — returns result with summary, comments, labels', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url: unknown) => {
      const u = String(url)
      if (u.includes('/files')) {
        return { ok: true, status: 200, headers: new Headers(), json: async () => MOCK_FILES_TWO } as unknown as Response
      }
      return { ok: true, status: 200, headers: new Headers(), json: async () => MOCK_PR_WITH_LABELS } as unknown as Response
    })

    const svc = new PrAgentService('fake-token')
    const result = await svc.review({ owner: 'owner', repo: 'repo', prNumber: 42 })

    expect(result.summary).toBe('AI review stub — real integration deferred to dsh-ai-gateway')
    expect(result.comments).toHaveLength(2)
    expect(result.comments[0]).toEqual({ path: 'src/foo.ts', line: 1, body: 'Review stub — see summary' })
    expect(result.comments[1]).toEqual({ path: 'src/bar.ts', line: 1, body: 'Review stub — see summary' })
    expect(result.labels).toEqual(['bug', 'priority:high'])
  })

  it('review() PR not found (404) → throws Error', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      status: 404,
      headers: new Headers(),
      json: async () => ({ message: 'Not Found' }),
    } as unknown as Response)

    const svc = new PrAgentService()
    await expect(svc.review({ owner: 'owner', repo: 'repo', prNumber: 999 })).rejects.toThrow(
      'PR not found: owner/repo#999',
    )
  })

  it('review() rate limit (403 with rate limit headers) → throws descriptive Error', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      status: 403,
      headers: new Headers({ 'X-RateLimit-Remaining': '0' }),
      json: async () => ({ message: 'rate limit exceeded' }),
    } as unknown as Response)

    const svc = new PrAgentService()
    await expect(svc.review({ owner: 'owner', repo: 'repo', prNumber: 42 })).rejects.toThrow(
      'GitHub API rate limit exceeded for owner/repo',
    )
  })

  it('review() network failure → throws Error', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('network unavailable'))

    const svc = new PrAgentService()
    await expect(svc.review({ owner: 'owner', repo: 'repo', prNumber: 42 })).rejects.toThrow(
      'network unavailable',
    )
  })

  it('review() labels extracted from PR correctly', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url: unknown) => {
      const u = String(url)
      if (u.includes('/files')) {
        return { ok: true, status: 200, headers: new Headers(), json: async () => [] } as unknown as Response
      }
      return {
        ok: true,
        status: 200,
        headers: new Headers(),
        json: async () => ({ number: 5, labels: [{ name: 'enhancement' }, { name: 'needs-review' }] }),
      } as unknown as Response
    })

    const svc = new PrAgentService()
    const result = await svc.review({ owner: 'owner', repo: 'repo', prNumber: 5 })
    expect(result.labels).toEqual(['enhancement', 'needs-review'])
  })

  it('review() empty diff (no files changed) → returns result with empty comments', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url: unknown) => {
      const u = String(url)
      if (u.includes('/files')) {
        return { ok: true, status: 200, headers: new Headers(), json: async () => [] } as unknown as Response
      }
      return { ok: true, status: 200, headers: new Headers(), json: async () => ({ number: 7, labels: [] }) } as unknown as Response
    })

    const svc = new PrAgentService()
    const result = await svc.review({ owner: 'owner', repo: 'repo', prNumber: 7 })
    expect(result.comments).toEqual([])
    expect(result.summary).toBe('AI review stub — real integration deferred to dsh-ai-gateway')
  })

  it('review() empty labels → returns result with empty labels array', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url: unknown) => {
      const u = String(url)
      if (u.includes('/files')) {
        return {
          ok: true,
          status: 200,
          headers: new Headers(),
          json: async () => [{ filename: 'README.md', status: 'modified' }],
        } as unknown as Response
      }
      return { ok: true, status: 200, headers: new Headers(), json: async () => ({ number: 8, labels: [] }) } as unknown as Response
    })

    const svc = new PrAgentService()
    const result = await svc.review({ owner: 'owner', repo: 'repo', prNumber: 8 })
    expect(result.labels).toEqual([])
  })

  it('Token resolution: uses GITHUB_TOKEN env var when set', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (url: unknown) => {
      const u = String(url)
      if (u.includes('/files')) {
        return { ok: true, status: 200, headers: new Headers(), json: async () => [] } as unknown as Response
      }
      return { ok: true, status: 200, headers: new Headers(), json: async () => ({ number: 10, labels: [] }) } as unknown as Response
    })

    const original = process.env.GITHUB_TOKEN
    process.env.GITHUB_TOKEN = 'env-token-abc123'
    try {
      const svc = new PrAgentService()
      await svc.review({ owner: 'owner', repo: 'repo', prNumber: 10 })
      expect(fetchSpy).toHaveBeenCalled()
      const call = fetchSpy.mock.calls[0]!
      const headers = call[1]?.headers as Record<string, string> | undefined
      expect(headers?.['Authorization']).toBe('Bearer env-token-abc123')
    } finally {
      if (original !== undefined) process.env.GITHUB_TOKEN = original
      else delete process.env.GITHUB_TOKEN
    }
  })
})
