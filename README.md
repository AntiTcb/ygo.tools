# create-svelte

Everything you need to build a Svelte project, powered by [`create-svelte`](https://github.com/sveltejs/kit/tree/main/packages/create-svelte).

## Creating a project

If you're seeing this, you've probably already done this step. Congrats!

```bash
# create a new project in the current directory
npm create svelte@latest

# create a new project in my-app
npm create svelte@latest my-app
```

## Developing

Once you've created a project and installed dependencies with `npm install` (or `pnpm install` or `yarn`), start a development server:

```bash
npm run dev

# or start the server and open the app in a new browser tab
npm run dev -- --open
```

## Building

To create a production version of your app:

```bash
npm run build
```

You can preview the production build with `npm run preview`.

> To deploy your app, you may need to install an [adapter](https://kit.svelte.dev/docs/adapters) for your target environment.

## Event Map (`/event-map`)

Yu-Gi-Oh! Regionals, OTS Championships and YCS events on a calendar (FullCalendar) and map (Mapbox), with filters, driving directions and calendar export. The region is a query param: `/event-map` (North America) or `/event-map?region=latam`.

Data lives in a **Cloudflare D1** database (`ygo-event-map`, binding `EVENT_MAP_DB` in `wrangler.jsonc`), not Supabase. A separate cron Worker (`wrangler.event-scraper.jsonc`, entry `src/scraper/event-map.ts`) scrapes yugioh-card.com every 6 hours and writes to it. It's separate because `adapter-cloudflare` owns the site Worker's entrypoint.

| Path                            | What                                                          |
| ------------------------------- | ------------------------------------------------------------- |
| `src/routes/event-map/`         | Page, `calendar.ics` feed, `events/[id].ics` downloads        |
| `src/lib/components/event-map/` | Calendar, map, filters (Skeleton components) and page styles  |
| `src/lib/event-map/`            | Shared types, dates, filters, time zones, calendar export     |
| `src/lib/server/event-map/`     | D1 queries, scraper (`scrape/`), venue geocoding (`geocode/`) |
| `migrations/event-map/`         | D1 schema                                                     |

**Geocoding** (venues are stored, so only providers that allow storing results are used): source-page coordinates, then the US Census geocoder (free, US), then Nominatim/OpenStreetMap (free, rate-limited), then Mapbox permanent geocoding as a paid last resort (each venue at most once). The page credits OpenStreetMap as its ODbL license requires.

### Local development

```bash
cp .env.example .env.local        # add PUBLIC_MAPBOX_TOKEN (public pk.* token)
pnpm event-map:migrate:local
pnpm dev                          # https://localhost:5173/event-map
pnpm event-map:scraper            # scraper Worker on :8787 (shares local D1 with the site)
```

Load data with `curl -X POST http://localhost:8787/scrape -H "authorization: Bearer <SCRAPE_TOKEN>"` (put `MAPBOX_SECRET_TOKEN` and `SCRAPE_TOKEN` in `.dev.vars`), or `curl http://localhost:8787/__scheduled`.

### Deploy

```bash
pnpm event-map:migrate:remote
pnpm exec wrangler secret put PUBLIC_MAPBOX_TOKEN --env production
pnpm exec wrangler secret put MAPBOX_SECRET_TOKEN -c wrangler.event-scraper.jsonc
pnpm exec wrangler secret put SCRAPE_TOKEN -c wrangler.event-scraper.jsonc
pnpm cf:deploy                    # site, as usual
pnpm event-map:scraper:deploy     # cron scraper
```

Set `NOMINATIM_CONTACT` (an email or URL) in `wrangler.event-scraper.jsonc` before deploying the scraper, as Nominatim's usage policy asks. `pnpm event-map:seed-venues` copies already-located venues from local D1 to production, so they aren't geocoded (and billed) again.
