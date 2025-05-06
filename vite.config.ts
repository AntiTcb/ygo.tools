import { enhancedImages } from '@sveltejs/enhanced-img';
import { sveltekit } from '@sveltejs/kit/vite';
import process from 'node:process';
import { FileSystemIconLoader } from 'unplugin-icons/loaders';
import Icons from 'unplugin-icons/vite';
import mkcert from 'vite-plugin-mkcert';
import { defineConfig } from 'vitest/config';

const useMkcert = process.env.NODE_ENV === 'development';

export default defineConfig({
  optimizeDeps: {
    entries: ['src/**/*.svelte'],
  },
  plugins: [
    enhancedImages(),
    sveltekit(),
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
