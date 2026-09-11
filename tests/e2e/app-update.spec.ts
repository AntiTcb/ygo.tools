import { expect, test } from '@playwright/test';
import { APP_UPDATE_ACTION_LABEL, APP_UPDATE_EVENT, APP_UPDATE_MESSAGE } from '../../src/lib/appUpdate';

test.describe('app update toast', () => {
  test('does not show a reload toast on a fresh page load', async ({ page }) => {
    await page.goto('/damagecalc', { waitUntil: 'networkidle' });
    await expect(page.getByText(APP_UPDATE_MESSAGE)).toHaveCount(0);
  });

  test('shows a reload toast and reloads the page when an update is available', async ({ page }) => {
    await page.goto('/damagecalc', { waitUntil: 'networkidle' });

    await page.evaluate((eventName) => {
      window.dispatchEvent(new Event(eventName));
    }, APP_UPDATE_EVENT);

    const toast = page.getByText(APP_UPDATE_MESSAGE);
    await expect(toast).toBeVisible();

    const reload = page.getByRole('button', { name: APP_UPDATE_ACTION_LABEL });
    await expect(reload).toBeVisible();

    const nextLoad = page.waitForEvent('load');
    await reload.click();
    await nextLoad;

    await expect(page.getByText(APP_UPDATE_MESSAGE)).toHaveCount(0);
  });
});
