import { Locator, Page, expect } from '@playwright/test';
import { expectLightningToast } from '../../utils/salesforceLightning';

export class ToastComponent {
  readonly toastContainer: Locator;
  readonly closeButton: Locator;

  constructor(private readonly page: Page) {
    this.toastContainer = page.locator('.slds-notify__content, [role="alert"], [role="status"], lightning-toast');
    this.closeButton = page.locator('.slds-notify__close button, lightning-toast button[title="Close"]').first();
  }

  async expectToastVisible(text?: string | RegExp) {
    if (text) {
      await expectLightningToast(this.page, typeof text === 'string' ? new RegExp(text, 'i') : text);
    } else {
      await expect(this.toastContainer.first()).toBeVisible({ timeout: 15_000 });
    }
  }

  async expectToastNotVisible() {
    await expect(this.toastContainer.first()).not.toBeVisible({ timeout: 5_000 });
  }

  async closeToast() {
    if (await this.closeButton.isVisible()) {
      await this.closeButton.click();
    }
  }

  async getToastText(): Promise<string> {
    return (await this.toastContainer.first().textContent()) || '';
  }
}
