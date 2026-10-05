import { runScrape, type ScrapeEnv } from '../lib/server/event-map/scrape/run';

/** Bindings and vars from wrangler.event-scraper.jsonc. */
interface ScraperEnv extends ScrapeEnv {
  /** Bearer token for the manual POST /scrape trigger. */
  SCRAPE_TOKEN?: string;
}

/**
 * Cron Worker for /event-map: scrapes yugioh-card.com every 6 hours, geocodes new
 * venues and writes to the ygo-event-map D1 database the site reads from. It is a
 * separate Worker because adapter-cloudflare owns the site Worker's entrypoint.
 *
 * Also exposes `POST /scrape` (Bearer SCRAPE_TOKEN) for manual runs. Pass
 * `?geocodeOnly=1` to only work through the venue geocoding backlog.
 */
export default {
  async scheduled(_controller: unknown, env: ScraperEnv): Promise<void> {
    const summary = await runScrape(env);
    // oxlint-disable-next-line no-console -- Worker logs are how cron runs are observed.
    console.log('scrape complete', summary);
  },

  async fetch(request: Request, env: ScraperEnv): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname !== '/scrape') return new Response('Not found', { status: 404 });
    if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 });
    if (!(await isAuthorized(request.headers.get('authorization'), env.SCRAPE_TOKEN))) {
      return new Response('Unauthorized', { status: 401 });
    }

    const summary = await runScrape(env, { geocodeOnly: url.searchParams.has('geocodeOnly') });
    return Response.json(summary);
  },
};

const isAuthorized = async (header: string | null, token: string | undefined): Promise<boolean> => {
  const given = header?.replace(/^Bearer\s+/i, '') ?? '';
  if (!token || !given) return false;
  // Compare fixed-length digests so the comparison time doesn't leak the token.
  const enc = new TextEncoder();
  const [a, b] = await Promise.all([crypto.subtle.digest('SHA-256', enc.encode(given)), crypto.subtle.digest('SHA-256', enc.encode(token))]);
  const x = new Uint8Array(a);
  const y = new Uint8Array(b);
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return diff === 0;
};
