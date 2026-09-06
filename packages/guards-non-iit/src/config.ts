/**
 * Config schema for non-IIT guards — HHH, RSP, SAE, Policy, RateLimit, Budget.
 * Uses schemastery (not zod).
 * @module @deepseek-ai/dsh-enterprise-guards-non-iit/config
 */

import z from '@deepseek-ai/schemastery'

export const Config = z.object({
  provider: z.object({
    tier: z.union(['anthropic', 'shared-org', 'local-rules']).default('local-rules'),
    anthropicApiKey: z.string(),
    sharedOrgKey: z.string(),
    model: z.string().default('claude-sonnet-4-20250514'),
    judgeModel: z.string().default('claude-haiku-4-20250515'),
  }),

  hhh: z.object({
    minHelpfulScore: z.number().default(0.7),
    minHonestScore: z.number().default(0.6),
    harmlessBlockThreshold: z.number().default(0.8),
    harmlessWarnThreshold: z.number().default(0.5),
  }),

  rsp: z.object({
    enabled: z.boolean().default(false),
    apiKey: z.string(),
    endpoint: z.string().default('https://rsp-api.deepseek.ai/v1/evaluate'),
  }),

  sae: z.object({
    enabled: z.boolean().default(false),
    threshold: z.number().default(0.5),
    topk: z.number().default(128),
  }),

  policy: z.object({
    rules: z.array(z.object({
      id: z.string(),
      pattern: z.string(),
      action: z.union(['block', 'warn', 'allow']),
      description: z.string(),
    })).default([]),
  }),

  rateLimit: z.object({
    maxRequestsPerMinute: z.number().default(60),
    maxTokensPerMinute: z.number().default(100000),
  }),

  budget: z.object({
    maxSpendPerSession: z.number().default(10.0),
    maxTokensPerSession: z.number().default(100000),
  }),
})

export type Config = ReturnType<typeof Config.parse>
