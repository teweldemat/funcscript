import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/src-port/**/*.test.ts'],
    environment: 'node'
  }
});
