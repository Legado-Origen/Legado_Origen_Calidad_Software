import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    globalSetup: ['tests/setup/global-setup.ts'],
    fileParallelism: false,
    env: {
      DB_HOST: process.env.DB_HOST ?? 'localhost',
      DB_PORT: process.env.DB_PORT ?? '5433',
      DB_NAME: process.env.DB_NAME ?? 'legado_origen_test',
      DB_USER: process.env.DB_USER ?? 'postgres',
      DB_PASSWORD: process.env.DB_PASSWORD ?? 'postgres',
    },
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/server.ts'],
      reporter: ['text', ['lcov', { projectRoot: '..' }]],
      thresholds: {
        lines: 90,
        functions: 90,
        branches: 90,
        statements: 90,
      },
    },
  },
});