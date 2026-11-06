import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: {
    environment: 'node', include: ['tests/**/*.test.mjs'], globals: false,
    isolate: true, pool: 'forks', fileParallelism: false, maxWorkers: 1,
    allowOnly: false, passWithNoTests: false,
    setupFiles: ['./tests/deny-network.mjs'],
  },
});
