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

export class LeadPage {
  readonly newButton: Locator;
  readonly saveButton: Locator;
  readonly cancelButton: Locator;
  readonly toastMessage: Locator;

  constructor(private readonly page: Page) {
    this.newButton = page.getByRole('button', { name: /new/i });
    this.saveButton = page.getByRole('button', { name: /save/i });
    this.cancelButton = page.getByRole('button', { name: /cancel/i });
    this.toastMessage = page.locator('.slds-notify__content, lightning-toast');
  }

  async goto() {
    await openLightningObjectHome(this.page, 'Lead', 'Leads');
  }

  async clickNew() {
    await clickNewRecord(this.page);
  }

  async fillLeadForm(data: {
    firstName?: string;
    lastName: string;
    company: string;
    email?: string;
    phone?: string;
    title?: string;
    status?: string;
    industry?: string;
  }) {
    if (data.firstName) {
      await fillLightningTextField(this.page, /first name/i, 'FirstName', data.firstName);
    }
    await fillLightningTextField(this.page, /last name/i, 'LastName', data.lastName);
    await fillLightningTextField(this.page, /company/i, 'Company', data.company);

    if (data.email) {
      await fillLightningTextField(this.page, /email/i, 'Email', data.email);
    }
    if (data.phone) {
      await fillLightningTextField(this.page, /phone/i, 'Phone', data.phone);
    }
    if (data.title) {
      await fillLightningTextField(this.page, /title/i, 'Title', data.title);
    }
    if (data.status) {
      await selectLightningComboboxOption(this.page, /lead status|status/i, 'Status', data.status);
    }
    if (data.industry) {
      await selectLightningComboboxOption(this.page, /industry/i, 'Industry', data.industry);
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

  async openLeadByName(name: string) {
    await this.page.getByRole('link', { name: new RegExp(name, 'i') }).first().click();
    await waitForLightningReady(this.page);
  }

  async expectLeadDetailPage() {
    await expect(this.page).toHaveURL(/\/lightning\/r\/Lead\/[a-zA-Z0-9]{15,18}/);
  }
}
