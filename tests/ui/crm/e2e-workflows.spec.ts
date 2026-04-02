import { test, expect } from '../../fixtures/base.fixture';
import { SalesforceLoginPage } from '../../../pageobjects/auth/salesforce-login.page';
import { LeadPage } from '../../../pageobjects/salesforce/lead.page';
import { AccountPage } from '../../../pageobjects/salesforce/account.page';
import { ContactPage } from '../../../pageobjects/salesforce/contact.page';
import { OpportunityPage } from '../../../pageobjects/salesforce/opportunity.page';
import { CasePage } from '../../../pageobjects/salesforce/case.page';
import { buildLeadPayload, buildAccountPayload, buildContactPayload, buildOpportunityPayload, buildCasePayload } from '../../../utils/testData';
import { waitForLightningReady } from '../../../utils/salesforceLightning';

test.describe.configure({ timeout: 420_000 });

test.describe('Feature: End-to-End CRM Workflows', () => {
  test.beforeEach(async ({ page, salesforceUser }) => {
    const loginPage = new SalesforceLoginPage(page);
    await loginPage.loginIfNeeded(salesforceUser.username, salesforceUser.password);
  });

  test('@e2e @critical full lead lifecycle', async ({ page }) => {
    const leadPage = new LeadPage(page);
    const leadData = buildLeadPayload();

    await leadPage.goto();
    await leadPage.clickNew();
    await leadPage.fillLeadForm(leadData);
    await leadPage.saveAndExpectSuccess();

    await leadPage.goto();
    await waitForLightningReady(page);

    const leadLink = page.getByRole('link', { name: new RegExp(leadData.lastName, 'i') });
    await expect(leadLink.first()).toBeVisible({ timeout: 15_000 });

    await leadLink.first().click();
    await waitForLightningReady(page);
    await expect(page).toHaveURL(/\/lightning\/r\/Lead\/[a-zA-Z0-9]{15,18}/, { timeout: 15_000 });
  });

  test('@e2e create account then linked contact', async ({ page }) => {
    const accountPage = new AccountPage(page);
    const contactPage = new ContactPage(page);
    const accountData = buildAccountPayload();
    const contactData = buildContactPayload();

    await accountPage.goto();
    await accountPage.clickNew();
    await accountPage.fillAccountForm(accountData);
    await accountPage.saveAndExpectSuccess();

    await contactPage.goto();
    await contactPage.clickNew();
    await contactPage.fillContactForm(contactData);
    await contactPage.saveAndExpectSuccess();
  });

  test('@e2e create opportunity with related account', async ({ page }) => {
    const accountPage = new AccountPage(page);
    const oppPage = new OpportunityPage(page);
    const accountData = buildAccountPayload();
    const oppData = buildOpportunityPayload();

    await accountPage.goto();
    await accountPage.clickNew();
    await accountPage.fillAccountForm(accountData);
    await accountPage.saveAndExpectSuccess();

    await oppPage.goto();
    await oppPage.clickNew();
    await oppPage.fillOpportunityForm(oppData);
    await oppPage.saveAndExpectSuccess();
  });

  test('@e2e create case for existing contact', async ({ page }) => {
    const contactPage = new ContactPage(page);
    const casePage = new CasePage(page);
    const contactData = buildContactPayload();
    const caseData = buildCasePayload();

    await contactPage.goto();
    await contactPage.clickNew();
    await contactPage.fillContactForm(contactData);
    await contactPage.saveAndExpectSuccess();

    await casePage.goto();
    await casePage.clickNew();
    await casePage.fillCaseForm(caseData);
    await casePage.saveAndExpectSuccess();
  });

  test('@e2e create records across all objects', async ({ page }) => {
    const leadPage = new LeadPage(page);
    const accountPage = new AccountPage(page);
    const contactPage = new ContactPage(page);
    const oppPage = new OpportunityPage(page);
    const casePage = new CasePage(page);

    const leadData = buildLeadPayload();
    const accountData = buildAccountPayload();
    const contactData = buildContactPayload();
    const oppData = buildOpportunityPayload();
    const caseData = buildCasePayload();

    await leadPage.goto();
    await leadPage.clickNew();
    await leadPage.fillLeadForm(leadData);
    await leadPage.saveAndExpectSuccess();

    await accountPage.goto();
    await accountPage.clickNew();
    await accountPage.fillAccountForm(accountData);
    await accountPage.saveAndExpectSuccess();

    await contactPage.goto();
    await contactPage.clickNew();
    await contactPage.fillContactForm(contactData);
    await contactPage.saveAndExpectSuccess();

    await oppPage.goto();
    await oppPage.clickNew();
    await oppPage.fillOpportunityForm(oppData);
    await oppPage.saveAndExpectSuccess();

    await casePage.goto();
    await casePage.clickNew();
    await casePage.fillCaseForm(caseData);
    await casePage.saveAndExpectSuccess();
  });
});
