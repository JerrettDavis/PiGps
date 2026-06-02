import { defineConfig } from 'vite';

export default defineConfig({
  // Use './' so assets resolve correctly whether served from the repo's
  // GitHub Pages project path (/PiGps/) or any other sub-path.
  base: './',
  build: {
    outDir: 'dist',
  },
});
