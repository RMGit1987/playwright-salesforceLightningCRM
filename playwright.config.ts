import fs from 'fs';
import path from 'path';
import { defineConfig, devices } from '@playwright/test';
import { loadEnv } from './utils/loadEnv';
import { logInfo } from './utils/logger';
import { getEnabledQuarantineEntries } from './utils/quarantine';
import { getSalesforceStorageStatePath } from './utils/sharedSalesforceUser';

loadEnv();

function parseIntegerEnv(name: string): number | undefined {
  const value = process.env[name];
  if (!value) return undefined;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function parseBooleanEnv(name: string, defaultValue: boolean): boolean {
  const value = process.env[name];
  if (!value) return defaultValue;
  return !['0', 'false', 'no'].includes(value.toLowerCase());
}

const runId = process.env.PW_RUN_ID || new Date().toISOString().replace(/[:.]/g, '-');
const runDir = process.env.PW_RUN_DIR || path.join(process.cwd(), 'test-results', `run-${runId}`);
const reportDir = path.join(runDir, 'report');
const blobReportDir = path.join(runDir, 'blob-report');
const resultsJsonPath = path.join(runDir, 'results.json');
const artifactsDir = path.join(runDir, 'artifacts');
const logsDir = path.join(runDir, 'logs');
const autoHealEnabled = ['1', 'true', 'yes'].includes((process.env.AUTO_HEAL || '').toLowerCase());
const quarantineEntries = getEnabledQuarantineEntries();
const grep = process.env.PW_GREP;
const grepInvert = process.env.PW_GREP_INVERT;
const workers = parseIntegerEnv('PW_WORKERS');
const retries = parseIntegerEnv('PW_RETRIES') ?? (process.env.CI ? 1 : 0);
const headless = parseBooleanEnv('PW_HEADLESS', true);
const enableFirefox = parseBooleanEnv('PW_ENABLE_FIREFOX', false);
const apiSpecMatch = /[\\/]api[\\/].*\.spec\.ts$/;
const authSetupMatch = /[\\/]auth\.setup\.ts$/;
const uiAuthSpecMatch = /[\\/]ui[\\/]auth[\\/].*\.spec\.ts$/;

process.env.PW_RUN_ID = runId;
process.env.PW_RUN_DIR = runDir;
process.env.PW_RESULTS_JSON = resultsJsonPath;
process.env.PW_ARTIFACTS_DIR = artifactsDir;
process.env.PW_LOGS_DIR = logsDir;
process.env.PW_REPORT_DIR = reportDir;

fs.mkdirSync(runDir, { recursive: true });
const marker = path.join(runDir, '.run-logged');
if (!fs.existsSync(marker)) {
  fs.writeFileSync(marker, 'logged\n', 'utf8');
  logInfo(`Playwright report dir: ${reportDir}`);
  logInfo(`Playwright blob report dir: ${blobReportDir}`);
  logInfo(`Playwright logs dir: ${logsDir}`);
  logInfo(`Playwright misc artifacts dir: ${artifactsDir}`);
  logInfo(`Auto-heal mode: ${autoHealEnabled ? 'enabled' : 'disabled'}`);
  logInfo(`Firefox project: ${enableFirefox ? 'enabled' : 'disabled'}`);
  logInfo(`Quarantine entries loaded: ${quarantineEntries.length}`);
  if (grep) logInfo(`Playwright grep filter: ${grep}`);
  if (grepInvert) logInfo(`Playwright grep invert filter: ${grepInvert}`);
}

const baseReporters: any[] = [
  ['list'],
  ['./reporters/failure-intelligence-reporter.ts'],
  ['html', { outputFolder: reportDir, open: 'never' }],
  ['json', { outputFile: resultsJsonPath }],
];

if (process.env.CI) {
  baseReporters.push(['blob', { outputDir: blobReportDir }]);
}

export default defineConfig({
  testDir: './tests',
  timeout: 120_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries,
  ...(workers ? { workers } : {}),
  ...(grep ? { grep: new RegExp(grep) } : {}),
  ...(grepInvert ? { grepInvert: new RegExp(grepInvert) } : {}),
  globalSetup: './global-setup',
  globalTeardown: './global-teardown',
  outputDir: artifactsDir,
  metadata: {
    autoHeal: autoHealEnabled,
    quarantineEntryCount: quarantineEntries.length,
  },
  reporter: baseReporters,
  use: {
    baseURL: process.env.SALESFORCE_LOGIN_URL || process.env.SALESFORCE_BASE_URL || 'https://login.salesforce.com',
    headless,
    viewport: { width: 1440, height: 960 },
    actionTimeout: 30_000,
    navigationTimeout: 60_000,
    ignoreHTTPSErrors: true,
    screenshot: { mode: 'only-on-failure', fullPage: true },
    trace: 'retain-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'setup',
      testMatch: authSetupMatch,
      use: {
        ...devices['Desktop Chrome'],
        channel: process.env.PW_CHANNEL || 'chromium',
        storageState: undefined,
      },
    },
    {
      name: 'authenticated-chromium',
      dependencies: ['setup'],
      testIgnore: [apiSpecMatch, authSetupMatch, uiAuthSpecMatch],
      use: {
        ...devices['Desktop Chrome'],
        channel: process.env.PW_CHANNEL || 'chromium',
        storageState: getSalesforceStorageStatePath(),
      },
    },
    {
      name: 'chromium',
      testMatch: uiAuthSpecMatch,
      use: {
        ...devices['Desktop Chrome'],
        channel: process.env.PW_CHANNEL || 'chromium',
      },
    },
    {
      name: 'api',
      testMatch: apiSpecMatch,
      testIgnore: authSetupMatch,
    },
    ...(enableFirefox
      ? [
          {
            name: 'firefox',
            dependencies: ['setup'],
            testIgnore: [apiSpecMatch, authSetupMatch, uiAuthSpecMatch],
            use: {
              ...devices['Desktop Firefox'],
              storageState: getSalesforceStorageStatePath(),
            },
          },
        ]
      : []),
  ],
});
