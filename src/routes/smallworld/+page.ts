import { definePageMetaTags } from 'svelte-meta-tags';
import type { PageLoad } from './$types';

export const load: PageLoad = ({ data }) => ({
  ...data,
  ...definePageMetaTags({
    title: 'Small World Helper',
    description: 'Resolve Yu-Gi-Oh! Small World bridges: pick a reveal monster and a one-property bridge to find legal add targets from your deck.',
    keywords: ['yugioh', 'ygo', 'small world', 'bridge', 'search', 'Yu-Gi-Oh!'],
  }),
});
