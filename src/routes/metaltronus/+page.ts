import { definePageMetaTags } from 'svelte-meta-tags';
import type { PageLoad } from './$types';

export const load: PageLoad = ({ data }) => ({
  ...data,
  ...definePageMetaTags({
    title: 'Metaltronus Helper',
    description: 'Find legal Metaltronus partners: monsters that share two or more of Type, Attribute, and ATK — as summons or as targets.',
    keywords: ['yugioh', 'ygo', 'metaltronus', 'type', 'attribute', 'atk', 'Yu-Gi-Oh!'],
  }),
});
