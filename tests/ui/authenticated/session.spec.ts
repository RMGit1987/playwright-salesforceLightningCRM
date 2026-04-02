import { test, expect } from '../../fixtures/base.fixture';

test.describe('Feature: Authenticated State', () => {
  test('@smoke session persists after navigation', async ({ page }) => {
    await page.goto('/lightning/page/home');
    await expect(page).toHaveURL(/lightning/, { timeout: 30_000 });

    await page.goto('/lightning/o/Lead/list');
    await expect(page).toHaveURL(/lightning\/o\/Lead/, { timeout: 30_000 });

    await page.goto('/lightning/o/Account/list');
    await expect(page).toHaveURL(/lightning\/o\/Account/, { timeout: 30_000 });
  });

  test('@regression authenticated user can access all object tabs', async ({ page }) => {
    const objects = ['Lead', 'Account', 'Contact', 'Opportunity', 'Case'];

    for (const obj of objects) {
      await page.goto(`/lightning/o/${obj}/list`);
      await expect(page).toHaveURL(new RegExp(`lightning/o/${obj}`, 'i'), { timeout: 30_000 });
    }
  });
});
