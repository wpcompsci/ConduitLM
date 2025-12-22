module.exports = {
  root: true,
  env: {
    browser: true,
    es2022: true,
    webextensions: true,
  },
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
  },
  ignorePatterns: [
    'dist/',
    'web-ext-artifacts/',
    'node_modules/',
    'src/lib/',
    '**/*.min.js',
  ],
  globals: {
    importScripts: 'readonly',
  },
  rules: {
    'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    'no-undef': 'error',
    'no-console': 'off',
  },
};
