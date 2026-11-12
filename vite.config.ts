import { defineConfig } from 'vite';

// Relative base so the build works on GitHub Pages under /<repo>/ and locally.
export default defineConfig({
  base: './',
  build: {
    target: 'es2019',
    chunkSizeWarningLimit: 2000,
    assetsInlineLimit: 0,
  },
  server: { host: true },
});
