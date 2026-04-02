import { test, expect } from '../../fixtures/base.fixture';
import { SalesforceLoginPage } from '../../../pageobjects/auth/salesforce-login.page';

test.describe('Feature: Salesforce Authentication', () => {
  test('@smoke @critical successful login with valid credentials', async ({ page, salesforceUser }) => {
    const loginPage = new SalesforceLoginPage(page);

    await loginPage.goto();
    await loginPage.login(salesforceUser.username, salesforceUser.password);
    await loginPage.expectSuccessfulLogin();
  });

  test('@smoke failed login with invalid credentials', async ({ page }) => {
    const loginPage = new SalesforceLoginPage(page);

    await loginPage.goto();
    await loginPage.login('invalid@test.com', 'wrongpassword');
    await loginPage.expectLoginError();
  });

  test('@regression login page has required fields', async ({ page }) => {
    const loginPage = new SalesforceLoginPage(page);

    await loginPage.goto();
    await expect(loginPage.usernameInput).toBeVisible();
    await expect(loginPage.passwordInput).toBeVisible();
    await expect(loginPage.loginButton).toBeVisible();
  });
});
