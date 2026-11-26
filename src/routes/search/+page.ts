import { definePageMetaTags } from 'svelte-meta-tags';
import type { PageLoad } from './$types';

export const load: PageLoad = ({ data }) => ({
  ...data,
  ...definePageMetaTags({
    title: 'Effect Search',
    description: 'Search Yu-Gi-Oh! cards by what their effects do, in plain English: “cards that can Special Summon Toadally Awesome from the GY”.',
    keywords: ['yugioh', 'ygo', 'effect search', 'card search', 'natural language', 'Yu-Gi-Oh!'],
  }),
});
