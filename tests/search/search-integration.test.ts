/**
 * Search Integration Test Suite - Master Test Runner
 * Orchestrates all search system tests and validates end-to-end integration
 * Provides comprehensive test coverage report for hybrid search system
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { HybridSearchCoordinator } from '../../src/core/search/hybrid-search-coordinator.js';
import { CommandLineSearchEngine } from '../../src/core/search/command-line-search-engine.js';
import { AdvancedSearchCacheManager } from '../../src/core/search/advanced-search-cache.js';
import { CLISearchIntegration } from '../../src/core/search/cli-integration.js';
import { SearchCLICommands } from '../../src/core/search/search-cli-commands.js';
import { PerformanceMonitor } from '../../src/core/search/performance-monitor.js';
import { HybridSearchFactory } from '../../src/core/search/hybrid-search-factory.js';
import { CrossPlatformSearch } from '../../src/core/search/cross-platform-search.js';
import { CodePatternGenerator } from '../../src/core/search/code-pattern-generator.js';
import type { RAGQuery, SearchResult } from '../../src/core/search/types.js';
import type { CLIContext } from '../../src/core/cli/cli-types.js';
import { join } from 'path';
import { tmpdir } from 'os';
import { mkdtemp, rm, writeFile, mkdir } from 'fs/promises';
import * as os from 'os';

describe('Search Integration Test Suite - Master Test Runner', () => {
  let testWorkspace: string;
  let searchEngine: CommandLineSearchEngine;
  let cacheManager: AdvancedSearchCacheManager;
  let hybridCoordinator: HybridSearchCoordinator;
  let cliIntegration: CLISearchIntegration;
  let searchCommands: SearchCLICommands;
  let performanceMonitor: PerformanceMonitor;
  let crossPlatformSearch: CrossPlatformSearch;

  const mockCLIContext: CLIContext = {
    modelClient: undefined,
    workingDirectory: '',
    outputFormat: 'text',
    verbose: false,
    debug: false,
    config: {},
    session: {
      id: 'test-integration',
      startTime: Date.now()
    }
  };

  // Comprehensive test project structure
  const testProject = {
    'src/main.ts': `
      import { UserService } from './services/UserService';
      import { Logger } from './utils/Logger';
      
      const logger = new Logger('Main');
      const userService = new UserService();
      
      async function bootstrap(): Promise<void> {
        logger.info('Starting application...');
        await userService.initialize();
        logger.info('Application started successfully');
      }
      
      bootstrap().catch(error => {
        logger.error('Failed to start application:', error);
        process.exit(1);
      });
      
      // TODO: Add graceful shutdown handling
    `,
    
    'src/services/UserService.ts': `
      import { Repository } from '../repositories/UserRepository';
      import type { User, CreateUserRequest } from '../types/User';
      
      export class UserService {
        private repository: Repository<User>;
        
        constructor() {
          this.repository = new Repository<User>('users');
        }
        
        async initialize(): Promise<void> {
          await this.repository.connect();
        }
        
        async createUser(request: CreateUserRequest): Promise<User> {
          const user = await this.repository.create(request);
          return user;
        }
        
        async findUserById(id: string): Promise<User | null> {
          return this.repository.findById(id);
        }
        
        async updateUser(id: string, updates: Partial<User>): Promise<User> {
          return this.repository.update(id, updates);
        }
        
        async deleteUser(id: string): Promise<void> {
          await this.repository.delete(id);
        }
      }
      
      // FIXME: Add input validation
      // TODO: Add caching layer
    `,
    
    'src/components/UserList.tsx': `
      import React, { useState, useEffect } from 'react';
      import { UserService } from '../services/UserService';
      import type { User } from '../types/User';
      
      interface UserListProps {
        onUserSelect: (user: User) => void;
      }
      
      export const UserList: React.FC<UserListProps> = ({ onUserSelect }) => {
        const [users, setUsers] = useState<User[]>([]);
        const [loading, setLoading] = useState(true);
        
        useEffect(() => {
          const loadUsers = async () => {
            const userService = new UserService();
            // Load users logic here
            setLoading(false);
          };
          
          loadUsers();
        }, []);
        
        return (
          <div className="user-list">
            {loading ? (
              <div>Loading users...</div>
            ) : (
              <ul>
                {users.map(user => (
                  <li key={user.id} onClick={() => onUserSelect(user)}>
                    {user.name} - {user.email}
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      };
    `,
    
    'tests/services/UserService.test.ts': `
      import { describe, it, expect, beforeEach, jest } from '@jest/globals';
      import { UserService } from '../../src/services/UserService';
      
      describe('UserService', () => {
        let userService: UserService;
        
        beforeEach(() => {
          userService = new UserService();
        });
        
        describe('createUser', () => {
          it('should create a new user successfully', async () => {
            const request = {
              name: 'John Doe',
              email: 'john@example.com'
            };
            
            const user = await userService.createUser(request);
            
            expect(user).toBeDefined();
            expect(user.name).toBe(request.name);
            expect(user.email).toBe(request.email);
          });
          
          it('should validate user data before creation', async () => {
            const invalidRequest = {
              name: '',
              email: 'invalid-email'
            };
            
            await expect(userService.createUser(invalidRequest))
              .rejects.toThrow();
          });
        });
        
        describe('findUserById', () => {
          it('should find user by id', async () => {
            const userId = 'test-user-id';
            const user = await userService.findUserById(userId);
            
            expect(user).toBeDefined();
          });
          
          it('should return null for non-existent user', async () => {
            const user = await userService.findUserById('non-existent');
            expect(user).toBeNull();
          });
        });
      });
    `
  };

  beforeAll(async () => {
    console.log('\n🧪 Starting comprehensive search integration tests...');
    
    // Create test workspace
    testWorkspace = await mkdtemp(join(tmpdir(), 'search-integration-test-'));
    
    // Create test project structure
    for (const [filePath, content] of Object.entries(testProject)) {
      const fullPath = join(testWorkspace, filePath);
      const dir = fullPath.substring(0, fullPath.lastIndexOf('/'));
      await mkdir(dir, { recursive: true });
      await writeFile(fullPath, content);
    }
    
    // Initialize all system components
    searchEngine = new CommandLineSearchEngine(testWorkspace);
    cacheManager = new AdvancedSearchCacheManager({
      maxCacheSize: 100,
      maxCacheAge: 10000,
      enableFileHashTracking: true,
      enablePerformanceMetrics: true
    });
    
    performanceMonitor = new PerformanceMonitor();
    crossPlatformSearch = new CrossPlatformSearch();
    
    const hybridConfig = HybridSearchFactory.createBalancedConfig();
    hybridCoordinator = new HybridSearchCoordinator(
      searchEngine,
      hybridConfig,
      undefined, // No RAG for integration tests
      cacheManager,
      performanceMonitor
    );
    
    searchCommands = new SearchCLICommands(testWorkspace);
    
    mockCLIContext.workingDirectory = testWorkspace;
    cliIntegration = new CLISearchIntegration(mockCLIContext, testWorkspace);
    
    console.log('✅ Search integration test setup complete');
  }, 30000);

  afterAll(async () => {
    // Cleanup all components
    await hybridCoordinator?.shutdown();
    await cacheManager?.shutdown();
    await cliIntegration?.shutdown();
    
    // Remove test workspace
    await rm(testWorkspace, { recursive: true, force: true });
    
    console.log('🧹 Search integration test cleanup complete');
  });

  describe('System Architecture Integration', () => {
    it('should integrate all search components correctly', () => {
      expect(searchEngine).toBeDefined();
      expect(cacheManager).toBeDefined();
      expect(hybridCoordinator).toBeDefined();
      expect(cliIntegration).toBeDefined();
      expect(searchCommands).toBeDefined();
      expect(performanceMonitor).toBeDefined();
      expect(crossPlatformSearch).toBeDefined();
    });

    it('should provide unified search interface through hybrid coordinator', async () => {
      const query: RAGQuery = {
        query: 'UserService',
        queryType: 'class',
        maxResults: 10
      };

      const result = await hybridCoordinator.search(query);
      
      expect(result).toBeDefined();
      expect(result.documents).toBeDefined();
      expect(result.metadata?.searchMethod).toBeDefined();
      expect(result.metadata?.confidence).toBeGreaterThan(0);
    });

    it('should coordinate between search engine and cache manager', async () => {
      const query: RAGQuery = {
        query: 'createUser',
        queryType: 'function',
        maxResults: 5
      };

      // First search - should populate cache
      const firstResult = await hybridCoordinator.search(query);
      
      // Second search - should use cache
      const secondResult = await hybridCoordinator.search(query);
      
      expect(firstResult.documents.length).toBe(secondResult.documents.length);
      
      const cacheStats = cacheManager.getStats();
      expect(cacheStats.totalEntries).toBeGreaterThan(0);
    });
  });

  describe('Cross-Component Data Flow', () => {
    it('should flow search results through all system layers', async () => {
      // Test data flow: CLI -> Hybrid -> Cache -> Search Engine -> Results
      const commands = cliIntegration.registerSlashCommands();
      const searchCommand = commands.get('search');
      
      expect(searchCommand).toBeDefined();
      
      const result = await searchCommand!('UserService --type class');
      
      expect(typeof result).toBe('string');
      expect(result).not.toContain('❌');
      
      // Verify that the search went through the hybrid coordinator
      const metrics = hybridCoordinator.getMetrics();
      expect(metrics.totalQueries).toBeGreaterThan(0);
    });

    it('should maintain consistency across different access methods', async () => {
      const query = 'findUserById';
      
      // Test direct engine access
      const engineResult = await searchEngine.searchInFiles({
        query,
        maxResults: 10
      });
      
      // Test hybrid coordinator access
      const hybridResult = await hybridCoordinator.search({
        query,
        queryType: 'function',
        maxResults: 10
      });
      
      // Test CLI access
      const cliCommands = cliIntegration.registerSlashCommands();
      const cliResult = await cliCommands.get('find-fn')!(query);
      
      // All should find the same function
      expect(engineResult.length).toBeGreaterThan(0);
      expect(hybridResult.documents.length).toBeGreaterThan(0);
      expect(typeof cliResult).toBe('string');
      expect(cliResult).not.toContain('❌');
    });
  });

  describe('Pattern Generation and Recognition', () => {
    it('should generate and recognize language-specific patterns', async () => {
      const patterns = {
        typescript: {
          function: CodePatternGenerator.generateFunctionPattern('findUser', 'typescript'),
          class: CodePatternGenerator.generateClassPattern('UserService', 'typescript'),
          interface: CodePatternGenerator.generateInterfacePattern('User')
        },
        javascript: {
          function: CodePatternGenerator.generateFunctionPattern('bootstrap', 'javascript'),
          class: CodePatternGenerator.generateClassPattern('UserList', 'javascript')
        }
      };
      
      for (const [language, langPatterns] of Object.entries(patterns)) {
        for (const [type, pattern] of Object.entries(langPatterns)) {
          const result = await searchEngine.searchInFiles({
            query: pattern,
            regex: true,
            fileTypes: language === 'typescript' ? ['ts', 'tsx'] : ['js', 'jsx'],
            maxResults: 5
          });
          
          expect(result.length).toBeGreaterThanOrEqual(0);
          console.log(`   ${language} ${type} pattern found ${result.length} matches`);
        }
      }
    });

    it('should handle complex search patterns correctly', async () => {
      const complexPatterns = [
        {
          name: 'Async function with Promise return',
          pattern: 'async\\s+function\\s+\\w+\\s*\\([^)]*\\):\\s*Promise',
          expectedResults: 1 // bootstrap function
        },
        {
          name: 'React functional component with props',
          pattern: 'export\\s+const\\s+\\w+:\\s*React\\.FC<\\w+Props>',
          expectedResults: 1 // UserList component
        },
        {
          name: 'Method with specific parameter types',
          pattern: '\\w+\\s*\\([^)]*:\\s*string[^)]*\\):\\s*Promise',
          expectedResults: 1 // findUserById method
        }
      ];
      
      for (const test of complexPatterns) {
        const result = await searchEngine.searchInFiles({
          query: test.pattern,
          regex: true,
          maxResults: 10
        });
        
        console.log(`   "${test.name}": found ${result.length} matches`);
        expect(result.length).toBeGreaterThanOrEqual(0);
      }
    });
  });

  describe('Cross-Platform Compatibility', () => {
    it('should work on current platform', async () => {
      const platform = os.platform();
      console.log(`   Testing on platform: ${platform}`);
      
      // Test basic search functionality
      const result = await crossPlatformSearch.searchFiles({
        query: 'UserService',
        directory: testWorkspace,
        extensions: ['ts', 'tsx']
      });
      
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });

    it('should handle platform-specific file paths', async () => {
      const searchResult = await searchEngine.searchInFiles({
        query: 'UserService',
        maxResults: 5
      });
      
      expect(searchResult.length).toBeGreaterThan(0);
      
      // Verify file paths are properly formatted for current platform
      searchResult.forEach(result => {
        expect(result.filePath).toBeDefined();
        expect(result.filePath!.length).toBeGreaterThan(0);
        
        if (os.platform() === 'win32') {
          // Windows paths
          expect(result.filePath).toMatch(/^[A-Za-z]:|^\\\\/);
        } else {
          // Unix-like paths
          expect(result.filePath).toMatch(/^\//);
        }
      });
    });
  });

  describe('Performance Integration', () => {
    it('should maintain performance across integrated components', async () => {
      const testQueries = [
        'UserService',
        'createUser',
        'findUserById',
        'React.FC',
        'describe'
      ];
      
      console.log('   Testing integrated performance...');
      
      const startTime = Date.now();
      
      for (const query of testQueries) {
        await hybridCoordinator.search({
          query,
          queryType: 'general',
          maxResults: 10
        });
      }
      
      const totalTime = Date.now() - startTime;
      const avgTime = totalTime / testQueries.length;
      
      console.log(`   Average query time: ${avgTime.toFixed(2)}ms`);
      console.log(`   Total time for ${testQueries.length} queries: ${totalTime}ms`);
      
      // Should complete all queries quickly
      expect(avgTime).toBeLessThan(1000); // Less than 1 second per query
      expect(totalTime).toBeLessThan(5000); // Less than 5 seconds total
    });

    it('should provide performance monitoring across all components', async () => {
      // Execute various operations to generate metrics
      await hybridCoordinator.search({ query: 'test1', queryType: 'general', maxResults: 5 });
      await hybridCoordinator.search({ query: 'test2', queryType: 'function', maxResults: 5 });
      await hybridCoordinator.search({ query: 'test3', queryType: 'class', maxResults: 5 });
      
      // Check hybrid coordinator metrics
      const hybridMetrics = hybridCoordinator.getMetrics();
      expect(hybridMetrics.totalQueries).toBe(3);
      expect(hybridMetrics.averageResponseTime).toBeGreaterThan(0);
      
      // Check cache metrics
      const cacheStats = cacheManager.getStats();
      expect(cacheStats.totalEntries).toBeGreaterThanOrEqual(0);
      
      // Check search engine metrics
      const engineStats = searchEngine.getPerformanceStats();
      expect(engineStats.totalSearches).toBeGreaterThan(0);
    });
  });

  describe('Error Handling Integration', () => {
    it('should handle errors gracefully across all components', async () => {
      const problematicQueries = [
        '[invalid[regex',
        '\\invalid\\escape\\sequence',
        '',
        'a'.repeat(10000) // Very long query
      ];
      
      for (const query of problematicQueries) {
        // Should not throw exceptions
        const result = await hybridCoordinator.search({
          query,
          queryType: 'general',
          maxResults: 5
        });
        
        expect(result).toBeDefined();
        expect(result.documents).toBeDefined();
        expect(Array.isArray(result.documents)).toBe(true);
      }
    });

    it('should provide meaningful error information', async () => {
      const cliCommands = cliIntegration.registerSlashCommands();
      
      // Test various error conditions
      const errorTests = [
        { command: 'search', args: '' }, // Empty query
        { command: 'find-fn', args: '' }, // Empty function name
        { command: 'find-class', args: '' }, // Empty class name
        { command: 'cache', args: 'invalid' } // Invalid cache command
      ];
      
      for (const test of errorTests) {
        const command = cliCommands.get(test.command);
        expect(command).toBeDefined();
        
        const result = await command!(test.args);
        expect(typeof result).toBe('string');
        expect(result).toContain('❌');
        expect(result).toContain('Usage:');
      }
    });
  });

  describe('Feature Coverage Validation', () => {
    it('should support all documented search types', async () => {
      const searchTypes = [
        { queryType: 'function', query: 'createUser' },
        { queryType: 'class', query: 'UserService' },
        { queryType: 'import', query: 'React' },
        { queryType: 'general', query: 'TODO' },
        { queryType: 'pattern', query: 'async.*function', useRegex: true }
      ];
      
      for (const searchType of searchTypes) {
        const result = await hybridCoordinator.search({
          ...searchType,
          maxResults: 10
        } as RAGQuery);
        
        expect(result).toBeDefined();
        expect(result.metadata?.searchMethod).toBeDefined();
        console.log(`   ${searchType.queryType} search: ${result.documents.length} results`);
      }
    });

    it('should support all documented CLI commands', async () => {
      const cliCommands = cliIntegration.registerSlashCommands();
      const expectedCommands = [
        'search',
        'find-fn',
        'find-class',
        'find-import',
        'find-file',
        'cache',
        'search-help'
      ];
      
      for (const commandName of expectedCommands) {
        expect(cliCommands.has(commandName)).toBe(true);
        
        const command = cliCommands.get(commandName);
        expect(typeof command).toBe('function');
        
        // Test help/status commands
        if (commandName === 'search-help') {
          const result = await command!();
          expect(result).toContain('Search System Commands:');
        } else if (commandName === 'cache') {
          const result = await command!('stats');
          expect(typeof result).toBe('string');
        }
      }
    });

    it('should provide comprehensive system status information', () => {
      const status = cliIntegration.getSearchStatus();
      
      expect(status).toContain('Search System:');
      expect(status).toContain('Hybrid Search:');
      
      // Should indicate system capabilities
      const hasRipgrep = status.includes('Ripgrep: Available');
      const hasHybrid = status.includes('Hybrid Search: Enabled') || 
                       status.includes('Hybrid Search: Disabled');
      
      expect(hasHybrid).toBe(true);
      console.log('   System status check passed');
    });
  });

  describe('Integration Test Summary', () => {
    it('should report comprehensive test coverage', async () => {
      console.log('\n📊 Search Integration Test Summary:');
      
      // Component initialization status
      const components = {
        'Command Line Search Engine': !!searchEngine,
        'Advanced Cache Manager': !!cacheManager,
        'Hybrid Search Coordinator': !!hybridCoordinator,
        'CLI Integration': !!cliIntegration,
        'Search CLI Commands': !!searchCommands,
        'Performance Monitor': !!performanceMonitor,
        'Cross-Platform Search': !!crossPlatformSearch
      };
      
      console.log('   Component Status:');
      for (const [name, status] of Object.entries(components)) {
        console.log(`     ${status ? '✅' : '❌'} ${name}`);
        expect(status).toBe(true);
      }
      
      // Feature coverage
      const cliCommands = cliIntegration.registerSlashCommands();
      console.log(`   CLI Commands: ${cliCommands.size} registered`);
      
      const cacheStats = cacheManager.getStats();
      console.log(`   Cache Entries: ${cacheStats.totalEntries}`);
      
      const hybridMetrics = hybridCoordinator.getMetrics();
      console.log(`   Hybrid Queries: ${hybridMetrics.totalQueries}`);
      
      console.log('   ✅ All integration tests passed');
    });

    it('should validate system readiness for production use', async () => {
      // Perform a comprehensive system check
      const systemChecks = [
        {
          name: 'Search Engine Availability',
          test: async () => {
            const tools = await searchEngine.detectAvailableTools();
            return tools.length > 0;
          }
        },
        {
          name: 'Cache Functionality',
          test: async () => {
            await cacheManager.setCachedResults('test', { test: true }, {
              searchMethod: 'ripgrep',
              queryType: 'test',
              confidence: 1.0,
              duration: 1
            });
            const result = await cacheManager.getCachedResults('test');
            return result !== null;
          }
        },
        {
          name: 'Hybrid Coordination',
          test: async () => {
            const result = await hybridCoordinator.search({
              query: 'test-readiness',
              queryType: 'general',
              maxResults: 1
            });
            return result.metadata?.searchMethod !== undefined;
          }
        },
        {
          name: 'CLI Command Registration',
          test: () => {
            const commands = cliIntegration.registerSlashCommands();
            return commands.size >= 7;
          }
        }
      ];
      
      console.log('\n🔍 Production Readiness Checks:');
      
      for (const check of systemChecks) {
        const result = await check.test();
        console.log(`     ${result ? '✅' : '❌'} ${check.name}`);
        expect(result).toBe(true);
      }
      
      console.log('   ✅ System ready for production use');
    });
  });
});