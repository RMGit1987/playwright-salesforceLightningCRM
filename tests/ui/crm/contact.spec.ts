import { test, expect } from '../../fixtures/base.fixture';
import { SalesforceLoginPage } from '../../../pageobjects/auth/salesforce-login.page';
import { ContactPage } from '../../../pageobjects/salesforce/contact.page';
import { buildContactPayload } from '../../../utils/testData';
import { waitForLightningReady } from '../../../utils/salesforceLightning';

test.describe('Feature: Contact Management', () => {
  test.beforeEach(async ({ page, salesforceUser }) => {
    const loginPage = new SalesforceLoginPage(page);
    await loginPage.loginIfNeeded(salesforceUser.username, salesforceUser.password);
  });

  test('@smoke @critical create a new contact', async ({ page }) => {
    const contactPage = new ContactPage(page);
    const contactData = buildContactPayload();

    await contactPage.goto();
    await contactPage.clickNew();
    await contactPage.fillContactForm(contactData);
    await contactPage.saveAndExpectSuccess();
  });

  test('@smoke create contact with all fields', async ({ page }) => {
    const contactPage = new ContactPage(page);
    const contactData = {
      ...buildContactPayload(),
      title: 'Senior Manager',
    };

    await contactPage.goto();
    await contactPage.clickNew();
    await contactPage.fillContactForm(contactData);
    await contactPage.saveAndExpectSuccess();
  });

  test('@regression contact requires last name', async ({ page }) => {
    const contactPage = new ContactPage(page);

    await contactPage.goto();
    await contactPage.clickNew();
    await contactPage.save();

    const errorDialog = page.getByRole('dialog', { name: /we hit a snag/i });
    await expect(errorDialog).toBeVisible({ timeout: 10_000 });
    await expect(errorDialog).toContainText('Name');
  });

  test('@regression create contact and verify in list', async ({ page }) => {
    const contactPage = new ContactPage(page);
    const contactData = buildContactPayload();

    await contactPage.goto();
    await contactPage.clickNew();
    await contactPage.fillContactForm(contactData);
    await contactPage.saveAndExpectSuccess();

    await contactPage.goto();
    await waitForLightningReady(page);

    const contactLink = page.getByRole('link', { name: new RegExp(`${contactData.firstName}.*${contactData.lastName}`, 'i') });
    await expect(contactLink.first()).toBeVisible({ timeout: 15_000 });
  });
});
