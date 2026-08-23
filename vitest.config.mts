import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
    alias: { 'server-only': new URL('./test/server-only.ts', import.meta.url).pathname },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./test/setup.ts'],
    include: ['test/**/*.test.{ts,tsx}'],
    coverage: { reporter: ['text', 'json-summary'] },
  },
});
