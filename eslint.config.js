import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';
import globals from 'globals';

export default tseslint.config(
  { ignores: ['dist', 'android', 'ios', 'node_modules'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  prettier,
  {
    languageOptions: { globals: { ...globals.browser } },
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
  {
    // The pure game core must stay free of rendering/DOM dependencies.
    files: ['src/game/core/**/*.ts'],
    rules: {
      'no-restricted-imports': ['error', { patterns: ['pixi.js', '*/render/*', '*/ui/*'] }],
    },
  },
);
