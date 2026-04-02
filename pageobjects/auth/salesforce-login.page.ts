import { Locator, Page, expect } from '@playwright/test';
import { autoHealClick, autoHealFill, autoHealWaitVisible } from '../../utils/autoHeal';
import { isLightningUrl, waitForLightningReady } from '../../utils/salesforceLightning';
import { resolveSalesforceMfaCodeFromEnv } from '../../utils/totp';

function getMfaCompletionTimeoutMs(): number {
  const configured = process.env.SALESFORCE_MFA_TIMEOUT_MS;
  if (!configured) return 120_000;
  const parsed = Number.parseInt(configured, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 120_000;
}

export class SalesforceLoginPage {
  readonly usernameInput: Locator;
  readonly passwordInput: Locator;
  readonly loginButton: Locator;
  readonly errorMessage: Locator;

  constructor(private readonly page: Page) {
    this.usernameInput = page.getByLabel(/username/i);
    this.passwordInput = page.getByLabel(/password/i);
    this.loginButton = page.getByRole('button', { name: /log in/i });
    this.errorMessage = page.locator('#error');
  }

  async goto() {
    await this.page.goto('/');
  }

  async loginIfNeeded(username: string, password: string) {
    await this.page.goto('/lightning/page/home');
    await this.page.waitForLoadState('domcontentloaded');

    if (isLightningUrl(this.page.url())) {
      await waitForLightningReady(this.page);
      return;
    }

    await this.goto();
    await this.login(username, password);
    await this.expectSuccessfulLogin();
  }

  async login(username: string, password: string) {
    await autoHealWaitVisible(
      this.page,
      [
        { label: 'username label', locator: this.usernameInput },
        { label: 'username input name', locator: this.page.locator('input[name="username"]') },
        { label: 'username input type email', locator: this.page.locator('input[type="email"]') },
      ],
      10_000,
      'Wait for the Salesforce username field using bounded fallback candidates.',
    );

    await autoHealFill(
      this.page,
      [
        { label: 'username label', locator: this.usernameInput },
        { label: 'username input name', locator: this.page.locator('input[name="username"]') },
        { label: 'username input type email', locator: this.page.locator('input[type="email"]') },
      ],
      username,
      10_000,
      'Fill Salesforce username with resilient locator candidates.',
    );

    await autoHealFill(
      this.page,
      [
        { label: 'password label', locator: this.passwordInput },
        { label: 'password input name', locator: this.page.locator('input[name="pw"]') },
        { label: 'password input type', locator: this.page.locator('input[type="password"]') },
      ],
      password,
      10_000,
      'Fill Salesforce password with resilient locator candidates.',
    );

    await autoHealClick(
      this.page,
      [
        { label: 'login button role', locator: this.loginButton },
        { label: 'login button type submit', locator: this.page.locator('button[type="submit"]') },
        { label: 'login input submit', locator: this.page.locator('input[type="submit"]') },
      ],
      10_000,
      'Submit the Salesforce login form with bounded fallback candidates.',
    );
  }

  async expectSuccessfulLogin() {
    await this.page.waitForURL(/lightning|verification|challenge|mfa/i, { timeout: 60_000 });

    if (/verification|challenge|mfa/i.test(this.page.url())) {
      await this.handleMfaIfPresent();
      await this.page
        .waitForURL((url) => /lightning/i.test(url.toString()), {
          timeout: getMfaCompletionTimeoutMs(),
        })
        .catch(() => undefined);
    }

    if (/verification|challenge|mfa/i.test(this.page.url())) {
      throw new Error(
        'Salesforce login reached an MFA challenge and did not complete in time. Set SALESFORCE_MFA_CODE, SALESFORCE_TOTP_SECRET, or SALESFORCE_TOTP_URI for automation, or approve the challenge manually before SALESFORCE_MFA_TIMEOUT_MS expires.',
      );
    }

    await waitForLightningReady(this.page);
    await expect(this.page).toHaveURL(/lightning/i, { timeout: 10_000 });
  }

  async expectLoginError() {
    await expect(this.errorMessage).toBeVisible({ timeout: 10_000 });
  }

  async expectMfaChallenge() {
    await expect(this.page).toHaveURL(/verification|challenge|mfa/i, { timeout: 30_000 });
  }

  async handleMfaIfPresent(verificationCode?: string) {
    const currentUrl = this.page.url();
    if (!/verification|challenge|mfa/i.test(currentUrl)) return false;

    const resolvedCode = verificationCode || resolveSalesforceMfaCodeFromEnv();
    if (!resolvedCode) return true;

    const codeInput = await autoHealFill(
      this.page,
      [
        { label: 'verification code label', locator: this.page.getByLabel(/verification code|code/i) },
        { label: 'verification code id', locator: this.page.locator('#smc') },
        { label: 'verification code name', locator: this.page.locator('input[name="smc"]') },
      ],
      resolvedCode,
      10_000,
      'Fill the Salesforce MFA verification code.',
    ).catch(() => null);

    if (!codeInput) return true;

    await autoHealClick(
      this.page,
      [
        { label: 'verify button role', locator: this.page.getByRole('button', { name: /verify|submit/i }) },
        { label: 'verify submit input', locator: this.page.locator('input[type="submit"][value*="Verify"]') },
        { label: 'verify button id', locator: this.page.locator('#save') },
      ],
      10_000,
      'Submit the Salesforce MFA verification form.',
    );

    await this.page.waitForLoadState('domcontentloaded').catch(() => undefined);
    return true;
  }
}
