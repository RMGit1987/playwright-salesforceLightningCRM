import { test, expect } from '../../fixtures/base.fixture';
import { SalesforceLoginPage } from '../../../pageobjects/auth/salesforce-login.page';
import { CasePage } from '../../../pageobjects/salesforce/case.page';
import { buildCasePayload } from '../../../utils/testData';
import { waitForLightningReady } from '../../../utils/salesforceLightning';

test.describe('Feature: Case Management', () => {
  test.beforeEach(async ({ page, salesforceUser }) => {
    const loginPage = new SalesforceLoginPage(page);
    await loginPage.loginIfNeeded(salesforceUser.username, salesforceUser.password);
  });

  test('@smoke @critical create a new case', async ({ page }) => {
    const casePage = new CasePage(page);
    const caseData = buildCasePayload();

    await casePage.goto();
    await casePage.clickNew();
    await casePage.fillCaseForm(caseData);
    await casePage.saveAndExpectSuccess();
  });

  test('@smoke create case with all fields', async ({ page }) => {
    const casePage = new CasePage(page);
    const caseData = {
      ...buildCasePayload(),
      status: 'Working',
      priority: 'High',
      origin: 'Phone',
    };

    await casePage.goto();
    await casePage.clickNew();
    await casePage.fillCaseForm(caseData);
    await casePage.saveAndExpectSuccess();
  });

  test('@regression case requires subject', async ({ page }) => {
    const casePage = new CasePage(page);

    await casePage.goto();
    await casePage.clickNew();
    await casePage.save();

    const toast = page.locator('.page-level-errors, .slds-notify__content, [role="alert"]');
    await expect(toast.first()).toBeVisible({ timeout: 10_000 });
  });

  test('@regression create case and verify in list view', async ({ page }) => {
    const casePage = new CasePage(page);
    const caseData = buildCasePayload();

    await casePage.goto();
    await casePage.clickNew();
    await casePage.fillCaseForm(caseData);
    await casePage.saveAndExpectSuccess();

    await casePage.goto();
    await waitForLightningReady(page);

    const caseLink = page.getByRole('link', { name: new RegExp(caseData.subject, 'i') });
    await expect(caseLink.first()).toBeVisible({ timeout: 15_000 });
  });

  test('@regression case status values are available', async ({ page }) => {
    const casePage = new CasePage(page);

    await casePage.goto();
    await casePage.clickNew();

    const form = page.locator('lightning-record-edit-form');
    await form.locator('lightning-combobox[data-field="Status"]').click();

    const expectedStatuses = ['New', 'Working', 'Escalated', 'Closed'];
    for (const status of expectedStatuses) {
      await expect(page.getByRole('option', { name: status })).toBeVisible({ timeout: 5_000 });
    }
  });

  test('@regression case priority values are available', async ({ page }) => {
    const casePage = new CasePage(page);

    await casePage.goto();
    await casePage.clickNew();

    const form = page.locator('lightning-record-edit-form');
    await form.locator('lightning-combobox[data-field="Priority"]').click();

    const expectedPriorities = ['High', 'Medium', 'Low'];
    for (const priority of expectedPriorities) {
      await expect(page.getByRole('option', { name: priority })).toBeVisible({ timeout: 5_000 });
    }
  });
});
