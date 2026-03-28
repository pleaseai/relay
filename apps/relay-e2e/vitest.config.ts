import { defineWorkersConfig } from '@cloudflare/vitest-pool-workers/config'

export default defineWorkersConfig({
  test: {
    testTimeout: 15_000,
    poolOptions: {
      workers: {
        singleWorker: true,
        isolatedStorage: false,
        wrangler: {
          configPath: '../relay-worker/wrangler.json',
        },
        miniflare: {
          bindings: {
            WEBHOOK_SECRET: 'test-webhook-secret',
            AUTH_TOKEN: 'test-auth-token',
          },
        },
      },
    },
  },
})
