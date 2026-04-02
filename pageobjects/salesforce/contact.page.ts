import { Locator, Page, expect } from '@playwright/test';
import {
  clickNewRecord,
  clickSaveRecord,
  expectLightningToast,
  fillLightningTextField,
  openLightningObjectHome,
  waitForLightningReady,
} from '../../utils/salesforceLightning';

export class ContactPage {
  readonly newButton: Locator;
  readonly saveButton: Locator;

  constructor(private readonly page: Page) {
    this.newButton = page.getByRole('button', { name: /new/i });
    this.saveButton = page.getByRole('button', { name: /save/i });
  }

  async goto() {
    await openLightningObjectHome(this.page, 'Contact', 'Contacts');
  }

  async clickNew() {
    await clickNewRecord(this.page);
  }

  async fillContactForm(data: {
    firstName: string;
    lastName: string;
    email?: string;
    phone?: string;
    title?: string;
    accountId?: string;
  }) {
    await fillLightningTextField(this.page, /first name/i, 'FirstName', data.firstName);
    await fillLightningTextField(this.page, /last name/i, 'LastName', data.lastName);

    if (data.email) {
      await fillLightningTextField(this.page, /email/i, 'Email', data.email);
    }
    if (data.phone) {
      await fillLightningTextField(this.page, /phone/i, 'Phone', data.phone);
    }
    if (data.title) {
      await fillLightningTextField(this.page, /title/i, 'Title', data.title);
    }
    if (data.accountId) {
      await fillLightningTextField(this.page, /account/i, 'AccountId', data.accountId);
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

  async openContactByName(name: string) {
    await this.page.getByRole('link', { name: new RegExp(name, 'i') }).first().click();
    await waitForLightningReady(this.page);
  }

  async expectContactDetailPage() {
    await expect(this.page).toHaveURL(/\/lightning\/r\/Contact\/[a-zA-Z0-9]{15,18}/);
  }
}
