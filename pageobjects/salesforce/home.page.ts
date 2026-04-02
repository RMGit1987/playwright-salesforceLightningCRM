import { Locator, Page, expect } from '@playwright/test';
import { autoHealClick, autoHealFill, autoHealWaitVisible } from '../../utils/autoHeal';
import { waitForLightningReady } from '../../utils/salesforceLightning';

export class SalesforceHomePage {
  readonly appLauncher: Locator;
  readonly navigationMenu: Locator;
  readonly userMenu: Locator;
  readonly homeTab: Locator;

  constructor(private readonly page: Page) {
    this.appLauncher = page.locator('one-app-launcher-header button, [data-testid="AppLauncher"]');
    this.navigationMenu = page.locator('nav.slds-nav-vertical, .slds-global-navigation');
    this.userMenu = page.locator('.profileTrigger, [data-testid="UserMenu"]');
    this.homeTab = page.getByRole('link', { name: /home/i });
  }

  async goto() {
    await this.page.goto('/lightning/page/home');
    await waitForLightningReady(this.page);
  }

  async openAppLauncher() {
    await autoHealClick(
      this.page,
      [
        { label: 'App Launcher header button', locator: this.appLauncher },
        { label: 'waffle button title', locator: this.page.locator('button[title*="App Launcher"]') },
      ],
      10_000,
      'Open the Salesforce App Launcher.',
    );
    await autoHealWaitVisible(
      this.page,
      [
        { label: 'App Launcher dialog', locator: this.page.getByRole('dialog', { name: /app launcher/i }) },
        { label: 'App Launcher heading', locator: this.page.getByRole('heading', { name: /app launcher/i }) },
        { label: 'App Launcher search', locator: this.page.getByRole('combobox', { name: /search apps and items/i }) },
      ],
      10_000,
      'Wait for the Salesforce App Launcher dialog to open.',
    );
  }

  async searchInAppLauncher(searchText: string) {
    await autoHealFill(
      this.page,
      [
        {
          label: 'App Launcher search placeholder',
          locator: this.page.locator('input[placeholder*="Search apps"], input[placeholder*="Search"]'),
        },
        { label: 'App Launcher search role', locator: this.page.getByRole('searchbox') },
      ],
      searchText,
      10_000,
      'Search within the Salesforce App Launcher.',
    );
  }

  async navigateToApp(appName: string) {
    await this.openAppLauncher();
    await this.searchInAppLauncher(appName);
    await this.page.getByRole('link', { name: new RegExp(appName, 'i') }).click();
  }

  async expectHomePage() {
    await waitForLightningReady(this.page);
    await expect(this.page).toHaveURL(/lightning/);
  }
}
