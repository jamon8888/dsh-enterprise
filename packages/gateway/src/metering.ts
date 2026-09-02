/**
 * Metering — stub cost model for P0.
 * @module @deepseek-ai/dsh-enterprise-gateway/metering
 */

export type TokenUsage = {
  promptTokens?: number
  completionTokens?: number
  totalTokens?: number
  inputTokens?: number
  outputTokens?: number
}

export type RequestContext = {
  model?: string
  provider?: string
}

/**
 * Cost in USD — stub: 0.001 * total tokens.
 * Mirrors facility's costCents({model, inputTokens, outputTokens, ...}) but simplified for P0.
 */
export function costUsd(tokens: TokenUsage, _modelRoute?: RequestContext): number {
  let total = tokens.totalTokens
  if (total == null) {
    total = (tokens.promptTokens ?? 0) + (tokens.completionTokens ?? 0)
    if (total === 0) total = (tokens.inputTokens ?? 0) + (tokens.outputTokens ?? 0)
  }
  return 0.001 * total
}

/**
 * Estimated cost in cents for a prompt — stub: promptTokens * 0.1 cents (0.001 USD *100).
 */
export function estimatedCents(promptTokens: number): number {
  return Math.ceil(promptTokens * 0.1)
}

/** Cost in cents (convenience). */
export function costCents(tokens: TokenUsage, modelRoute?: RequestContext): number {
  return Math.round(costUsd(tokens, modelRoute) * 100)
}
