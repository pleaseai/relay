import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: true,
  clean: true,
  treeshake: true,
  hash: false,
  platform: 'neutral',
  publint: 'ci-only',
  attw: 'ci-only',
  outExtensions() {
    return {
      js: '.js',
      dts: '.d.ts',
    }
  },
})
