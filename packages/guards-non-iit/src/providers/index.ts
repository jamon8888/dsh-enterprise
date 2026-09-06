/**
 * Three-tier evaluation provider: Anthropic API → Shared Org → Local Rules.
 * Inspired by AAR refusal_judges.py lazy-load + caching pattern.
 * @module @deepseek-ai/dsh-enterprise-guards-non-iit/providers
 */

import type { GuardResult } from '../types.js'
import type { ProviderConfig } from '../types.js'

export interface EvaluationProvider {
  name(): string
  evaluate(prompt: string, context?: Record<string, unknown>): Promise<GuardResult>
}

export function createProvider(config: ProviderConfig): EvaluationProvider {
  switch (config.tier) {
    case 'anthropic':
      return new AnthropicApiProvider(config)
    case 'shared-org':
      return new SharedOrgProvider(config)
    default:
      return new LocalRulesProvider()
  }
}

const BLOCK_PATTERNS = [
  /skip.*safety/i,
  /ignore.*instruction/i,
  /disable.*guard/i,
  /override.*policy/i,
  /bypass.*secure/i,
  /reveal.*secret/i,
  /ignore.*previous.*directive/i,
  /disregard.*rules/i,
]

const WARN_PATTERNS = [
  /manipulat/i,
  /deceiv/i,
  /trick/i,
  /exploit.*vulnerab/i,
  /harm.*someone/i,
  /illegal.*activ/i,
]

class LocalRulesProvider {
  name() { return 'local-rules' }

  async evaluate(prompt: string): Promise<GuardResult> {
    for (const pat of BLOCK_PATTERNS) {
      if (pat.test(prompt)) {
        return { disposition: 'block', reason: 'LocalRules: blocked pattern matched' }
      }
    }
    for (const pat of WARN_PATTERNS) {
      if (pat.test(prompt)) {
        return { disposition: 'warn', reason: 'LocalRules: warning pattern matched' }
      }
    }
    return { disposition: 'pass' }
  }
}

class AnthropicApiProvider {
  private apiKey: string
  private model: string

  constructor(config: ProviderConfig) {
    this.apiKey = config.anthropicApiKey ?? process.env.ANTHROPIC_API_KEY ?? ''
    this.model = config.model ?? 'claude-sonnet-4-20250514'
  }

  name() { return 'anthropic-api' }

  async evaluate(prompt: string): Promise<GuardResult> {
    if (!this.apiKey) {
      return { disposition: 'warn', reason: 'AnthropicApi: no API key' }
    }

    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: this.model,
          max_tokens: 1024,
          messages: [{ role: 'user', content: prompt }],
          system: 'You are a Constitutional AI evaluator. Return JSON with score 0.0-1.0 for harmless (higher = safer).',
        }),
      })

      if (!response.ok) {
        return { disposition: 'warn', reason: `AnthropicApi: HTTP ${response.status}` }
      }

      const data = await response.json() as { content?: Array<{ text?: string }> }
      const text = data.content?.[0]?.text ?? ''

      const parsed = JSON.parse(text) as { harmless?: number; score?: number }
      const score = parsed.harmless ?? parsed.score ?? 0.8
      return {
        disposition: score >= 0.8 ? 'pass' : score >= 0.5 ? 'warn' : 'block',
        score,
        reason: `AnthropicApi: score=${score.toFixed(2)}`,
      }
    } catch {
      return { disposition: 'pass', score: 0.8 }
    }
  }
}

class SharedOrgProvider {
  private apiKey: string

  constructor(config: ProviderConfig) {
    this.apiKey = config.sharedOrgKey ?? process.env.DSH_SHARED_ORG_KEY ?? ''
  }

  name() { return 'shared-org' }

  async evaluate(prompt: string): Promise<GuardResult> {
    if (!this.apiKey) {
      return new LocalRulesProvider().evaluate(prompt)
    }
    return new AnthropicApiProvider({ ...{ anthropicApiKey: this.apiKey } as ProviderConfig, tier: 'anthropic' }).evaluate(prompt)
  }
}
