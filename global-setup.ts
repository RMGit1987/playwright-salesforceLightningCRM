import fs from 'fs';
import path from 'path';
import type { FullConfig } from '@playwright/test';
import { logInfo, logWarn } from './utils/logger';
import { loadEnv } from './utils/loadEnv';
import {
  ensureRuntimeDirs,
  getConfiguredSalesforceUser,
  getSeedDir,
  getSharedSalesforceUserPath,
  writeSharedSalesforceUser,
} from './utils/sharedSalesforceUser';

loadEnv();

export default async function globalSetup(_config: FullConfig) {
  ensureRuntimeDirs();

  try {
    const salesforceUser = getConfiguredSalesforceUser();
    writeSharedSalesforceUser(salesforceUser);
    logInfo(`Shared Salesforce credentials prepared at ${getSharedSalesforceUserPath()}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error ?? 'unknown error');
    logWarn(`Global setup did not seed a shared Salesforce user: ${message}`);
  }

  const marker = path.join(getSeedDir(), 'global-setup.log');
  fs.writeFileSync(marker, `Global setup completed at ${new Date().toISOString()}\n`, 'utf8');
}
