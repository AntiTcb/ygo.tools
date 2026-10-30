import adapter from '@sveltejs/adapter-cloudflare';
import { enhancedImages } from '@sveltejs/enhanced-img';
import { sveltekit } from '@sveltejs/kit/vite';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';
import tailwindcss from '@tailwindcss/vite';
import { readFileSync } from 'node:fs';
import process from 'node:process';
import { FileSystemIconLoader } from 'unplugin-icons/loaders';
import Icons from 'unplugin-icons/vite';
import mkcert from 'vite-plugin-mkcert';
import { defineConfig } from 'vitest/config';

const useMkcert = process.env.NODE_ENV === 'development';
const pkg = JSON.parse(readFileSync(new URL('package.json', import.meta.url), 'utf8'));

export default defineConfig({
  optimizeDeps: {
    entries: ['src/**/*.svelte'],
    // /event-map loads these with dynamic import(); pre-bundle them so the dev server
    // doesn't discover them mid-session and force a reload (flaky E2E runs).
    include: ['mapbox-gl', 'fullcalendar', 'fullcalendar/daygrid', 'fullcalendar/list', 'fullcalendar/themes/classic', 'temporal-polyfill/global'],
  },
  plugins: [
    tailwindcss(),
    enhancedImages(),
    sveltekit({
      preprocess: vitePreprocess(),
      compilerOptions: { experimental: { async: true } },
      adapter: adapter(),
      experimental: { remoteFunctions: true },
      // Poll every minute (Kit 3 defaults to an hour) so AppUpdateNotifier shows its toast soon after a deploy.
      version: { name: pkg.version, pollInterval: 60_000 },
    }),
    useMkcert ? mkcert() : null,
    Icons({
      compiler: 'svelte',
      autoInstall: true,
      customCollections: {
        custom: FileSystemIconLoader('src/lib/assets/images/icons'),
      },
    }),
  ],
  test: {
    include: ['src/**/*.{test,spec}.{js,ts}'],
  },
});
