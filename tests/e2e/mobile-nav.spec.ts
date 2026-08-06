import { expect, test, type Page } from '@playwright/test';

const gotoMobileNavPage = async (page: Page, path = '/smallworld') => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(path, { waitUntil: 'networkidle' });
  await expect(page.getByTestId('mobile-nav')).toBeVisible();
};

test.describe('mobile footer navigation', () => {
  test('uses a compact chip row with horizontal overflow', async ({ page }) => {
    await gotoMobileNavPage(page);

    const scroller = page.getByTestId('mobile-nav-scroller');
    const menu = page.getByTestId('mobile-nav-menu');

    const metrics = await scroller.evaluate((el) => {
      const root = el.closest('[data-testid="mobile-nav"]');
      return {
        clientHeight: el.clientHeight,
        clientWidth: el.clientWidth,
        scrollWidth: el.scrollWidth,
        rootOverflowX: root ? getComputedStyle(root).overflowX : null,
      };
    });

    expect(metrics.scrollWidth).toBeGreaterThan(metrics.clientWidth);
    expect(metrics.clientHeight).toBeLessThan(48);
    expect(metrics.rootOverflowX).toBe('visible');

    const tileBoxes = await menu.locator('[data-part="trigger-anchor"]').evaluateAll((tiles) =>
      tiles.map((tile) => {
        const rect = tile.getBoundingClientRect();
        return { top: rect.top, height: rect.height };
      }),
    );
    expect(tileBoxes.length).toBeGreaterThanOrEqual(4);

    const firstTop = tileBoxes[0]?.top ?? 0;
    for (const box of tileBoxes) {
      expect(Math.abs(box.top - firstTop)).toBeLessThan(2);
      expect(box.height).toBeLessThan(40);
    }
  });

  test('drag slides the chip list and toggles edge fades', async ({ page }) => {
    await gotoMobileNavPage(page);

    const scroller = page.getByTestId('mobile-nav-scroller');
    // Active-chip auto-centering may leave the bar mid-scroll; reset to the start.
    await scroller.evaluate((el) => {
      el.scrollLeft = 0;
      el.dispatchEvent(new Event('scroll'));
    });
    await expect(page.getByTestId('mobile-nav-more-right')).toBeVisible();
    await expect(page.getByTestId('mobile-nav-more-left')).toHaveCount(0);

    const box = await scroller.boundingBox();
    expect(box).toBeTruthy();
    if (!box) return;

    await page.mouse.move(box.x + box.width - 30, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + 30, box.y + box.height / 2, { steps: 12 });
    await page.mouse.up();

    await expect.poll(async () => scroller.evaluate((el) => el.scrollLeft)).toBeGreaterThan(0);
    await expect(page.getByTestId('mobile-nav-more-left')).toBeVisible();

    await scroller.evaluate((el) => {
      el.scrollLeft = el.scrollWidth;
      el.dispatchEvent(new Event('scroll'));
    });
    await expect(page.getByTestId('mobile-nav-more-left')).toBeVisible();
    await expect(page.getByTestId('mobile-nav-more-right')).toHaveCount(0);
  });

  test('marks the current page active in the mobile nav', async ({ page }) => {
    await gotoMobileNavPage(page, '/database');
    const active = page.getByTestId('mobile-nav').locator('[aria-current="page"]');
    await expect(active).toHaveAttribute('href', '/database');
    await expect(active).toHaveClass(/nav-active/);
  });
});

test.describe('desktop rail navigation', () => {
  test('marks the current page active in the rail', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/smallworld', { waitUntil: 'networkidle' });
    await expect(page.getByTestId('desktop-nav')).toBeVisible();

    const active = page.getByTestId('desktop-nav').locator('[aria-current="page"]');
    await expect(active).toHaveAttribute('href', '/smallworld');
    await expect(active).toHaveClass(/nav-active/);
  });
});
