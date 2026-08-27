export default {
  resolve: {
    alias: {
      '@deepseek-ai/schemastery': new URL('./src/__mocks__/schemastery.ts', import.meta.url).pathname,
      '@deepseek-ai/cordis': new URL('./src/__mocks__/cordis.ts', import.meta.url).pathname,
      '@deepseek-ai/dsh-enterprise-iit-core/pkg': new URL('./src/__mocks__/iit-core-pkg.ts', import.meta.url).pathname,
    },
  },
  test: {
    include: ['tests/**/*.spec.ts'],
  },
}
