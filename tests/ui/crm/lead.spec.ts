import { test, expect } from '../../fixtures/base.fixture';
import { SalesforceLoginPage } from '../../../pageobjects/auth/salesforce-login.page';
import { LeadPage } from '../../../pageobjects/salesforce/lead.page';
import { buildLeadPayload } from '../../../utils/testData';
import { openLightningCombobox, waitForLightningReady } from '../../../utils/salesforceLightning';

test.describe('Feature: Lead Management', () => {
  test.beforeEach(async ({ page, salesforceUser }) => {
    const loginPage = new SalesforceLoginPage(page);
    await loginPage.loginIfNeeded(salesforceUser.username, salesforceUser.password);
  });

  test('@smoke @critical create a new lead', async ({ page }) => {
    const leadPage = new LeadPage(page);
    const leadData = buildLeadPayload();

    await leadPage.goto();
    await leadPage.clickNew();
    await leadPage.fillLeadForm(leadData);
    await leadPage.saveAndExpectSuccess();
  });

  test('@smoke create lead with all fields', async ({ page }) => {
    const leadPage = new LeadPage(page);
    const leadData = {
      ...buildLeadPayload(),
      status: 'Working - Contacted',
      industry: 'Technology',
    };

    await leadPage.goto();
    await leadPage.clickNew();
    await leadPage.fillLeadForm(leadData);
    await leadPage.saveAndExpectSuccess();
  });

  test('@regression lead requires last name and company', async ({ page }) => {
    const leadPage = new LeadPage(page);

    await leadPage.goto();
    await leadPage.clickNew();
    await leadPage.save();

    const errorDialog = page.getByRole('dialog', { name: /we hit a snag/i });
    await expect(errorDialog).toBeVisible({ timeout: 10_000 });
    await expect(errorDialog).toContainText('Name');
    await expect(errorDialog).toContainText('Company');
  });

  test('@regression create and verify lead appears in list', async ({ page }) => {
    const leadPage = new LeadPage(page);
    const leadData = buildLeadPayload();

    await leadPage.goto();
    await leadPage.clickNew();
    await leadPage.fillLeadForm(leadData);
    await leadPage.saveAndExpectSuccess();

    await leadPage.goto();
    await waitForLightningReady(page);

    const leadLink = page.getByRole('link', { name: new RegExp(`${leadData.firstName}.*${leadData.lastName}`, 'i') });
    await expect(leadLink.first()).toBeVisible({ timeout: 15_000 });
  });

  test('@regression lead status values are correct', async ({ page }) => {
    const leadPage = new LeadPage(page);

    await leadPage.goto();
    await leadPage.clickNew();

    await openLightningCombobox(page, /lead status|status/i, 'Status');

    const expectedStatuses = ['Open - Not Contacted', 'Working - Contacted', 'Closed - Converted', 'Closed - Not Converted'];
    for (const status of expectedStatuses) {
      await expect(page.getByRole('option', { name: status })).toBeVisible({ timeout: 5_000 });
    }
  });
});
