/**
 * CLI Search Integration - End-to-End Tests
 * Tests slash commands, CLI integration, and user-facing search functionality
 * Validates user experience and command-line interface
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { CLISearchIntegration } from '../../src/core/search/cli-integration.js';
import { SearchCLICommands } from '../../src/core/search/search-cli-commands.js';
import type { CLIContext } from '../../src/core/cli/cli-types.js';
import { join } from 'path';
import { tmpdir } from 'os';
import { mkdtemp, rm, writeFile, mkdir } from 'fs/promises';

describe('CLI Search Integration - End-to-End Tests', () => {
  let testWorkspace: string;
  let cliIntegration: CLISearchIntegration;
  let searchCommands: SearchCLICommands;
  let mockCLIContext: CLIContext;

  // Mock CLI context
  const createMockCLIContext = (): CLIContext => ({
    modelClient: undefined, // No AI model needed for search tests
    workingDirectory: testWorkspace,
    outputFormat: 'text',
    verbose: false,
    debug: false,
    config: {},
    session: {
      id: 'test-session',
      startTime: Date.now(),
    },
  });

  // Test files for CLI search testing
  const testFiles = {
    'src/components/UserComponent.tsx': `
      import React from 'react';
      import { User } from '../types/User';
      
      interface UserComponentProps {
        user: User;
        onUpdate: (user: User) => void;
      }
      
      export const UserComponent: React.FC<UserComponentProps> = ({ user, onUpdate }) => {
        const handleSubmit = async (event: React.FormEvent) => {
          event.preventDefault();
          if (!user.name.trim()) {
            return;
          }
          onUpdate(user);
        };
      
        return (
          <form onSubmit={handleSubmit}>
            <input value={user.name} />
            <button type="submit">Update</button>
          </form>
        );
      };
    `,

    'src/services/ApiService.ts': `
      import axios from 'axios';
      
      export class ApiService {
        private baseUrl: string;
        private cache = new Map<number, User>();

        constructor(baseUrl: string) {
          this.baseUrl = baseUrl;
        }

        async fetchUser(id: number): Promise<User> {
          const cachedUser = this.cache.get(id);
          if (cachedUser !== undefined) {
            return cachedUser;
          }
          try {
            const response = await axios.get(\`\${this.baseUrl}/users/\${id}\`);
            this.cache.set(id, response.data);
            return response.data;
          } catch (error) {
            throw new Error('Failed to fetch user');
          }
        }

        async updateUser(user: User): Promise<User> {
          try {
            const response = await axios.put(\`\${this.baseUrl}/users/\${user.id}\`, user);
            this.cache.set(user.id, response.data);
            return response.data;
          } catch (error) {
            throw new Error('Failed to update user');
          }
        }

        async createUser(userData: Partial<User>): Promise<User> {
          try {
            const response = await axios.post(\`\${this.baseUrl}/users\`, userData);
            return response.data;
          } catch (error) {
            throw new Error('Failed to create user');
          }
        }
      }
    `,

    'src/utils/helpers.js': `
      // Utility functions
      export function formatDate(date) {
        return new Intl.DateTimeFormat('en-US').format(date);
      }
      
      export function validateEmail(email) {
        const emailRegex = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/;
        return emailRegex.test(email);
      }
      
      export function debounce(func, delay) {
        let timeoutId;
        return function (...args) {
          clearTimeout(timeoutId);
          timeoutId = setTimeout(() => func.apply(this, args), delay);
        };
      }
    `,

    'tests/components/UserComponent.test.tsx': `
      import { render, screen } from '@testing-library/react';
      import { UserComponent } from '../../src/components/UserComponent';
      
      describe('UserComponent', () => {
        const mockUser = {
          id: 1,
          name: 'John Doe',
          email: 'john@example.com'
        };
        
        it('should render user name', () => {
          render(<UserComponent user={mockUser} onUpdate={jest.fn()} />);
          expect(screen.getByValue('John Doe')).toBeInTheDocument();
        });
        
        it('should call onUpdate when form is submitted', () => {
          const mockOnUpdate = jest.fn();
          render(<UserComponent user={mockUser} onUpdate={mockOnUpdate} />);
          
          // Test form submission
          const submitButton = screen.getByRole('button', { name: /update/i });
          submitButton.click();
          
          expect(mockOnUpdate).toHaveBeenCalledWith(mockUser);
        });
      });
    `,

    'package.json': `{
      "name": "cli-search-test",
      "dependencies": {
        "react": "^18.0.0",
        "axios": "^1.0.0"
      },
      "devDependencies": {
        "@testing-library/react": "^13.0.0",
        "jest": "^29.0.0"
      }
    }`,

    'tsconfig.json': `{
      "compilerOptions": {
        "target": "ES2022",
        "module": "ES2022",
        "jsx": "react-jsx",
        "strict": true,
        "moduleResolution": "node",
        "allowSyntheticDefaultImports": true
      }
    }`,
  };

  beforeAll(async () => {
    // Create isolated test workspace
    testWorkspace = await mkdtemp(join(tmpdir(), 'cli-search-test-'));

    // Create test file structure
    for (const [filePath, content] of Object.entries(testFiles)) {
      const fullPath = join(testWorkspace, filePath);
      const dir = fullPath.substring(0, fullPath.lastIndexOf('/'));
      await mkdir(dir, { recursive: true });
      await writeFile(fullPath, content);
    }

    // Initialize components
    mockCLIContext = createMockCLIContext();
    searchCommands = new SearchCLICommands(testWorkspace);
    cliIntegration = new CLISearchIntegration(mockCLIContext, testWorkspace);
  });

  afterAll(async () => {
    await cliIntegration.shutdown();
    await rm(testWorkspace, { recursive: true, force: true });
  });

  describe('Slash Command Registration', () => {
    it('should register all search slash commands', () => {
      const commands = cliIntegration.registerSlashCommands();

      expect(commands).toBeInstanceOf(Map);
      expect(commands.size).toBeGreaterThan(5);

      // Verify specific commands exist
      const expectedCommands = [
        'search',
        'find-fn',
        'find-class',
        'find-import',
        'find-file',
        'cache',
        'search-help',
      ];

      for (const cmd of expectedCommands) {
        expect(commands.has(cmd)).toBe(true);
        expect(typeof commands.get(cmd)).toBe('function');
      }
    });

    it('should provide search system status', () => {
      const status = cliIntegration.getSearchStatus();

      expect(status).toBeDefined();
      expect(typeof status).toBe('string');
      expect(status).toContain('Search System:');
      expect(status).toContain('Hybrid Search:');
    });
  });

  describe('General Search Command (/search)', () => {
    it('should execute basic search queries', async () => {
      const commands = cliIntegration.registerSlashCommands();
      const searchCommand = commands.get('search');

      expect(searchCommand).toBeDefined();

      const result = await searchCommand!('UserComponent');

      expect(typeof result).toBe('string');
      expect(result).not.toContain('❌');
      expect(result).toContain('Search completed') || expect(result).toContain('UserComponent');
    });

    it('should handle search with type filters', async () => {
      const commands = cliIntegration.registerSlashCommands();
      const searchCommand = commands.get('search');

      const result = await searchCommand!('User --type function --lang typescript');

      expect(typeof result).toBe('string');
      expect(result).not.toContain('❌');
    });

    it('should handle search with language filters', async () => {
      const commands = cliIntegration.registerSlashCommands();
      const searchCommand = commands.get('search');

      const result = await searchCommand!('function --lang javascript');

      expect(typeof result).toBe('string');
      expect(result).not.toContain('❌');
    });

    it('should provide usage help for invalid syntax', async () => {
      const commands = cliIntegration.registerSlashCommands();
      const searchCommand = commands.get('search');

      const result = await searchCommand!('');

      expect(result).toContain('❌ Usage:');
      expect(result).toContain('/search <query>');
    });
  });

  describe('Function Search Command (/find-fn)', () => {
    it('should find function definitions', async () => {
      const commands = cliIntegration.registerSlashCommands();
      const findFnCommand = commands.get('find-fn');

      expect(findFnCommand).toBeDefined();

      const result = await findFnCommand!('fetchUser');

      expect(typeof result).toBe('string');
      expect(result).not.toContain('❌');
      expect(result).toContain('Function search completed') ||
        expect(result).toContain('fetchUser');
    });

    it('should find JavaScript functions', async () => {
      const commands = cliIntegration.registerSlashCommands();
      const findFnCommand = commands.get('find-fn');

      const result = await findFnCommand!('formatDate --lang javascript');

      expect(typeof result).toBe('string');
      expect(result).not.toContain('❌');
    });

    it('should find TypeScript functions', async () => {
      const commands = cliIntegration.registerSlashCommands();
      const findFnCommand = commands.get('find-fn');

      const result = await findFnCommand!('updateUser --lang typescript');

      expect(typeof result).toBe('string');
      expect(result).not.toContain('❌');
    });

    it('should provide usage help for empty queries', async () => {
      const commands = cliIntegration.registerSlashCommands();
      const findFnCommand = commands.get('find-fn');

      const result = await findFnCommand!('');

      expect(result).toContain('❌ Usage:');
      expect(result).toContain('/find-fn <function-name>');
    });
  });

  describe('Class Search Command (/find-class)', () => {
    it('should find class definitions', async () => {
      const commands = cliIntegration.registerSlashCommands();
      const findClassCommand = commands.get('find-class');

      expect(findClassCommand).toBeDefined();

      const result = await findClassCommand!('ApiService');

      expect(typeof result).toBe('string');
      expect(result).not.toContain('❌');
      expect(result).toContain('Class search completed') || expect(result).toContain('ApiService');
    });

    it('should find React components', async () => {
      const commands = cliIntegration.registerSlashCommands();
      const findClassCommand = commands.get('find-class');

      const result = await findClassCommand!('UserComponent --lang typescript');

      expect(typeof result).toBe('string');
      expect(result).not.toContain('❌');
    });

    it('should provide usage help for empty queries', async () => {
      const commands = cliIntegration.registerSlashCommands();
      const findClassCommand = commands.get('find-class');

      const result = await findClassCommand!('');

      expect(result).toContain('❌ Usage:');
      expect(result).toContain('/find-class <class-name>');
    });
  });

  describe('Import Search Command (/find-import)', () => {
    it('should find import statements', async () => {
      const commands = cliIntegration.registerSlashCommands();
      const findImportCommand = commands.get('find-import');

      expect(findImportCommand).toBeDefined();

      const result = await findImportCommand!('axios');

      expect(typeof result).toBe('string');
      expect(result).not.toContain('❌');
      expect(result).toContain('Import search completed') || expect(result).toContain('axios');
    });

    it('should find React imports', async () => {
      const commands = cliIntegration.registerSlashCommands();
      const findImportCommand = commands.get('find-import');

      const result = await findImportCommand!('react');

      expect(typeof result).toBe('string');
      expect(result).not.toContain('❌');
    });

    it('should find local imports', async () => {
      const commands = cliIntegration.registerSlashCommands();
      const findImportCommand = commands.get('find-import');

      const result = await findImportCommand!('../types/User');

      expect(typeof result).toBe('string');
      expect(result).not.toContain('❌');
    });

    it('should provide usage help for empty queries', async () => {
      const commands = cliIntegration.registerSlashCommands();
      const findImportCommand = commands.get('find-import');

      const result = await findImportCommand!('');

      expect(result).toContain('❌ Usage:');
      expect(result).toContain('/find-import <module-name>');
    });
  });

  describe('File Search Command (/find-file)', () => {
    it('should find files by pattern', async () => {
      const commands = cliIntegration.registerSlashCommands();
      const findFileCommand = commands.get('find-file');

      expect(findFileCommand).toBeDefined();

      const result = await findFileCommand!('UserComponent');

      expect(typeof result).toBe('string');
      expect(result).not.toContain('❌');
      expect(result).toContain('File search completed') ||
        expect(result).toContain('UserComponent');
    });

    it('should find configuration files', async () => {
      const commands = cliIntegration.registerSlashCommands();
      const findFileCommand = commands.get('find-file');

      const result = await findFileCommand!('package.json');

      expect(typeof result).toBe('string');
      expect(result).not.toContain('❌');
    });

    it('should find test files', async () => {
      const commands = cliIntegration.registerSlashCommands();
      const findFileCommand = commands.get('find-file');

      const result = await findFileCommand!('*.test.*');

      expect(typeof result).toBe('string');
      expect(result).not.toContain('❌');
    });

    it('should provide usage help for empty queries', async () => {
      const commands = cliIntegration.registerSlashCommands();
      const findFileCommand = commands.get('find-file');

      const result = await findFileCommand!('');

      expect(result).toContain('❌ Usage:');
      expect(result).toContain('/find-file <file-pattern>');
    });
  });

  describe('Cache Management Command (/cache)', () => {
    it('should show cache statistics', async () => {
      const commands = cliIntegration.registerSlashCommands();
      const cacheCommand = commands.get('cache');

      expect(cacheCommand).toBeDefined();

      const result = await cacheCommand!('stats');

      expect(typeof result).toBe('string');
      expect(result).toContain('Cache Statistics:') ||
        expect(result).toContain('No hybrid coordinator');
    });

    it('should show cache statistics with no arguments', async () => {
      const commands = cliIntegration.registerSlashCommands();
      const cacheCommand = commands.get('cache');

      const result = await cacheCommand!('');

      expect(typeof result).toBe('string');
      expect(result).toContain('Cache Statistics:') ||
        expect(result).toContain('No hybrid coordinator');
    });

    it('should clear cache', async () => {
      const commands = cliIntegration.registerSlashCommands();
      const cacheCommand = commands.get('cache');

      const result = await cacheCommand!('clear');

      expect(typeof result).toBe('string');
      expect(result).toContain('cleared') || expect(result).toContain('No hybrid coordinator');
    });

    it('should provide usage help for invalid commands', async () => {
      const commands = cliIntegration.registerSlashCommands();
      const cacheCommand = commands.get('cache');

      const result = await cacheCommand!('invalid');

      expect(result).toContain('❌ Usage:');
      expect(result).toContain('/cache [stats|clear]');
    });
  });

  describe('Help Command (/search-help)', () => {
    it('should provide comprehensive help information', async () => {
      const commands = cliIntegration.registerSlashCommands();
      const helpCommand = commands.get('search-help');

      expect(helpCommand).toBeDefined();

      const result = await helpCommand!();

      expect(typeof result).toBe('string');
      expect(result).toContain('Search System Commands:');
      expect(result).toContain('Slash Commands');
      expect(result).toContain('CLI Commands');
      expect(result).toContain('Examples:');
      expect(result).toContain('Performance Tips:');
    });

    it('should include all slash commands in help', async () => {
      const commands = cliIntegration.registerSlashCommands();
      const helpCommand = commands.get('search-help');

      const result = await helpCommand!();

      // Check that help includes documentation for all commands
      expect(result).toContain('/search');
      expect(result).toContain('/find-fn');
      expect(result).toContain('/find-class');
      expect(result).toContain('/find-import');
      expect(result).toContain('/find-file');
      expect(result).toContain('/cache');
    });

    it('should include CLI command documentation', async () => {
      const commands = cliIntegration.registerSlashCommands();
      const helpCommand = commands.get('search-help');

      const result = await helpCommand!();

      expect(result).toContain('crucible search');
      expect(result).toContain('crucible find-functions');
      expect(result).toContain('crucible find-classes');
    });

    it('should include practical examples', async () => {
      const commands = cliIntegration.registerSlashCommands();
      const helpCommand = commands.get('search-help');

      const result = await helpCommand!();

      expect(result).toContain('/search "handleRequest"');
      expect(result).toContain('/find-class "UserService"');
      expect(result).toContain('/find-import "express"');
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle search failures gracefully', async () => {
      const commands = cliIntegration.registerSlashCommands();
      const searchCommand = commands.get('search');

      // Test with potentially problematic pattern
      const result = await searchCommand!('\\invalid\\regex\\pattern');

      expect(typeof result).toBe('string');
      expect(result).not.toThrow;
      // Should either complete successfully or show a clear error message
      if (result.includes('❌')) {
        expect(result).toContain('failed');
      }
    });

    it('should handle concurrent command execution', async () => {
      const commands = cliIntegration.registerSlashCommands();
      const searchCommand = commands.get('search');

      // Execute multiple searches concurrently
      const promises = [
        searchCommand!('UserComponent'),
        searchCommand!('ApiService'),
        searchCommand!('formatDate'),
      ];

      const results = await Promise.all(promises);

      results.forEach(result => {
        expect(typeof result).toBe('string');
        expect(result).not.toThrow;
      });
    });

    it('should handle very long search queries', async () => {
      const commands = cliIntegration.registerSlashCommands();
      const searchCommand = commands.get('search');

      const longQuery = 'a'.repeat(1000); // Very long query
      const result = await searchCommand!(longQuery);

      expect(typeof result).toBe('string');
      expect(result).not.toThrow;
    });

    it('should handle special characters in queries', async () => {
      const commands = cliIntegration.registerSlashCommands();
      const searchCommand = commands.get('search');

      const specialQuery = 'user@example.com $#@!%^&*()[]{}';
      const result = await searchCommand!(specialQuery);

      expect(typeof result).toBe('string');
      expect(result).not.toThrow;
    });
  });

  describe('Integration with Search Commands', () => {
    it('should properly integrate with SearchCLICommands', async () => {
      // Test direct CLI commands for comparison
      const directResult = await searchCommands.handleSearchCommand('UserComponent', {
        type: 'general',
        maxResults: '10',
      });

      // Test slash command integration
      const commands = cliIntegration.registerSlashCommands();
      const searchCommand = commands.get('search');
      const slashResult = await searchCommand!('UserComponent');

      // Both should complete without errors
      expect(typeof slashResult).toBe('string');
      expect(slashResult).not.toContain('❌');
    });

    it('should handle different output formats', async () => {
      const commands = cliIntegration.registerSlashCommands();

      // Test different command types
      const searchResult = await commands.get('search')!('UserComponent');
      const functionResult = await commands.get('find-fn')!('fetchUser');
      const classResult = await commands.get('find-class')!('ApiService');

      // All should return formatted strings
      [searchResult, functionResult, classResult].forEach(result => {
        expect(typeof result).toBe('string');
        expect(result.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Performance and Responsiveness', () => {
    it('should complete searches within reasonable time', async () => {
      const commands = cliIntegration.registerSlashCommands();
      const searchCommand = commands.get('search');

      const startTime = Date.now();
      const result = await searchCommand!('function');
      const duration = Date.now() - startTime;

      expect(typeof result).toBe('string');
      expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
    });

    it('should handle multiple rapid searches', async () => {
      const commands = cliIntegration.registerSlashCommands();
      const searchCommand = commands.get('search');

      const startTime = Date.now();

      // Execute 5 rapid searches
      const promises = Array.from({ length: 5 }, (_, i) => searchCommand!(`search${i}`));

      const results = await Promise.all(promises);
      const duration = Date.now() - startTime;

      expect(results).toHaveLength(5);
      results.forEach(result => {
        expect(typeof result).toBe('string');
      });

      // Should handle rapid searches efficiently
      expect(duration).toBeLessThan(10000); // All searches within 10 seconds
    });
  });

  describe('Context Awareness', () => {
    it('should work with different CLI contexts', async () => {
      const contextVariations = [
        { ...mockCLIContext, verbose: true },
        { ...mockCLIContext, debug: true },
        { ...mockCLIContext, outputFormat: 'json' },
      ];

      for (const context of contextVariations) {
        const integration = new CLISearchIntegration(context, testWorkspace);
        const commands = integration.registerSlashCommands();

        const result = await commands.get('search')!('test');

        expect(typeof result).toBe('string');
        await integration.shutdown();
      }
    });

    it('should respect working directory context', async () => {
      const commands = cliIntegration.registerSlashCommands();
      const searchCommand = commands.get('search');

      const result = await searchCommand!('UserComponent');

      expect(typeof result).toBe('string');
      // Should find files in the test workspace
      expect(result).not.toContain('❌') || expect(result).toContain('completed');
    });
  });
});
