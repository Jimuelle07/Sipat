import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['app/**/*.test.ts', 'plugins/**/*.test.ts'],
    environment: 'node',
  },
});
