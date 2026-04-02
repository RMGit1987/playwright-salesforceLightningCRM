import { Locator, Page, expect } from '@playwright/test';

export class ModalComponent {
  readonly modal: Locator;
  readonly header: Locator;
  readonly body: Locator;
  readonly closeButton: Locator;
  readonly cancelButton: Locator;

  constructor(private readonly page: Page) {
    this.modal = page.locator('[role="dialog"], .slds-modal, lightning-modal');
    this.header = page.locator('[role="dialog"] [role="heading"], .slds-modal__header h2, .slds-modal__header');
    this.body = page.locator('[role="dialog"] .slds-modal__content, [role="dialog"] section, [role="dialog"] form, .slds-modal__content');
    this.closeButton = page.locator('[role="dialog"] button[title="Close"], .slds-modal__close, button[title="Close"]').first();
    this.cancelButton = page.getByRole('button', { name: /cancel/i });
  }

  async expectModalVisible(title?: string | RegExp) {
    if (title) {
      await expect(this.page.getByRole('dialog', { name: title })).toBeVisible({ timeout: 10_000 });
      return;
    }

    await expect(this.modal.first()).toBeVisible({ timeout: 10_000 });
  }

  async expectModalNotVisible() {
    await expect(this.modal.first()).not.toBeVisible({ timeout: 5_000 });
  }

  async close() {
    await this.closeButton.click();
    await this.expectModalNotVisible();
  }

  async cancel() {
    await this.cancelButton.click();
    await this.expectModalNotVisible();
  }

  async getBodyText(): Promise<string> {
    return (await this.body.textContent()) || '';
  }
}
