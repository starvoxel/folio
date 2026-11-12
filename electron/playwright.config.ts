import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'tests',
  testMatch: /.*\.spec\.ts/,
  timeout: 180_000,
  workers: 1,
  retries: 0,
  reporter: [['list'], ['json', { outputFile: 'test-results/report.json' }]],
  use: { trace: 'off' },
});
