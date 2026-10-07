import adapter from '@sveltejs/adapter-cloudflare';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { enhancedImages } from '@sveltejs/enhanced-img';
import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import process from 'node:process';
import { FileSystemIconLoader } from 'unplugin-icons/loaders';
import Icons from 'unplugin-icons/vite';
import mkcert from 'vite-plugin-mkcert';
import { defineConfig } from 'vitest/config';

const useMkcert = process.env.NODE_ENV === 'development';
const file = fileURLToPath(new URL('package.json', import.meta.url));
const json = readFileSync(file, 'utf8');
const pkg = JSON.parse(json);

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
      alias: {
        $components: './src/lib/components',
        $runes: './src/lib/runes',
        $static: './static',
      },
      experimental: { remoteFunctions: true },
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
