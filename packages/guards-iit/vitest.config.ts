import { defineConfig } from 'vitest/config'
import path from 'path'
import { fileURLToPath } from 'url'
const __dirname = path.dirname(fileURLToPath(import.meta.url))
export default defineConfig({
  resolve: {
    alias: {
      '@deepseek-ai/schemastery': path.resolve(__dirname, 'src/__mocks__/schemastery.ts'),
      '@deepseek-ai/cordis': path.resolve(__dirname, 'src/__mocks__/cordis.ts'),
      '@deepseek-ai/dsh-enterprise-iit-core/pkg': path.resolve(__dirname, 'src/__mocks__/iit-core-pkg.ts'),
      '@opentelemetry/api': path.resolve(__dirname, 'src/__mocks__/opentelemetry-api.ts'),
    },
  },
  test: {
    include: ['tests/**/*.spec.ts'],
    coverage: {
      provider: 'v8',
      include: [
        'src/session-events.ts',
        'src/cache.ts',
        'src/telemetry.ts',
      ],
      exclude: [
        'src/**/*.d.ts',
        'src/__mocks__/**',
        'src/types.ts',
        'src/config.ts',
        'src/index.ts',
        'src/invariant.ts',
      ],
      thresholds: {
        statements: 100,
        branches: 100,
        functions: 100,
        lines: 100,
      },
    },
  },
})
