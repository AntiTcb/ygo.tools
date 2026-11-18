import { definePageMetaTags } from 'svelte-meta-tags';
import type { PageLoad } from './$types';

export const load: PageLoad = ({ data }) => ({
  ...data,
  ...definePageMetaTags({
    title: 'Gizmek Uka Helper',
    description: 'Find Gizmek Uka summons whose ATK equals their own DEF and share an Attribute, or the reverse — legal Attribute-matching targets.',
    keywords: ['yugioh', 'ygo', 'gizmek uka', 'attribute', 'atk', 'def', 'Yu-Gi-Oh!'],
  }),
});
