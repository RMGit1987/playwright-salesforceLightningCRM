import { Locator, Page, expect } from '@playwright/test';
import {
  clickNewRecord,
  clickSaveRecord,
  expectLightningToast,
  fillLightningTextField,
  openLightningObjectHome,
  selectLightningComboboxOption,
  selectLightningComboboxOptionFromCandidates,
  waitForLightningReady,
} from '../../utils/salesforceLightning';

export class AccountPage {
  readonly newButton: Locator;
  readonly saveButton: Locator;

  constructor(private readonly page: Page) {
    this.newButton = page.getByRole('button', { name: /new/i });
    this.saveButton = page.getByRole('button', { name: /save/i });
  }

  async goto() {
    await openLightningObjectHome(this.page, 'Account', 'Accounts');
  }

  async clickNew() {
    await clickNewRecord(this.page);
  }

  async fillAccountForm(data: {
    name: string;
    phone?: string;
    industry?: string;
    type?: string;
    website?: string;
  }) {
    await fillLightningTextField(this.page, /account name|name/i, 'Name', data.name);

    if (data.phone) {
      await fillLightningTextField(this.page, /phone/i, 'Phone', data.phone);
    }
    if (data.industry) {
      await selectLightningComboboxOption(this.page, /industry/i, 'Industry', data.industry);
    }
    if (data.type) {
      await selectLightningComboboxOptionFromCandidates(this.page, /type/i, 'Type', [
        data.type,
        'Customer - Direct',
        'Customer - Channel',
        'Prospect',
        'Partner',
        'Other',
      ]);
    }
    if (data.website) {
      await fillLightningTextField(this.page, /website/i, 'Website', data.website);
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

  async openAccountByName(name: string) {
    await this.page.getByRole('link', { name: new RegExp(name, 'i') }).first().click();
    await waitForLightningReady(this.page);
  }

  async expectAccountDetailPage() {
    await expect(this.page).toHaveURL(/\/lightning\/r\/Account\/[a-zA-Z0-9]{15,18}/);
  }
}
