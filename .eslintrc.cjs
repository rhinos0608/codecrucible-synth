// Legacy ESLintRC - migrating to flat config (eslint.config.js)
// This file is kept for compatibility during migration
module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  plugins: [
    '@typescript-eslint',
  ],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
  ],
  env: {
    node: true,
    jest: true,
  },
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
  },
  rules: {
    // 2025 Best Practices - Stricter Rules
    '@typescript-eslint/no-explicit-any': 'error', // Upgraded from warn
    '@typescript-eslint/no-unused-vars': ['error', { 
      'vars': 'all',
      'args': 'after-used',
      'ignoreRestSiblings': false,
      'argsIgnorePattern': '^_',
      'varsIgnorePattern': '^_'
    }],
    '@typescript-eslint/no-non-null-assertion': 'error', // Upgraded from warn
    '@typescript-eslint/prefer-nullish-coalescing': 'error',
    '@typescript-eslint/prefer-optional-chain': 'error',
    '@typescript-eslint/no-floating-promises': 'error',
    '@typescript-eslint/no-misused-promises': 'error',
    
    // Security & Best Practices
    'no-eval': 'error',
    'no-implied-eval': 'error',
    'no-new-func': 'error',
    'no-script-url': 'error',
    
    // Modern JavaScript
    'prefer-const': 'error',
    'no-var': 'error',
    'prefer-arrow-callback': 'error',
    'prefer-template': 'error',
    
    // Code quality
    'no-console': 'warn', // Keep as warn for CLI app
    'no-debugger': 'error',
    'no-alert': 'error',
  },
  ignorePatterns: [
    'dist/',
    'node_modules/',
    'coverage/',
    'build/',
    'temp-dist/',
    '*.d.ts'
  ]
};