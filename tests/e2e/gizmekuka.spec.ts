import { expect, test, type Page } from '@playwright/test';

const gotoGizmekUka = async (page: Page) => {
  await page.goto('/gizmekuka', { waitUntil: 'networkidle' });
  await expect(page.getByTestId('gizmekuka-monster-input')).toBeVisible();
};

const pickFirstSuggestion = async (page: Page, testIdPrefix: string, query: string) => {
  const input = page.getByTestId(`${testIdPrefix}-input`);
  await input.fill(query);
  const suggestion = page.getByTestId(`${testIdPrefix}-suggestion`).first();
  await expect(suggestion).toBeVisible({ timeout: 15_000 });
  await suggestion.click();
  await expect(page.getByTestId(`${testIdPrefix}-selected`)).toBeVisible();
};

const pickExactSuggestion = async (page: Page, testIdPrefix: string, name: string) => {
  const input = page.getByTestId(`${testIdPrefix}-input`);
  await input.fill(name);
  const suggestion = page.getByTestId(`${testIdPrefix}-suggestion`).getByText(name, { exact: true });
  await expect(suggestion).toBeVisible({ timeout: 15_000 });
  await suggestion.click();
  await expect(page.getByTestId(`${testIdPrefix}-selected`)).toContainText(name);
};

test.describe('/gizmekuka helper', () => {
  test('home page links to the Gizmek Uka helper', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });
    await page.locator('a[href="/gizmekuka"]').click();
    await expect(page).toHaveURL(/\/gizmekuka/);
    await expect(page.getByTestId('gizmekuka-monster-input')).toBeVisible();
  });

  test('monster search includes Extra Deck Fusion/Synchro/Xyz/Link monsters', async ({ page }) => {
    await gotoGizmekUka(page);

    const extraDeckNames = ['Accesscode Talker', 'Stardust Dragon', 'Number 39: Utopia', 'Blue-Eyes Ultimate Dragon'];
    const input = page.getByTestId('gizmekuka-monster-input');

    for (const name of extraDeckNames) {
      await input.fill(name);
      await expect(page.getByTestId('gizmekuka-monster-suggestion').getByText(name, { exact: true })).toBeVisible();
    }
  });

  test('monster search excludes Token monsters', async ({ page }) => {
    await gotoGizmekUka(page);

    const input = page.getByTestId('gizmekuka-monster-input');
    await input.fill('Sheep Token');
    const exactName = /^Sheep Token$/;
    await expect(page.getByTestId('gizmekuka-monster-suggestion').filter({ hasText: exactName })).toHaveCount(0);
  });

  test('results stay hidden until a monster is selected', async ({ page }) => {
    await gotoGizmekUka(page);
    await expect(page.getByTestId('gizmekuka-summons-count')).toHaveCount(0);
    await expect(page.getByTestId('gizmekuka-targets-count')).toHaveCount(0);
  });

  test('selecting an opponent monster lists ATK=DEF same-Attribute summons and hides reverse targets', async ({ page }) => {
    await gotoGizmekUka(page);
    await expect(page.getByText(/Summons are legal if the selected card is the opponent's monster/i)).toBeVisible();

    await pickFirstSuggestion(page, 'gizmekuka-monster', 'Dark Magician');
    await expect(page.getByTestId('gizmekuka-summons-count')).toHaveText(/\d+ summons/);
    await expect(page.getByTestId('gizmekuka-targets-unavailable')).toBeVisible();
    await expect(page.getByTestId('gizmekuka-targets-count')).toHaveCount(0);

    const countText = await page.getByTestId('gizmekuka-summons-count').textContent();
    const n = Number(countText?.match(/^(\d+)/)?.[1] ?? '0');
    expect(n).toBeGreaterThan(0);

    await expect(page.getByTestId('gizmekuka-summon-card').first()).toBeVisible();
    await expect(page.getByTestId('gizmekuka-summon-card-name').first()).not.toBeEmpty();
    await expect(page.getByTestId('gizmekuka-summon-card-chip').first()).toBeVisible();
  });

  test('selecting an ATK=DEF monster lists same-Attribute targets including Extra Deck', async ({ page }) => {
    await gotoGizmekUka(page);
    await pickExactSuggestion(page, 'gizmekuka-monster', 'Relinquished');

    await expect(page.getByTestId('gizmekuka-summons-count')).toHaveText(/\d+ summons/);
    await expect(page.getByTestId('gizmekuka-targets-count')).toHaveText(/\d+ targets/);
    const summonCount = Number((await page.getByTestId('gizmekuka-summons-count').textContent())?.match(/^(\d+)/)?.[1] ?? '0');
    const targetCount = Number((await page.getByTestId('gizmekuka-targets-count').textContent())?.match(/^(\d+)/)?.[1] ?? '0');
    expect(summonCount).toBeGreaterThan(0);
    expect(targetCount).toBeGreaterThan(summonCount);

    await page.getByTestId('gizmekuka-result-filter').fill('Accesscode Talker');
    await expect(page.getByTestId('gizmekuka-target-card').getByText('Accesscode Talker', { exact: true })).toBeVisible();
    await expect(page.getByTestId('gizmekuka-summon-card').getByText('Accesscode Talker', { exact: true })).toHaveCount(0);
  });

  test('clearing the selected monster hides results', async ({ page }) => {
    await gotoGizmekUka(page);
    await pickFirstSuggestion(page, 'gizmekuka-monster', 'Ash Blossom');
    await expect(page.getByTestId('gizmekuka-summons-count')).toBeVisible();

    await page.getByTestId('gizmekuka-monster-clear').click();
    await expect(page.getByTestId('gizmekuka-monster-selected')).toHaveCount(0);
    await expect(page.getByTestId('gizmekuka-summons-count')).toHaveCount(0);
  });

  test('name filter narrows summons and shows of-total', async ({ page }) => {
    await gotoGizmekUka(page);
    await pickFirstSuggestion(page, 'gizmekuka-monster', 'Dark Magician');

    const totalText = await page.getByTestId('gizmekuka-summons-count').textContent();
    const total = Number(totalText?.match(/^(\d+)/)?.[1] ?? '0');
    expect(total).toBeGreaterThan(0);

    const firstName = (await page.getByTestId('gizmekuka-summon-card-name').first().textContent())?.trim() ?? '';
    expect(firstName.length).toBeGreaterThan(0);
    const needle = firstName.slice(0, Math.min(6, firstName.length));

    await page.getByTestId('gizmekuka-result-filter').fill(needle);
    await expect(page.getByTestId('gizmekuka-summons-count')).toHaveText(new RegExp(`^\\d+ summons \\(of ${total}\\)$`));

    const filteredText = await page.getByTestId('gizmekuka-summons-count').textContent();
    const filtered = Number(filteredText?.match(/^(\d+)/)?.[1] ?? '0');
    expect(filtered).toBeGreaterThan(0);
    expect(filtered).toBeLessThanOrEqual(total);

    await expect(page.getByTestId('gizmekuka-summon-card-name').first()).toContainText(new RegExp(needle, 'i'));
  });

  test('paginates summons 24 per page when there are enough results', async ({ page }) => {
    await gotoGizmekUka(page);
    await pickFirstSuggestion(page, 'gizmekuka-monster', 'Dark Magician');

    const totalText = await page.getByTestId('gizmekuka-summons-count').textContent();
    const total = Number(totalText?.match(/^(\d+)/)?.[1] ?? '0');
    test.skip(total <= 24, 'need more than one page of summons for this case');

    const pageLabel = page.getByTestId('gizmekuka-summon-page-label');
    const pagePrev = page.getByTestId('gizmekuka-summon-page-prev');
    const pageNext = page.getByTestId('gizmekuka-summon-page-next');

    await expect(pageLabel).toHaveCount(2);
    await expect(pageLabel.first()).toHaveText(/Page 1 of \d+/);
    await expect(pagePrev.first()).toBeDisabled();
    await expect(pageNext.first()).toBeEnabled();
    await expect(page.getByTestId('gizmekuka-summon-card')).toHaveCount(24);

    await pageNext.first().click();
    await expect(pageLabel.first()).toHaveText(/Page 2 of \d+/);
    await expect(pageLabel.last()).toHaveText(/Page 2 of \d+/);
    await expect(pagePrev.first()).toBeEnabled();
    await expect(page.getByTestId('gizmekuka-summon-card').first()).toBeVisible();
  });

  test('serializes picker state into the URL and restores it on load', async ({ page }) => {
    await gotoGizmekUka(page);
    await pickFirstSuggestion(page, 'gizmekuka-monster', 'Dark Magician');

    const monsterName = (await page.getByTestId('gizmekuka-monster-selected').locator('.font-medium').textContent())?.trim() ?? '';
    expect(monsterName.length).toBeGreaterThan(0);

    await expect.poll(() => page.url()).toContain('_data=');

    const firstName = (await page.getByTestId('gizmekuka-summon-card-name').first().textContent())?.trim() ?? '';
    expect(firstName.length).toBeGreaterThan(0);
    const needle = firstName.slice(0, Math.min(6, firstName.length));

    const urlBeforeFilter = page.url();
    await page.getByTestId('gizmekuka-result-filter').fill(needle);
    await expect.poll(() => page.url()).not.toBe(urlBeforeFilter);

    const sharedUrl = page.url();
    expect(sharedUrl).toContain('_data=');

    await page.goto('/gizmekuka', { waitUntil: 'networkidle' });
    await expect(page.getByTestId('gizmekuka-monster-selected')).toHaveCount(0);
    await expect(page.getByTestId('gizmekuka-summons-count')).toHaveCount(0);

    await page.goto(sharedUrl, { waitUntil: 'networkidle' });
    await expect(page.getByTestId('gizmekuka-monster-selected')).toContainText(monsterName);
    await expect(page.getByTestId('gizmekuka-result-filter')).toHaveValue(needle);
    await expect(page.getByTestId('gizmekuka-summons-count')).toBeVisible();
    await expect(page.getByTestId('gizmekuka-summon-card-name').first()).toContainText(new RegExp(needle, 'i'));

    const artSrc = /^(https?:)?\/\//;
    const resultArt = page.getByTestId('gizmekuka-summon-card').first().locator('img');
    await expect(resultArt).toHaveAttribute('src', artSrc, { timeout: 20_000 });
    const selectedArt = page.getByTestId('gizmekuka-monster-selected').locator('img');
    await expect(selectedArt).toHaveAttribute('src', artSrc, { timeout: 20_000 });
  });
});
