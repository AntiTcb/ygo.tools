import { buildIcs, eventTitle } from '#lib/event-map/calendar-links.js';
import { eventMapDb } from '#lib/server/event-map/db.js';
import { getEvent } from '#lib/server/event-map/events.js';
import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

/** Single-event .ics download (Apple Calendar and anything else that imports iCalendar files). */
export const GET: RequestHandler = async ({ params, platform }) => {
  const event = await getEvent(eventMapDb(platform), params.id);
  if (!event) error(404, 'Event not found');

  const filename = `${event.host.replace(/[^\w-]+/g, '-')}-${event.date}.ics`;
  return new Response(buildIcs([event], { name: eventTitle(event) }), {
    headers: {
      'content-type': 'text/calendar; charset=utf-8',
      'content-disposition': `attachment; filename="${filename}"`,
      'cache-control': 'public, max-age=1800',
    },
  });
};
