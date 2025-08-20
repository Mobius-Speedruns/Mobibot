import eslint from '@eslint/js';
import tselint from 'typescript-eslint';
import eslintPluginPrettierRecommend from 'eslint-plugin-prettier/recommended';
import globals from 'globals';

export default tselint.config(
  {
    ignores: ['eslint.config.mjs'],
  },
  eslint.configs.recommended,
  ...tselint.configs.recommendedTypeChecked,
  eslintPluginPrettierRecommend,
  {
    languageOptions: {
      globals: {
        ...globals.node,
      },
      ecmaVersion: 5,
      sourceType: 'module',
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-floating-promises': 'warn',
      '@typescript-eslint/no-unsafe-argument': 'warn',
    },
  },
);
