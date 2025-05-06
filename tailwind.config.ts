import forms from '@tailwindcss/forms';
import typography from '@tailwindcss/typography';
import { join } from 'path';

export default {
  content: ['./src/**/*.{html,js,svelte,ts}', join(require.resolve('@skeletonlabs/skeleton-svelte'), '../**/*.{html,js,svelte,ts}')],
  theme: {
    extend: {},
  },
  plugins: [forms, typography],
};
