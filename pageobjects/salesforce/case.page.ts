import { Locator, Page, expect } from '@playwright/test';
import {
  clickNewRecord,
  clickSaveRecord,
  expectLightningToast,
  fillLightningTextField,
  openLightningObjectHome,
  selectLightningComboboxOption,
  waitForLightningReady,
} from '../../utils/salesforceLightning';

export class CasePage {
  readonly newButton: Locator;
  readonly saveButton: Locator;

  constructor(private readonly page: Page) {
    this.newButton = page.getByRole('button', { name: /new/i });
    this.saveButton = page.getByRole('button', { name: /save/i });
  }

  async goto() {
    await openLightningObjectHome(this.page, 'Case', 'Cases');
  }

  async clickNew() {
    await clickNewRecord(this.page);
  }

  async fillCaseForm(data: {
    subject: string;
    description?: string;
    status?: string;
    priority?: string;
    origin?: string;
    accountId?: string;
    contactId?: string;
  }) {
    await fillLightningTextField(this.page, /case subject|subject/i, 'Subject', data.subject);

    if (data.description) {
      await fillLightningTextField(this.page, /description/i, 'Description', data.description, { multiline: true });
    }
    if (data.status) {
      await selectLightningComboboxOption(this.page, /case status|status/i, 'Status', data.status);
    }
    if (data.priority) {
      await selectLightningComboboxOption(this.page, /priority/i, 'Priority', data.priority);
    }
    if (data.origin) {
      await selectLightningComboboxOption(this.page, /case origin|origin/i, 'Origin', data.origin);
    }
  }

  async save() {
    await clickSaveRecord(this.page);
  }

  async saveAndExpectSuccess() {
    await this.save();
    await this.expectToastContaining(/success|created/i);
  }

  async expectToastContaining(text: RegExp) {
    await expectLightningToast(this.page, text);
  }

  async openCaseBySubject(subject: string) {
    await this.page.getByRole('link', { name: new RegExp(subject, 'i') }).first().click();
    await waitForLightningReady(this.page);
  }

  async expectCaseDetailPage() {
    await expect(this.page).toHaveURL(/\/lightning\/r\/Case\/[a-zA-Z0-9]{15,18}/);
  }

  async expectValidationError(field: string, message: string) {
    const errorEl = this.page.locator(`[data-field="${field}"] .slds-form-element__help, .page-level-errors`);
    await expect(errorEl).toContainText(message, { timeout: 5_000 });
  }
}
