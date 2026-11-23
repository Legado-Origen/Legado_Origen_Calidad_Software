// @ts-check
import js from '@eslint/js';
import { defineConfig } from 'eslint/config';
import tseslint from 'typescript-eslint';
import pluginSecurity from 'eslint-plugin-security';
import reactHooks from 'eslint-plugin-react-hooks';

export default defineConfig(
  { ignores: ['coverage/', 'dist/'] },
  {
    files: ['**/*.{js,ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      pluginSecurity.configs.recommended,
      reactHooks.configs.flat.recommended,
    ],
    rules: {
      complexity: ['error', 10],
    },
  },
);
