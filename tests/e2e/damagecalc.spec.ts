import { expect, test, type Page } from '@playwright/test';

const gotoDamageCalc = async (page: Page) => {
  await page.goto('/damagecalc', { waitUntil: 'networkidle' });
  await expect(page.getByTestId('damagecalc-attacking')).toBeVisible();
  await expect(page.getByTestId('damagecalc-defending')).toBeVisible();
};

test.describe('/damagecalc shareable state', () => {
  test('serializes calculator state into the URL and restores it on load', async ({ page }) => {
    await gotoDamageCalc(page);

    await page.locator('#attacking #atk').fill('3000');
    await page.locator('#defending #atk').fill('2000');
    await page
      .getByTestId('damagecalc-attacking')
      .getByRole('checkbox', { name: /inflicts double battle damage/i })
      .check();

    await expect(page.getByTestId('damagecalc-b-battle')).toHaveText('2000');
    await expect.poll(() => page.url()).toContain('_data=');

    const sharedUrl = page.url();
    expect(sharedUrl).toContain('_data=');

    await page.goto('/damagecalc', { waitUntil: 'networkidle' });
    await expect(page.locator('#attacking #atk')).toHaveValue('0');
    await expect(page.getByTestId('damagecalc-b-battle')).toHaveText('0');

    await page.goto(sharedUrl, { waitUntil: 'networkidle' });
    await expect(page.locator('#attacking #atk')).toHaveValue('3000');
    await expect(page.locator('#defending #atk')).toHaveValue('2000');
    await expect(
      page.getByTestId('damagecalc-attacking').getByRole('checkbox', { name: /inflicts double battle damage/i }),
    ).toBeChecked();
    await expect(page.getByTestId('damagecalc-b-battle')).toHaveText('2000');
  });
});
