import { test as setup } from '@playwright/test';
import { SalesforceLoginPage } from '../pageobjects/auth/salesforce-login.page';
import { loadEnv } from '../utils/loadEnv';
import {
  ensureRuntimeDirs,
  getSalesforceStorageStatePath,
  readSharedSalesforceUser,
} from '../utils/sharedSalesforceUser';

loadEnv();

setup('authenticate to Salesforce', async ({ page }) => {
  ensureRuntimeDirs();
  const user = await readSharedSalesforceUser();
  const loginPage = new SalesforceLoginPage(page);

  await loginPage.goto();
  await loginPage.login(user.username, user.password);
  await loginPage.expectSuccessfulLogin();

  await page.context().storageState({ path: getSalesforceStorageStatePath() });
});
