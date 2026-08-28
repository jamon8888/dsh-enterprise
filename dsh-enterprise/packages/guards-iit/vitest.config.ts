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
    },
  },
  test: {
    include: ['tests/**/*.spec.ts'],
  },
})
