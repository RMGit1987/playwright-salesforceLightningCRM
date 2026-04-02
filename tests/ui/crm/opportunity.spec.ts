import { test, expect } from '../../fixtures/base.fixture';
import { SalesforceLoginPage } from '../../../pageobjects/auth/salesforce-login.page';
import { OpportunityPage } from '../../../pageobjects/salesforce/opportunity.page';
import { AccountPage } from '../../../pageobjects/salesforce/account.page';
import { buildOpportunityPayload, buildAccountPayload } from '../../../utils/testData';
import { openLightningCombobox, waitForLightningReady } from '../../../utils/salesforceLightning';

test.describe('Feature: Opportunity Management', () => {
  test.beforeEach(async ({ page, salesforceUser }) => {
    const loginPage = new SalesforceLoginPage(page);
    await loginPage.loginIfNeeded(salesforceUser.username, salesforceUser.password);
  });

  test('@smoke @critical create a new opportunity', async ({ page }) => {
    const oppPage = new OpportunityPage(page);
    const oppData = buildOpportunityPayload();

    await oppPage.goto();
    await oppPage.clickNew();
    await oppPage.fillOpportunityForm(oppData);
    await oppPage.saveAndExpectSuccess();
  });

  test('@smoke create opportunity with stage Prospecting', async ({ page }) => {
    const oppPage = new OpportunityPage(page);
    const oppData = { ...buildOpportunityPayload(), stage: 'Prospecting' };

    await oppPage.goto();
    await oppPage.clickNew();
    await oppPage.fillOpportunityForm(oppData);
    await oppPage.saveAndExpectSuccess();
  });

  test('@regression create opportunity and verify in list view', async ({ page }) => {
    const oppPage = new OpportunityPage(page);
    const oppData = buildOpportunityPayload();

    await oppPage.goto();
    await oppPage.clickNew();
    await oppPage.fillOpportunityForm(oppData);
    await oppPage.saveAndExpectSuccess();

    await oppPage.goto();
    await waitForLightningReady(page);

    const oppLink = page.getByRole('link', { name: new RegExp(oppData.name, 'i') });
    await expect(oppLink.first()).toBeVisible({ timeout: 15_000 });
  });

  test('@regression opportunity stage values are available', async ({ page }) => {
    const oppPage = new OpportunityPage(page);

    await oppPage.goto();
    await oppPage.clickNew();

    await openLightningCombobox(page, /stage/i, 'StageName');

    const expectedStages = ['Prospecting', 'Qualification', 'Needs Analysis', 'Value Proposition', 'Closed Won', 'Closed Lost'];
    for (const stage of expectedStages) {
      await expect(page.getByRole('option', { name: stage })).toBeVisible({ timeout: 5_000 });
    }
  });
});

test.describe('Feature: Account Management', () => {
  test.beforeEach(async ({ page, salesforceUser }) => {
    const loginPage = new SalesforceLoginPage(page);
    await loginPage.loginIfNeeded(salesforceUser.username, salesforceUser.password);
  });

  test('@smoke @critical create a new account', async ({ page }) => {
    const accountPage = new AccountPage(page);
    const accountData = buildAccountPayload();

    await accountPage.goto();
    await accountPage.clickNew();
    await accountPage.fillAccountForm(accountData);
    await accountPage.saveAndExpectSuccess();
  });

  test('@smoke create account with industry and type', async ({ page }) => {
    const accountPage = new AccountPage(page);
    const accountData = { ...buildAccountPayload(), industry: 'Technology', type: 'Customer' };

    await accountPage.goto();
    await accountPage.clickNew();
    await accountPage.fillAccountForm(accountData);
    await accountPage.saveAndExpectSuccess();
  });

  test('@regression create account and verify in list', async ({ page }) => {
    const accountPage = new AccountPage(page);
    const accountData = buildAccountPayload();

    await accountPage.goto();
    await accountPage.clickNew();
    await accountPage.fillAccountForm(accountData);
    await accountPage.saveAndExpectSuccess();

    await accountPage.goto();
    await waitForLightningReady(page);

    const accountLink = page.getByRole('link', { name: new RegExp(accountData.name, 'i') });
    await expect(accountLink.first()).toBeVisible({ timeout: 15_000 });
  });
});
