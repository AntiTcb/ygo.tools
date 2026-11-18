import { definePageMetaTags } from 'svelte-meta-tags';
import type { PageLoad } from './$types';

export const load: PageLoad = () => ({
  ...definePageMetaTags({
    title: 'Yu-Gi-Oh! Damage Calculation Calculator',
    description: 'A calculator for the various effects that modify how battle damage is applied to players during Damage Calculation.',
    keywords: ['Yu-Gi-Oh!', 'ygo', 'yugioh', 'damage calculation', 'damage calc', 'dmg step', 'damage step', 'dmg calc'],
  }),
});
