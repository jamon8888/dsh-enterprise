import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: ['src/index.ts', 'src/types.ts'],
  format: 'esm',
  platform: 'node',
  dts: true,
  sourcemap: true,
  clean: true,
  external: ['cordis', 'schemastery']
})