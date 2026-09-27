import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  workers: 1,
  timeout: 45000,
  expect: { timeout: 10000 },
  reporter: [['list'], ['json', { outputFile: '../docs/evidence/interactions.json' }]],
  use: { baseURL: 'http://127.0.0.1:4173/preview/', headless: true, viewport: { width: 1440, height: 1000 } },
  webServer: { command: 'node scripts/serve.mjs', url: 'http://127.0.0.1:4173/preview/', reuseExistingServer: !process.env.CI },
})
