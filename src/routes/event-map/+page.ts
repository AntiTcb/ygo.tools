import { REGIONS } from '#lib/event-map/types.js';
import { definePageMetaTags } from 'svelte-meta-tags';
import type { PageLoad } from './$types';

export const load: PageLoad = ({ data }) => ({
  ...data,
  ...definePageMetaTags({
    title: `Event Map – ${REGIONS[data.region].label}`,
    description:
      'Find Yu-Gi-Oh! Regionals, OTS Championships and YCS events weekend by weekend: calendar, map, driving directions and calendar export.',
    keywords: ['yugioh', 'ygo', 'regional', 'ots championship', 'ycs', 'events', 'tournaments', 'map', 'calendar'],
  }),
});
