/**
 * dsh-pr-agent — GitHub PR review stub.
 * Real AI review integration deferred to dsh-ai-gateway.
 * @module @deepseek-ai/dsh-enterprise-dsh-pr-agent/plugin
 */

// ponytail: AI review deferred to dsh-ai-gateway; stub is appropriate for this phase

export interface PrReviewRequest {
  owner: string
  repo: string
  prNumber: number
}

export interface PrReviewResult {
  summary: string
  comments: { path: string; line: number; body: string }[]
  labels: string[]
}

const GITHUB_API = 'https://api.github.com'

async function resolveToken(): Promise<string | undefined> {
  if (process.env.GITHUB_TOKEN) return process.env.GITHUB_TOKEN
  if (process.env.GH_TOKEN) return process.env.GH_TOKEN
  try {
    const { execSync } = await import('child_process')
    return execSync('gh auth token', { encoding: 'utf8', timeout: 10_000 }).trim()
  } catch {
    return undefined
  }
}

export class PrAgentService {
  #token: string | undefined

  constructor(private githubToken?: string) {
    this.#token = githubToken
  }

  async review(req: PrReviewRequest): Promise<PrReviewResult> {
    const token = this.#token ?? (await resolveToken())
    const headers: Record<string, string> = {
      Accept: 'application/vnd.github+json',
    }
    if (token) headers['Authorization'] = `Bearer ${token}`

    const prRes = await (globalThis as { fetch: typeof fetch }).fetch(
      `${GITHUB_API}/repos/${req.owner}/${req.repo}/pulls/${req.prNumber}`,
      { headers },
    )
    if (!prRes.ok) {
      if (prRes.status === 404) throw new Error(`PR not found: ${req.owner}/${req.repo}#${req.prNumber}`)
      if (prRes.status === 403 && prRes.headers.get('X-RateLimit-Remaining') === '0') {
        throw new Error(`GitHub API rate limit exceeded for ${req.owner}/${req.repo}`)
      }
      throw new Error(`GitHub API error ${prRes.status} for PR ${req.owner}/${req.repo}#${req.prNumber}`)
    }

    const prData = (await prRes.json()) as { labels?: { name: string }[] }
    const labels: string[] = prData.labels?.map((l) => l.name) ?? []

    const filesRes = await (globalThis as { fetch: typeof fetch }).fetch(
      `${GITHUB_API}/repos/${req.owner}/${req.repo}/pulls/${req.prNumber}/files`,
      { headers },
    )
    if (!filesRes.ok) {
      if (filesRes.status === 404) throw new Error(`PR files not found: ${req.owner}/${req.repo}#${req.prNumber}`)
      throw new Error(
        `GitHub API error ${filesRes.status} fetching files for PR ${req.owner}/${req.repo}#${req.prNumber}`,
      )
    }

    const files = (await filesRes.json()) as { filename: string }[]

    return {
      summary: 'AI review stub — real integration deferred to dsh-ai-gateway',
      comments: files.map((f) => ({ path: f.filename, line: 1, body: 'Review stub — see summary' })),
      labels,
    }
  }
}

export const name = 'dsh-enterprise:pr-agent'
export const inject = [] as const

export function apply(_ctx: unknown): void {}
