import { expect, test } from '@playwright/test';

/**
 * /event-map renders from the local D1 database, which may be empty (e.g. in CI),
 * so these checks don't depend on any particular events existing.
 */
test.describe('/event-map', () => {
  test('renders the calendar and map shell', async ({ page }) => {
    await page.goto('/event-map', { waitUntil: 'networkidle' });
    await expect(page.getByRole('heading', { name: 'Event Map' })).toBeVisible();
    await expect(page.getByTestId('event-map-region-na')).toBeVisible();
    await expect(page.getByTestId('event-map-subscribe')).toBeVisible();
    await expect(page.getByTestId('event-map-count')).not.toHaveText(/Loading/, { timeout: 15_000 });
  });

  test('switches region via the region query param', async ({ page }) => {
    await page.goto('/event-map', { waitUntil: 'networkidle' });
    await page.getByTestId('event-map-region-latam').click();
    await expect(page).toHaveURL(/\/event-map\?region=latam$/);
    await expect(page).toHaveTitle(/Latin America/);

    await page.getByTestId('event-map-region-na').click();
    await expect(page).toHaveURL(/\/event-map$/);
    await expect(page).toHaveTitle(/North America/);
  });

  test('serves a subscribable iCalendar feed', async ({ request }) => {
    const res = await request.get('/event-map/calendar.ics?region=latam');
    expect(res.status()).toBe(200);
    expect(res.headers()['content-type']).toContain('text/calendar');
    expect(await res.text()).toContain('BEGIN:VCALENDAR');
  });
});
