import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['dist/**', 'node_modules/**', 'eslint.config.mjs'],
  },

  js.configs.recommended,

  ...tseslint.configs.recommendedTypeChecked.map((config) => ({
    ...config,
    languageOptions: {
      ...config.languageOptions,
      parserOptions: {
        project: './tsconfig.eslint.json',
        tsconfigRootDir: import.meta.dirname,
      },
    },
  })),

  {
    rules: {
      '@typescript-eslint/no-floating-promises': 'error',
    },
  },
);
