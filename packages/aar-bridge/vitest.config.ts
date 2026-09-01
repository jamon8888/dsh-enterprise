import { defineConfig } from 'vitest/config'
import path from 'path'
import { fileURLToPath } from 'url'
const __dirname = path.dirname(fileURLToPath(import.meta.url))
export default defineConfig({
  resolve: {
    alias: {
      '@deepseek-ai/schemastery': path.resolve(__dirname, 'src/__mocks__/schemastery.ts'),
      '@deepseek-ai/cordis': path.resolve(__dirname, 'src/__mocks__/cordis.ts'),
      '@deepseek-ai/dsh-session': path.resolve(__dirname, 'src/__mocks__/dsh-session.ts'),
    },
  },
  test: {
    include: ['tests/**/*.spec.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/plugin.ts'],
      exclude: ['src/__mocks__/**', 'src/types.ts', 'src/index.ts'],
      thresholds: {
        statements: 80,
        branches: 80,
        functions: 80,
        lines: 80,
      },
    },
  },
})
