import { test, expect } from '../fixtures/base.fixture';
import { SalesforceLoginPage } from '../../pageobjects/auth/salesforce-login.page';
import { waitForLightningReady } from '../../utils/salesforceLightning';

test.describe('Feature: Performance & Page Load', () => {
  test.beforeEach(async ({ page, salesforceUser }) => {
    const loginPage = new SalesforceLoginPage(page);
    await loginPage.loginIfNeeded(salesforceUser.username, salesforceUser.password);
  });

  test('@perf home page loads within threshold', async ({ page }) => {
    const start = Date.now();
    await page.goto('/lightning/page/home');
    await waitForLightningReady(page);
    const loadTime = Date.now() - start;

    expect(loadTime).toBeLessThan(30_000);
    console.log(`Home page load time: ${loadTime}ms`);
  });

  test('@perf lead list loads within threshold', async ({ page }) => {
    const start = Date.now();
    await page.goto('/lightning/o/Lead/list');
    await waitForLightningReady(page);
    const loadTime = Date.now() - start;

    expect(loadTime).toBeLessThan(30_000);
    console.log(`Lead list load time: ${loadTime}ms`);
  });

  test('@perf account list loads within threshold', async ({ page }) => {
    const start = Date.now();
    await page.goto('/lightning/o/Account/list');
    await waitForLightningReady(page);
    const loadTime = Date.now() - start;

    expect(loadTime).toBeLessThan(30_000);
    console.log(`Account list load time: ${loadTime}ms`);
  });

  test('@perf opportunity list loads within threshold', async ({ page }) => {
    const start = Date.now();
    await page.goto('/lightning/o/Opportunity/list');
    await waitForLightningReady(page);
    const loadTime = Date.now() - start;

    expect(loadTime).toBeLessThan(30_000);
    console.log(`Opportunity list load time: ${loadTime}ms`);
  });
});
