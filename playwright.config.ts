import { defineConfig, devices } from '@playwright/test';

// E2E harness drives the real SPA against the real API + Postgres.
// Two dev servers are started (and reused if already running): the .NET API on
// https://localhost:29739 and the Vite SPA on https://localhost:46258. Both use
// self-signed dev certs, so HTTPS errors are ignored throughout.
export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1, // single worker — tests share one database
  reporter: [['list']],
  use: {
    baseURL: 'https://localhost:46258',
    ignoreHTTPSErrors: true,
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: 'dotnet run --no-launch-profile --urls https://localhost:29739',
      cwd: '../purchase_order_management_api/PurchaseOrderManagement.Api',
      url: 'https://localhost:29739/swagger/index.html',
      timeout: 180_000,
      reuseExistingServer: true,
      ignoreHTTPSErrors: true,
      env: { ASPNETCORE_ENVIRONMENT: 'Development' },
    },
    {
      command: 'npm run dev',
      url: 'https://localhost:46258',
      timeout: 120_000,
      reuseExistingServer: true,
      ignoreHTTPSErrors: true,
    },
  ],
});
