import { expect, test } from '@playwright/test';

test.describe('/database card search', () => {
  test('shows 0 results when no name, effect, pendulum, or stat filters are active', async ({ page }) => {
    await page.goto('/database');
    await expect(page.getByTestId('database-results-count')).toHaveText(/0 results/);
  });

  test('name search returns results after debounce', async ({ page }) => {
    await page.goto('/database');
    await page.getByTestId('database-search-name').fill('a');
    await expect.poll(async () => page.getByTestId('database-results-count').textContent(), {
      timeout: 15_000,
    }).not.toMatch(/^0 results$/);
    const text = await page.getByTestId('database-results-count').textContent();
    const n = Number(text?.replace(/\D/g, '') ?? '0');
    expect(n).toBeGreaterThan(0);
  });

  test('stat filter: attribute DARK applies after debounce', async ({ page }) => {
    await page.goto('/database');
    await page.getByTestId('filter-add-condition').click();
    await page.getByTestId('filter-condition-field').selectOption('cat:attribute_id');
    await page.getByTestId('filter-attribute-dark').check();
    await expect(page.getByTestId('database-results-count')).toHaveText(/0 results/);
    await expect.poll(async () => page.getByTestId('database-results-count').textContent(), {
      timeout: 15_000,
    }).not.toMatch(/^0 results$/);
    const text = await page.getByTestId('database-results-count').textContent();
    const n = Number(text?.replace(/\D/g, '') ?? '0');
    expect(n).toBeGreaterThan(0);
  });
});
