// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*', 'node_modules/*', '.expo/*'],
  },
  {
    // `jest.mock` has to sit above the imports of the module it replaces, and
    // its factory may only use `require` (the factory is hoisted above every
    // import binding). Both rules are right everywhere else.
    files: ['**/__tests__/**/*.{ts,tsx}', 'jest.setup.tsx'],
    rules: {
      'import/first': 'off',
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
]);
