import { defineConfig, devices } from '@playwright/test';
import path from 'node:path';

const port = Number(process.env.PORT ?? 3001);
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? `http://localhost:${port}`;
const apiPort = Number(process.env.PLAYWRIGHT_API_PORT ?? 4005);
const backendURL = process.env.NEXT_PUBLIC_BACKEND_URL ?? `http://127.0.0.1:${apiPort}`;
const usesExternalBackend = /^https:\/\//.test(backendURL) && !/localhost|127\.0\.0\.1/.test(backendURL);
const apiProject = path.resolve(
  __dirname,
  '../gatepass/backend-dotnet/GatePass.Api/GatePass.Api.csproj',
);
const sqlitePath = `/tmp/gatepass-browser-e2e-${apiPort}.db`;

const webServers = [
  ...(usesExternalBackend ? [] : [{
    command:
      `rm -f "${sqlitePath}" "${sqlitePath}-wal" "${sqlitePath}-shm" && `
      + 'env ASPNETCORE_ENVIRONMENT=Development Database__Provider=Sqlite '
      + `ConnectionStrings__Sqlite="Data Source=${sqlitePath}" `
      + 'DemoSeed__Enabled=true OperationalJobs__Enabled=false RateLimits__AuthPermitLimit=100 '
      + `Cors__AllowedOrigins__0=${baseURL} `
      + `dotnet run --no-launch-profile --project "${apiProject}" --urls "${backendURL}"`,
    url: `${backendURL}/health/ready`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  }]),
  {
    command: `NEXT_DIST_DIR=.next-playwright-${port} NEXT_PUBLIC_BACKEND_URL=${backendURL} PORT=${port} npm run dev`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
];

export default defineConfig({
  testDir: './e2e',
  timeout: 45_000,
  expect: {
    timeout: 10_000,
  },
  fullyParallel: true,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: webServers,
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
