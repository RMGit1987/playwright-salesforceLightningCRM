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

export class OpportunityPage {
  readonly newButton: Locator;
  readonly saveButton: Locator;

  constructor(private readonly page: Page) {
    this.newButton = page.getByRole('button', { name: /new/i });
    this.saveButton = page.getByRole('button', { name: /save/i });
  }

  async goto() {
    await openLightningObjectHome(this.page, 'Opportunity', 'Opportunities');
  }

  async clickNew() {
    await clickNewRecord(this.page);
  }

  async fillOpportunityForm(data: {
    name: string;
    stage?: string;
    closeDate?: string;
    amount?: number;
    type?: string;
    accountId?: string;
  }) {
    await fillLightningTextField(this.page, /opportunity name|name/i, 'Name', data.name);

    if (data.stage) {
      await selectLightningComboboxOption(this.page, /stage/i, 'StageName', data.stage);
    }
    if (data.closeDate) {
      await fillLightningTextField(this.page, /close date/i, 'CloseDate', data.closeDate);
    }
    if (typeof data.amount === 'number') {
      await fillLightningTextField(this.page, /amount/i, 'Amount', data.amount.toString());
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

  async openOpportunityByName(name: string) {
    await this.page.getByRole('link', { name: new RegExp(name, 'i') }).first().click();
    await waitForLightningReady(this.page);
  }

  async expectOpportunityDetailPage() {
    await expect(this.page).toHaveURL(/\/lightning\/r\/Opportunity\/[a-zA-Z0-9]{15,18}/);
  }
}
