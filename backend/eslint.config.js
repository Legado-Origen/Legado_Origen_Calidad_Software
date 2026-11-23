// @ts-check
import js from '@eslint/js';
import { defineConfig } from 'eslint/config';
import tseslint from 'typescript-eslint';
import pluginSecurity from 'eslint-plugin-security';

export default defineConfig(
  { ignores: ['coverage/', 'dist/'] },
  {
    files: ['**/*.{js,ts}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      pluginSecurity.configs.recommended,
    ],
    rules: {
      complexity: ['error', 10],
    },
  },
);
