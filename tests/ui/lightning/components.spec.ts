import { test, expect } from '../../fixtures/base.fixture';
import { SalesforceLoginPage } from '../../../pageobjects/auth/salesforce-login.page';
import { SalesforceHomePage } from '../../../pageobjects/salesforce/home.page';
import { LeadPage } from '../../../pageobjects/salesforce/lead.page';
import { ToastComponent } from '../../../pageobjects/components/toast.page';
import { ModalComponent } from '../../../pageobjects/components/modal.page';
import { ListViewComponent } from '../../../pageobjects/components/list-view.page';
import { buildLeadPayload } from '../../../utils/testData';
import { openLightningCombobox, waitForLightningReady, waitForRecordForm } from '../../../utils/salesforceLightning';

test.describe('Feature: Lightning UI Components', () => {
  test.beforeEach(async ({ page, salesforceUser }) => {
    const loginPage = new SalesforceLoginPage(page);
    await loginPage.loginIfNeeded(salesforceUser.username, salesforceUser.password);
  });

  test('@smoke home page loads with Lightning navigation', async ({ page }) => {
    const homePage = new SalesforceHomePage(page);

    await homePage.goto();
    await homePage.expectHomePage();

    const nav = page.locator('one-app-nav-bar, nav[aria-label="Global"], nav[aria-label="App"]').first();
    await expect(nav).toBeVisible({ timeout: 15_000 });
  });

  test('@smoke navigation tabs are accessible', async ({ page }) => {
    const homePage = new SalesforceHomePage(page);
    await homePage.goto();

    const tabs = page.locator('a[role="tab"], .slds-context-bar__label-action');
    await expect(tabs.first()).toBeVisible({ timeout: 15_000 });
    const tabCount = await tabs.count();
    expect(tabCount).toBeGreaterThan(0);
  });

  test('@regression toast notification appears after record creation', async ({ page }) => {
    const leadPage = new LeadPage(page);
    const toast = new ToastComponent(page);
    const leadData = buildLeadPayload();

    await leadPage.goto();
    await leadPage.clickNew();
    await leadPage.fillLeadForm(leadData);
    await leadPage.save();

    await toast.expectToastVisible(/success/i);
  });

  test('@regression modal dialog opens and closes', async ({ page }) => {
    const leadPage = new LeadPage(page);

    await leadPage.goto();
    await leadPage.clickNew();

    const form = await waitForRecordForm(page);
    await expect(form).toBeVisible({ timeout: 15_000 });

    await page.getByRole('button', { name: /^cancel$/i }).click();
    await expect(form).not.toBeVisible({ timeout: 10_000 });
  });

  test('@regression list view with search functionality', async ({ page }) => {
    const leadPage = new LeadPage(page);
    const listView = new ListViewComponent(page);
    const leadData = buildLeadPayload();

    await leadPage.goto();
    await leadPage.clickNew();
    await leadPage.fillLeadForm(leadData);
    await leadPage.saveAndExpectSuccess();

    await leadPage.goto();
    await waitForLightningReady(page);

    const searchInput = page.locator('input[name="search"], .slds-input[placeholder*="Search"]');
    if (await searchInput.isVisible()) {
      await listView.searchAndSelect(leadData.lastName);

      const resultLink = page.getByRole('link', { name: new RegExp(leadData.lastName, 'i') });
      await expect(resultLink.first()).toBeVisible({ timeout: 10_000 });
    }
  });

  test('@regression Lightning form field validation', async ({ page }) => {
    const leadPage = new LeadPage(page);

    await leadPage.goto();
    await leadPage.clickNew();

    const form = page.locator('lightning-record-edit-form');
    const requiredField = form.locator('input[required], lightning-input-field[required]');
    if (await requiredField.first().isVisible()) {
      await leadPage.save();
      await waitForLightningReady(page);

      const errorIndicator = page.locator('.slds-has-error, .page-level-errors, [role="alert"]');
      await expect(errorIndicator.first()).toBeVisible({ timeout: 10_000 });
    }
  });

  test('@regression dropdown/picklist renders options correctly', async ({ page }) => {
    const leadPage = new LeadPage(page);

    await leadPage.goto();
    await leadPage.clickNew();

    await openLightningCombobox(page, /lead status|status/i, 'Status');

    const options = page.locator('[role="option"], lightning-base-combobox-item');
    await expect(options.first()).toBeVisible({ timeout: 10_000 });
    expect(await options.count()).toBeGreaterThan(0);
  });

  test('@smoke App Launcher opens and shows apps', async ({ page }) => {
    const homePage = new SalesforceHomePage(page);
    await homePage.goto();

    await homePage.openAppLauncher();
    const modal = new ModalComponent(page);
    await modal.expectModalVisible(/app launcher/i);
  });
});
