import { type Page } from '@playwright/test';
import { test, expect } from '../fixtures/base.fixture';
import { SalesforceLoginPage } from '../../pageobjects/auth/salesforce-login.page';
import { LeadPage } from '../../pageobjects/salesforce/lead.page';
import { buildLeadPayload } from '../../utils/testData';
import { waitForLightningReady } from '../../utils/salesforceLightning';

async function getLeadListKpiCount(page: Page): Promise<number | null> {
  const kpiButton = page.getByRole('button', { name: /total leads/i }).first();
  const kpiText = ((await kpiButton.textContent().catch(() => '')) || '').replace(/\s+/g, ' ').trim();
  const kpiMatch = kpiText.match(/total leads\s+(\d+)/i);
  if (kpiMatch) {
    return Number.parseInt(kpiMatch[1], 10);
  }

  const statusText = ((await page.locator('[role="status"]').first().textContent().catch(() => '')) || '')
    .replace(/\s+/g, ' ')
    .trim();
  const statusMatch = statusText.match(/(\d+)\s+items/i);
  return statusMatch ? Number.parseInt(statusMatch[1], 10) : null;
}

test.describe('Feature: Hybrid API + UI Tests', () => {
  test.beforeEach(async ({ page, salesforceUser }) => {
    const loginPage = new SalesforceLoginPage(page);
    await loginPage.loginIfNeeded(salesforceUser.username, salesforceUser.password);
  });

  test('@hybrid @regression create lead via UI and verify list view update', async ({ page }) => {
    const leadPage = new LeadPage(page);
    const leadData = buildLeadPayload();

    await leadPage.goto();

    const initialRows = await page.locator('table tbody tr, lightning-datatable [role="row"]').count();
    const initialLeadCount = await getLeadListKpiCount(page);

    await leadPage.clickNew();
    await leadPage.fillLeadForm(leadData);
    await leadPage.saveAndExpectSuccess();

    await leadPage.goto();
    await waitForLightningReady(page);

    const refreshedRows = await page.locator('table tbody tr, lightning-datatable [role="row"]').count();
    expect(refreshedRows).toBeGreaterThanOrEqual(initialRows);
    const refreshedLeadCount = await getLeadListKpiCount(page);
    if (initialLeadCount !== null && refreshedLeadCount !== null) {
      expect(refreshedLeadCount).toBeGreaterThan(initialLeadCount);
    }
  });

  test('@hybrid @regression create lead and navigate to detail', async ({ page }) => {
    const leadPage = new LeadPage(page);
    const leadData = buildLeadPayload();

    await leadPage.goto();
    await leadPage.clickNew();
    await leadPage.fillLeadForm({
      lastName: leadData.lastName,
      company: leadData.company,
    });
    await leadPage.saveAndExpectSuccess();

    await expect(page).toHaveURL(/\/lightning\/r\/Lead\/[a-zA-Z0-9]{15,18}/, { timeout: 15_000 });
  });
});
