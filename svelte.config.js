import adapter from '@sveltejs/adapter-cloudflare';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';

const file = fileURLToPath(new URL('package.json', import.meta.url));
const json = readFileSync(file, 'utf8');
const pkg = JSON.parse(json);

/** @type {import('@sveltejs/kit').Config} */
const config = {
  preprocess: vitePreprocess(),
  compilerOptions: {
    experimental: {
      async: true,
    },
  },
  kit: {
    // No remote bindings in local dev/CI (Workers AI would need Cloudflare credentials): /search falls
    // back to the REST API with a token from .env.local.
    adapter: adapter({ platformProxy: { remoteBindings: false } }),
    alias: {
      $components: './src/lib/components',
      $runes: './src/lib/runes',
      $static: './static',
    },
    experimental: {
      remoteFunctions: true,
    },
    version: {
      name: pkg.version,
      pollInterval: 60_000,
    },
  },
};

export default config;
