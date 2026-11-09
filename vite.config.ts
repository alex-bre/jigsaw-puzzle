import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Relative base so the build also works inside the Capacitor WebView.
  base: './',
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 1500,
  },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
});
