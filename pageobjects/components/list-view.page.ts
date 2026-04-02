import { Locator, Page, expect } from '@playwright/test';
import { autoHealFill } from '../../utils/autoHeal';
import { waitForLightningReady } from '../../utils/salesforceLightning';

export class ListViewComponent {
  readonly searchInput: Locator;
  readonly filterButton: Locator;
  readonly table: Locator;
  readonly rows: Locator;
  readonly paginationNext: Locator;
  readonly paginationPrev: Locator;
  readonly listViewDropdown: Locator;

  constructor(private readonly page: Page) {
    this.searchInput = page.locator('input[name="search"], .slds-input[placeholder*="Search"]');
    this.filterButton = page.getByRole('button', { name: /filter/i });
    this.table = page.locator('table, lightning-datatable');
    this.rows = page.locator('table tbody tr, lightning-datatable [role="row"]');
    this.paginationNext = page.getByRole('button', { name: /next/i });
    this.paginationPrev = page.getByRole('button', { name: /previous/i });
    this.listViewDropdown = page.locator('.slds-dropdown-trigger, [data-testid="ListViewPicker"]');
  }

  async expectRowCount(minCount: number) {
    await expect(this.rows.first()).toBeVisible({ timeout: 15_000 });
    const count = await this.rows.count();
    expect(count).toBeGreaterThanOrEqual(minCount);
  }

  async searchAndSelect(text: string) {
    await autoHealFill(
      this.page,
      [
        { label: 'List view search input', locator: this.searchInput },
        { label: 'List view search role', locator: this.page.getByRole('searchbox') },
      ],
      text,
      10_000,
      'Search within a Salesforce list view.',
    );
    await this.page.keyboard.press('Enter');
    await waitForLightningReady(this.page);
  }

  async selectRow(index: number) {
    await this.rows.nth(index).click();
  }

  async selectRowByText(text: string) {
    await this.rows.filter({ hasText: text }).first().click();
  }

  async clickLinkInRow(linkText: string) {
    await this.page.getByRole('link', { name: new RegExp(linkText, 'i') }).first().click();
  }

  async goToNextPage() {
    await this.paginationNext.click();
    await waitForLightningReady(this.page);
  }

  async goToPreviousPage() {
    await this.paginationPrev.click();
    await waitForLightningReady(this.page);
  }

  async switchListView(viewName: string) {
    await this.listViewDropdown.click();
    await this.page.getByRole('option', { name: new RegExp(viewName, 'i') }).click();
    await waitForLightningReady(this.page);
  }

  async getColumnValue(rowIndex: number, columnName: string): Promise<string> {
    const row = this.rows.nth(rowIndex);
    const cell = row.locator(`td[data-label="${columnName}"], td:has-text("${columnName}")`);
    return (await cell.textContent()) || '';
  }
}
