// 2025 ESLint Flat Config - Modern Best Practices
import eslint from '@eslint/js';
import tseslint from '@typescript-eslint/eslint-plugin';
import tsparser from '@typescript-eslint/parser';
import globals from 'globals';

export default [
  // Global ignores
  {
    ignores: [
      'dist/',
      'node_modules/',
      'coverage/',
      'build/',
      'temp-dist/',
      '**/*.d.ts',
      'archive/',
      'tests/__mocks__/'
    ]
  },

  // Base configuration for all files
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.node,
        ...globals.jest,
      }
    }
  },

  // JavaScript files
  {
    files: ['**/*.js', '**/*.mjs'],
    rules: {
      ...eslint.configs.recommended.rules,
      'prefer-const': 'error',
      'no-var': 'error',
      'prefer-arrow-callback': 'error',
      'prefer-template': 'error',
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-new-func': 'error',
      'no-script-url': 'error',
      'no-console': 'warn',
      'no-debugger': 'error',
      'no-alert': 'error',
    }
  },

  // TypeScript files - 2025 Enterprise Standards
  {
    files: ['**/*.ts'],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
        // Use a dedicated config so ESLint includes all src files without conflicting excludes
        project: './tsconfig.eslint.json',
      }
    },
    plugins: {
      '@typescript-eslint': tseslint
    },
    rules: {
      ...eslint.configs.recommended.rules,
      ...tseslint.configs.recommended.rules,
      
      // 2025 TypeScript Best Practices - Pragmatic Approach
      // Start with warnings to enable gradual improvement without blocking development
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': ['warn', { 
        'vars': 'all',
        'args': 'after-used',
        'ignoreRestSiblings': true,
        'argsIgnorePattern': '^_',
        'varsIgnorePattern': '^_'
      }],
      '@typescript-eslint/no-non-null-assertion': 'warn', // Downgraded from error
      // Disabled until strictNullChecks is enabled in tsconfig
      '@typescript-eslint/prefer-nullish-coalescing': 'off',
      '@typescript-eslint/prefer-optional-chain': 'warn',
      // Gradual migration for promise-safety rules - more lenient during development
      '@typescript-eslint/no-floating-promises': 'warn',
      '@typescript-eslint/no-misused-promises': 'warn',
      '@typescript-eslint/await-thenable': 'warn',
      '@typescript-eslint/no-for-in-array': 'warn',
      '@typescript-eslint/no-implied-eval': 'error', // Keep as error - security issue
      '@typescript-eslint/prefer-includes': 'warn',
      '@typescript-eslint/prefer-string-starts-ends-with': 'warn',
      '@typescript-eslint/promise-function-async': 'warn', // Downgraded from error
      '@typescript-eslint/require-array-sort-compare': 'warn',
      '@typescript-eslint/restrict-plus-operands': 'off', // Too strict for current codebase
      '@typescript-eslint/restrict-template-expressions': 'off', // Too strict for logging/debugging
      '@typescript-eslint/unbound-method': 'warn',
      
      // Security & Best Practices
      'no-eval': 'error',
      'no-implied-eval': 'off', // Handled by TypeScript version
      'no-new-func': 'error',
      'no-script-url': 'error',
      
      // Modern JavaScript/TypeScript
      'prefer-const': 'error',
      'no-var': 'error',
      'prefer-arrow-callback': 'error',
      'prefer-template': 'error',
      
      // Code Quality - CLI Application Specific
      'no-console': 'off', // Allow console statements in CLI application
      'no-debugger': 'error',
      'no-alert': 'error',
      
      // Disable base ESLint rules that are covered by TypeScript equivalents
      'no-unused-vars': 'off', // Handled by @typescript-eslint/no-unused-vars
      'no-redeclare': 'off',   // TypeScript handles this
      'no-undef': 'off',       // TypeScript handles this
    }
  },

  // Test files - More lenient rules for testing patterns
  {
    files: ['**/*.test.ts', '**/*.spec.ts', 'tests/**/*.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off', // Allow any in tests for mocking
      '@typescript-eslint/no-non-null-assertion': 'off', // Allow non-null assertions in tests
      '@typescript-eslint/no-unused-vars': 'off', // Test variables often used for setup
      'no-console': 'off', // Allow console in tests for debugging
      'prefer-const': 'off', // Allow let in tests for readability
    }
  },

  // Configuration files
  {
    files: ['*.config.js', '*.config.ts', '*.config.mjs'],
    rules: {
      'no-console': 'off',
      '@typescript-eslint/no-var-requires': 'off',
    }
  }
];
