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
      
      // 2025 TypeScript Best Practices - Strict Mode
      // Temporarily relax no-explicit-any to warn while we migrate types progressively.
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': ['warn', { 
        'vars': 'all',
        'args': 'after-used',
        'ignoreRestSiblings': false,
        'argsIgnorePattern': '^_',
        'varsIgnorePattern': '^_'
      }],
      '@typescript-eslint/no-non-null-assertion': 'error',
      // Disabled until strictNullChecks is enabled in tsconfig
      '@typescript-eslint/prefer-nullish-coalescing': 'off',
      '@typescript-eslint/prefer-optional-chain': 'warn',
      // Gradual migration for promise-safety rules
      '@typescript-eslint/no-floating-promises': 'warn',
      '@typescript-eslint/no-misused-promises': 'warn',
      '@typescript-eslint/await-thenable': 'error',
      '@typescript-eslint/no-for-in-array': 'error',
      '@typescript-eslint/no-implied-eval': 'error',
      '@typescript-eslint/prefer-includes': 'error',
      '@typescript-eslint/prefer-string-starts-ends-with': 'error',
      '@typescript-eslint/promise-function-async': 'error',
      '@typescript-eslint/require-array-sort-compare': 'error',
      '@typescript-eslint/restrict-plus-operands': 'error',
      '@typescript-eslint/restrict-template-expressions': 'error',
      '@typescript-eslint/unbound-method': 'error',
      
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
      
      // Code Quality
      'no-console': 'warn', // Keep as warn for CLI application
      'no-debugger': 'error',
      'no-alert': 'error',
      
      // Disable base ESLint rules that are covered by TypeScript equivalents
      'no-unused-vars': 'off', // Handled by @typescript-eslint/no-unused-vars
      'no-redeclare': 'off',   // TypeScript handles this
      'no-undef': 'off',       // TypeScript handles this
    }
  },

  // Test files - More lenient rules
  {
    files: ['**/*.test.ts', '**/*.spec.ts', 'tests/**/*.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-non-null-assertion': 'warn',
      'no-console': 'off',
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
