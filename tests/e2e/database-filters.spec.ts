import { expect, test, type Page } from '@playwright/test';

const resultsCount = (page: Page) => page.getByTestId('database-results-count');

const gotoDatabase = async (page: Page) => {
  await page.goto('/database', { waitUntil: 'networkidle' });
  await expect(page.getByTestId('database-search-name')).toBeVisible();
  await expect(page.getByTestId('filter-add-condition')).toBeVisible();
};

const parseResultCount = async (page: Page): Promise<number> => {
  const text = await resultsCount(page).textContent();
  const match = text?.match(/^(\d+)/);
  return Number(match?.[1] ?? '0');
};

const waitForNonZeroResults = async (page: Page, timeout = 15_000) => {
  await expect.poll(async () => parseResultCount(page), { timeout }).toBeGreaterThan(0);
};

test.describe('/database card search', () => {
  test('shows 0 results when no name, effect, pendulum, or stat filters are active', async ({ page }) => {
    await gotoDatabase(page);
    await expect(resultsCount(page)).toHaveText(/0 results/);
    await expect(page.getByTestId('database-card')).toHaveCount(0);
  });

  test('name search returns results after debounce', async ({ page }) => {
    await gotoDatabase(page);
    await page.getByTestId('database-search-name').fill('Blue-Eyes');
    await waitForNonZeroResults(page);
    await expect(page.getByTestId('database-card').first()).toBeVisible();
    await expect(page.getByTestId('database-card-name').first()).toContainText(/Blue-Eyes/i);
  });

  test('effect contains search returns results', async ({ page }) => {
    await gotoDatabase(page);
    await page.getByTestId('database-search-effect').fill('destroy');
    await waitForNonZeroResults(page);
    const n = await parseResultCount(page);
    expect(n).toBeGreaterThan(0);
    await expect(page.getByTestId('database-card').first()).toBeVisible();
  });

  test('regex effect search validates pattern and can match', async ({ page }) => {
    await gotoDatabase(page);
    await page.getByTestId('database-search-effect-regex').click();
    await expect(page.getByTestId('database-search-effect-flag-i')).toBeVisible();
    await page.getByTestId('database-search-effect').fill('(');
    await expect(page.getByTestId('database-search-effect-error')).toBeVisible();

    await page.getByTestId('database-search-effect').fill('destroy.*monster');
    await page.getByTestId('database-search-effect-flag-i').click();
    await expect(page.getByTestId('database-search-effect-ok')).toContainText('/destroy.*monster/i');
    await waitForNonZeroResults(page);
  });

  test('hide effect text toggles effect visibility on results', async ({ page }) => {
    await gotoDatabase(page);
    await page.getByTestId('database-search-name').fill('Dark Magician');
    await waitForNonZeroResults(page);

    const effect = page.getByTestId('database-card-effect').first();
    await expect(effect).toBeVisible();
    await page.getByTestId('database-hide-effect-text').check();
    await expect(effect).toBeHidden();
    await page.getByTestId('database-hide-effect-text').uncheck();
    await expect(effect).toBeVisible();
  });

  test('stat filter: attribute DARK applies after debounce', async ({ page }) => {
    await gotoDatabase(page);
    await page.getByTestId('filter-add-condition').click();
    await expect(page.getByTestId('filter-condition-field')).toBeVisible({ timeout: 10_000 });
    await page.getByTestId('filter-condition-field').selectOption('cat:attribute_id');
    await page.getByTestId('filter-attribute-dark').click();
    await expect(page.getByTestId('filter-attribute-dark')).toHaveAttribute('aria-pressed', 'true');
    await expect(resultsCount(page)).toHaveText(/0 results/);
    await waitForNonZeroResults(page);
    const n = await parseResultCount(page);
    expect(n).toBeGreaterThan(0);
  });

  test('name + effect filters combine (intersection)', async ({ page }) => {
    await gotoDatabase(page);
    await page.getByTestId('database-search-name').fill('Dragon');
    await waitForNonZeroResults(page);
    const nameOnly = await parseResultCount(page);

    await page.getByTestId('database-search-effect').fill('destroy');
    await expect.poll(async () => parseResultCount(page), { timeout: 15_000 }).toBeLessThanOrEqual(nameOnly);
    const combined = await parseResultCount(page);
    expect(combined).toBeGreaterThan(0);
    expect(combined).toBeLessThanOrEqual(nameOnly);
  });

  test('caps visible cards at 100 with overflow note', async ({ page }) => {
    await gotoDatabase(page);
    await page.getByTestId('database-search-name').fill('a');
    await waitForNonZeroResults(page);
    const total = await parseResultCount(page);
    test.skip(total <= 100, 'Fixture data has ≤100 name matches for "a"; skip cap assertion');
    await expect(resultsCount(page)).toContainText('showing first 100');
    await expect(page.getByTestId('database-card')).toHaveCount(100);
  });

  test('result cards expose external reference links', async ({ page }) => {
    await gotoDatabase(page);
    await page.getByTestId('database-search-name').fill('Blue-Eyes White Dragon');
    await waitForNonZeroResults(page);

    const card = page.getByTestId('database-card').first();
    await expect(card.getByRole('link', { name: /Yugipedia/i })).toHaveAttribute('href', /yugipedia\.com/);
    await expect(card.getByRole('link', { name: /YGOResources/i })).toHaveAttribute('href', /ygoresources\.com/);
    await expect(card.getByRole('link', { name: /TCGPlayer/i })).toHaveAttribute('href', /tcgplayer\.com/);
  });

  test('search controls are present and labeled', async ({ page }) => {
    await gotoDatabase(page);
    await expect(page.getByTestId('database-search-name')).toBeVisible();
    await expect(page.getByTestId('database-search-effect')).toBeVisible();
    await expect(page.getByTestId('database-search-pendulum')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Stat filters' })).toBeVisible();
    await expect(page.getByTestId('database-hide-effect-text')).toBeVisible();
  });
});
