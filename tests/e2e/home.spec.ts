import { expect, test } from '@playwright/test';

test.describe('home page', () => {
  test('groups tools and card helpers, sorted alphabetically, with helper card art', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });

    await expect(page.getByTestId('home-tools').getByRole('heading', { name: 'Tools', level: 2 })).toBeVisible();
    await expect(page.getByTestId('home-card-helpers').getByRole('heading', { name: 'Card Helpers', level: 2 })).toBeVisible();

    const toolTitles = page.getByTestId('home-tool-tile').locator('h5');
    await expect(toolTitles).toHaveCount(2);
    await expect(toolTitles.nth(0)).toHaveText('Card Database');
    await expect(toolTitles.nth(1)).toHaveText('Damage Calculation Calculator');

    const helperTiles = page.getByTestId('home-helper-tile');
    await expect(helperTiles).toHaveCount(3);
    await expect(helperTiles.nth(0)).toHaveAttribute('href', '/gizmekuka');
    await expect(helperTiles.nth(1)).toHaveAttribute('href', '/metaltronus');
    await expect(helperTiles.nth(2)).toHaveAttribute('href', '/smallworld');
    await expect(helperTiles.nth(0).locator('h5')).toHaveText('Gizmek Uka Helper');
    await expect(helperTiles.nth(1).locator('h5')).toHaveText('Metaltronus Helper');
    await expect(helperTiles.nth(2).locator('h5')).toHaveText('Small World Helper');

    const artSrc = /^(https?:)?\/\//;
    const helperArt = page.getByTestId('home-helper-art');
    await expect(helperArt).toHaveCount(3, { timeout: 20_000 });
    await expect(helperArt.nth(0)).toHaveAttribute('src', artSrc, { timeout: 20_000 });
    await expect(helperArt.nth(1)).toHaveAttribute('src', artSrc, { timeout: 20_000 });
    await expect(helperArt.nth(2)).toHaveAttribute('src', artSrc, { timeout: 20_000 });
    await expect(helperArt.nth(0)).toHaveAttribute('alt', 'Gizmek Uka');
    await expect(helperArt.nth(1)).toHaveAttribute('alt', 'Metaltronus');
    await expect(helperArt.nth(2)).toHaveAttribute('alt', 'Small World');
  });

  test('helper tiles sit in equal-width columns on desktop', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/', { waitUntil: 'networkidle' });

    const boxes = await page.getByTestId('home-helper-tile').evaluateAll((tiles) =>
      tiles.map((tile) => {
        const rect = tile.getBoundingClientRect();
        return { width: rect.width, height: rect.height, top: rect.top };
      }),
    );

    expect(boxes).toHaveLength(3);
    expect(Math.abs((boxes[0]?.width ?? 0) - (boxes[1]?.width ?? 0))).toBeLessThan(2);
    expect(Math.abs((boxes[0]?.width ?? 0) - (boxes[2]?.width ?? 0))).toBeLessThan(2);
    expect(Math.abs((boxes[0]?.height ?? 0) - (boxes[1]?.height ?? 0))).toBeLessThan(2);
    expect(Math.abs((boxes[0]?.top ?? 0) - (boxes[1]?.top ?? 0))).toBeLessThan(2);
  });
});
