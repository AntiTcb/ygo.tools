import { definePageMetaTags } from 'svelte-meta-tags';
import type { PageLoad } from './$types';

export const load: PageLoad = () => ({
  ...definePageMetaTags({
    title: 'YGO Tools',
    description: 'A collection of tools for Yu-Gi-Oh! players to become the greatest duelists',
    keywords: ['yugioh', 'ygo', 'tools', 'Yu-Gi-Oh!'],
  }),
});
