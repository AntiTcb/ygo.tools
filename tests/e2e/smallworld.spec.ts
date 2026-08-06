import { expect, test, type Page } from '@playwright/test';

const gotoSmallWorld = async (page: Page) => {
  await page.goto('/smallworld', { waitUntil: 'networkidle' });
  await expect(page.getByTestId('smallworld-reveal-input')).toBeVisible();
  await expect(page.getByTestId('smallworld-bridge-input')).toBeVisible();
};

const pickFirstSuggestion = async (page: Page, testIdPrefix: string, query: string) => {
  const input = page.getByTestId(`${testIdPrefix}-input`);
  await input.fill(query);
  const suggestion = page.getByTestId(`${testIdPrefix}-suggestion`).first();
  await expect(suggestion).toBeVisible({ timeout: 15_000 });
  await suggestion.click();
  await expect(page.getByTestId(`${testIdPrefix}-selected`)).toBeVisible();
};

test.describe('/smallworld helper', () => {
  test('bridge picker stays disabled until a reveal monster is selected', async ({ page }) => {
    await gotoSmallWorld(page);
    await expect(page.getByTestId('smallworld-bridge-input')).toBeDisabled();
    await expect(page.getByTestId('smallworld-results-count')).toHaveCount(0);
  });

  test('selecting reveal then bridge shows exact one-property targets', async ({ page }) => {
    await gotoSmallWorld(page);

    await pickFirstSuggestion(page, 'smallworld-reveal', 'Dark Magician');
    await expect(page.getByTestId('smallworld-bridge-input')).toBeEnabled();
    await expect(page.getByText(/exact one-property bridges/i)).toBeVisible();

    await pickFirstSuggestion(page, 'smallworld-bridge', 'a');
    await expect(page.getByTestId('smallworld-reveal-bridge-prop')).toBeVisible();
    await expect(page.getByTestId('smallworld-results-count')).toHaveText(/\d+ targets/);

    const countText = await page.getByTestId('smallworld-results-count').textContent();
    const n = Number(countText?.match(/^(\d+)/)?.[1] ?? '0');
    expect(n).toBeGreaterThan(0);

    await expect(page.getByTestId('smallworld-card').first()).toBeVisible();
    await expect(page.getByTestId('smallworld-card-name').first()).not.toBeEmpty();
    await expect(page.getByTestId('smallworld-card-bridge-prop').first()).toBeVisible();
  });

  test('clearing reveal clears bridge and hides targets', async ({ page }) => {
    await gotoSmallWorld(page);
    await pickFirstSuggestion(page, 'smallworld-reveal', 'Ash Blossom');
    await pickFirstSuggestion(page, 'smallworld-bridge', 'e');
    await expect(page.getByTestId('smallworld-results-count')).toBeVisible();

    await page.getByTestId('smallworld-reveal-clear').click();
    await expect(page.getByTestId('smallworld-reveal-selected')).toHaveCount(0);
    await expect(page.getByTestId('smallworld-bridge-selected')).toHaveCount(0);
    await expect(page.getByTestId('smallworld-bridge-input')).toBeDisabled();
    await expect(page.getByTestId('smallworld-results-count')).toHaveCount(0);
  });

  test('target name filter narrows results and shows of-total', async ({ page }) => {
    await gotoSmallWorld(page);
    await pickFirstSuggestion(page, 'smallworld-reveal', 'Dark Magician');
    await pickFirstSuggestion(page, 'smallworld-bridge', 'a');

    const totalText = await page.getByTestId('smallworld-results-count').textContent();
    const total = Number(totalText?.match(/^(\d+)/)?.[1] ?? '0');
    expect(total).toBeGreaterThan(0);

    const firstName = (await page.getByTestId('smallworld-card-name').first().textContent())?.trim() ?? '';
    expect(firstName.length).toBeGreaterThan(0);
    const needle = firstName.slice(0, Math.min(6, firstName.length));

    await page.getByTestId('smallworld-target-filter').fill(needle);
    await expect(page.getByTestId('smallworld-results-count')).toHaveText(new RegExp(`^\\d+ targets \\(of ${total}\\)$`));

    const filteredText = await page.getByTestId('smallworld-results-count').textContent();
    const filtered = Number(filteredText?.match(/^(\d+)/)?.[1] ?? '0');
    expect(filtered).toBeGreaterThan(0);
    expect(filtered).toBeLessThanOrEqual(total);

    await expect(page.getByTestId('smallworld-card-name').first()).toContainText(new RegExp(needle, 'i'));
  });

  test('paginates targets 24 per page when there are enough results', async ({ page }) => {
    await gotoSmallWorld(page);
    await pickFirstSuggestion(page, 'smallworld-reveal', 'Dark Magician');
    await pickFirstSuggestion(page, 'smallworld-bridge', 'a');

    const totalText = await page.getByTestId('smallworld-results-count').textContent();
    const total = Number(totalText?.match(/^(\d+)/)?.[1] ?? '0');
    test.skip(total <= 24, 'need more than one page of targets for this case');

    const pageLabel = page.getByTestId('smallworld-page-label');
    const pagePrev = page.getByTestId('smallworld-page-prev');
    const pageNext = page.getByTestId('smallworld-page-next');

    await expect(pageLabel).toHaveCount(2);
    await expect(pageLabel.first()).toHaveText(/Page 1 of \d+/);
    await expect(pagePrev.first()).toBeDisabled();
    await expect(pageNext.first()).toBeEnabled();
    await expect(page.getByTestId('smallworld-card')).toHaveCount(24);

    await pageNext.first().click();
    await expect(pageLabel.first()).toHaveText(/Page 2 of \d+/);
    await expect(pageLabel.last()).toHaveText(/Page 2 of \d+/);
    await expect(pagePrev.first()).toBeEnabled();
    await expect(page.getByTestId('smallworld-card').first()).toBeVisible();
  });
});
