import { expect, test, type Page } from '@playwright/test';

const gotoMetaltronus = async (page: Page) => {
  await page.goto('/metaltronus', { waitUntil: 'networkidle' });
  await expect(page.getByTestId('metaltronus-target-input')).toBeVisible();
};

const pickFirstSuggestion = async (page: Page, testIdPrefix: string, query: string) => {
  const input = page.getByTestId(`${testIdPrefix}-input`);
  await input.fill(query);
  const suggestion = page.getByTestId(`${testIdPrefix}-suggestion`).first();
  await expect(suggestion).toBeVisible({ timeout: 15_000 });
  await suggestion.click();
  await expect(page.getByTestId(`${testIdPrefix}-selected`)).toBeVisible();
};

test.describe('/metaltronus helper', () => {
  test('home page links to the Metaltronus helper', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });
    await page.locator('a[href="/metaltronus"]').click();
    await expect(page).toHaveURL(/\/metaltronus/);
    await expect(page.getByTestId('metaltronus-target-input')).toBeVisible();
  });

  test('target search includes Extra Deck Fusion/Synchro/Xyz/Link monsters', async ({ page }) => {
    await gotoMetaltronus(page);

    const extraDeckNames = ['Accesscode Talker', 'Stardust Dragon', 'Number 39: Utopia', 'Blue-Eyes Ultimate Dragon'];
    const input = page.getByTestId('metaltronus-target-input');

    for (const name of extraDeckNames) {
      await input.fill(name);
      await expect(page.getByTestId('metaltronus-target-suggestion').getByText(name, { exact: true })).toBeVisible();
    }
  });

  test('target search excludes Token monsters', async ({ page }) => {
    await gotoMetaltronus(page);

    const input = page.getByTestId('metaltronus-target-input');
    await input.fill('Sheep Token');
    const exactName = /^Sheep Token$/;
    await expect(page.getByTestId('metaltronus-target-suggestion').filter({ hasText: exactName })).toHaveCount(0);
  });

  test('results stay hidden until a target monster is selected', async ({ page }) => {
    await gotoMetaltronus(page);
    await expect(page.getByTestId('metaltronus-results-count')).toHaveCount(0);
  });

  test('selecting a monster lists partners sharing two of Type, Attribute, and/or ATK', async ({ page }) => {
    await gotoMetaltronus(page);
    await expect(page.getByText(/legal summons if the selected card is the target/i)).toBeVisible();
    await expect(page.getByText(/legal targets if it is the summon/i)).toBeVisible();

    await pickFirstSuggestion(page, 'metaltronus-target', 'Dark Magician');
    await expect(page.getByTestId('metaltronus-results-count')).toHaveText(/\d+ partners/);

    const countText = await page.getByTestId('metaltronus-results-count').textContent();
    const n = Number(countText?.match(/^(\d+)/)?.[1] ?? '0');
    expect(n).toBeGreaterThan(0);

    await expect(page.getByTestId('metaltronus-card').first()).toBeVisible();
    await expect(page.getByTestId('metaltronus-card-name').first()).not.toBeEmpty();
    await expect(page.getByTestId('metaltronus-card-shared-prop').first()).toBeVisible();
  });

  test('clearing the selected monster hides partners', async ({ page }) => {
    await gotoMetaltronus(page);
    await pickFirstSuggestion(page, 'metaltronus-target', 'Ash Blossom');
    await expect(page.getByTestId('metaltronus-results-count')).toBeVisible();

    await page.getByTestId('metaltronus-target-clear').click();
    await expect(page.getByTestId('metaltronus-target-selected')).toHaveCount(0);
    await expect(page.getByTestId('metaltronus-results-count')).toHaveCount(0);
  });

  test('name filter narrows results and shows of-total', async ({ page }) => {
    await gotoMetaltronus(page);
    await pickFirstSuggestion(page, 'metaltronus-target', 'Dark Magician');

    const totalText = await page.getByTestId('metaltronus-results-count').textContent();
    const total = Number(totalText?.match(/^(\d+)/)?.[1] ?? '0');
    expect(total).toBeGreaterThan(0);

    const firstName = (await page.getByTestId('metaltronus-card-name').first().textContent())?.trim() ?? '';
    expect(firstName.length).toBeGreaterThan(0);
    const needle = firstName.slice(0, Math.min(6, firstName.length));

    await page.getByTestId('metaltronus-result-filter').fill(needle);
    await expect(page.getByTestId('metaltronus-results-count')).toHaveText(new RegExp(`^\\d+ partners \\(of ${total}\\)$`));

    const filteredText = await page.getByTestId('metaltronus-results-count').textContent();
    const filtered = Number(filteredText?.match(/^(\d+)/)?.[1] ?? '0');
    expect(filtered).toBeGreaterThan(0);
    expect(filtered).toBeLessThanOrEqual(total);

    await expect(page.getByTestId('metaltronus-card-name').first()).toContainText(new RegExp(needle, 'i'));
  });

  test('paginates partners 24 per page when there are enough results', async ({ page }) => {
    await gotoMetaltronus(page);
    await pickFirstSuggestion(page, 'metaltronus-target', 'Dark Magician');

    const totalText = await page.getByTestId('metaltronus-results-count').textContent();
    const total = Number(totalText?.match(/^(\d+)/)?.[1] ?? '0');
    test.skip(total <= 24, 'need more than one page of partners for this case');

    const pageLabel = page.getByTestId('metaltronus-page-label');
    const pagePrev = page.getByTestId('metaltronus-page-prev');
    const pageNext = page.getByTestId('metaltronus-page-next');

    await expect(pageLabel).toHaveCount(2);
    await expect(pageLabel.first()).toHaveText(/Page 1 of \d+/);
    await expect(pagePrev.first()).toBeDisabled();
    await expect(pageNext.first()).toBeEnabled();
    await expect(page.getByTestId('metaltronus-card')).toHaveCount(24);

    await pageNext.first().click();
    await expect(pageLabel.first()).toHaveText(/Page 2 of \d+/);
    await expect(pageLabel.last()).toHaveText(/Page 2 of \d+/);
    await expect(pagePrev.first()).toBeEnabled();
    await expect(page.getByTestId('metaltronus-card').first()).toBeVisible();
  });

  test('serializes picker state into the URL and restores it on load', async ({ page }) => {
    await gotoMetaltronus(page);
    await pickFirstSuggestion(page, 'metaltronus-target', 'Dark Magician');

    const targetName = (await page.getByTestId('metaltronus-target-selected').locator('.font-medium').textContent())?.trim() ?? '';
    expect(targetName.length).toBeGreaterThan(0);

    await expect.poll(() => page.url()).toContain('_data=');

    const firstName = (await page.getByTestId('metaltronus-card-name').first().textContent())?.trim() ?? '';
    expect(firstName.length).toBeGreaterThan(0);
    const needle = firstName.slice(0, Math.min(6, firstName.length));

    const urlBeforeFilter = page.url();
    await page.getByTestId('metaltronus-result-filter').fill(needle);
    await expect.poll(() => page.url()).not.toBe(urlBeforeFilter);

    const sharedUrl = page.url();
    expect(sharedUrl).toContain('_data=');

    await page.goto('/metaltronus', { waitUntil: 'networkidle' });
    await expect(page.getByTestId('metaltronus-target-selected')).toHaveCount(0);
    await expect(page.getByTestId('metaltronus-results-count')).toHaveCount(0);

    await page.goto(sharedUrl, { waitUntil: 'networkidle' });
    await expect(page.getByTestId('metaltronus-target-selected')).toContainText(targetName);
    await expect(page.getByTestId('metaltronus-result-filter')).toHaveValue(needle);
    await expect(page.getByTestId('metaltronus-results-count')).toBeVisible();
    await expect(page.getByTestId('metaltronus-card-name').first()).toContainText(new RegExp(needle, 'i'));

    const artSrc = /^(https?:)?\/\//;
    const resultArt = page.getByTestId('metaltronus-card').first().locator('img');
    await expect(resultArt).toHaveAttribute('src', artSrc, { timeout: 20_000 });
    const targetArt = page.getByTestId('metaltronus-target-selected').locator('img');
    await expect(targetArt).toHaveAttribute('src', artSrc, { timeout: 20_000 });
  });
});
