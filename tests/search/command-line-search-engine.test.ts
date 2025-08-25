/**
 * Command Line Search Engine - Cross-Platform Tests
 * Tests ripgrep, PowerShell, and fallback search implementations
 * Validates cross-platform compatibility and performance claims
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { CommandLineSearchEngine } from '../../src/core/search/command-line-search-engine.js';
import { CodePatternGenerator } from '../../src/core/search/code-pattern-generator.js';
import type { SearchOptions, SearchResult } from '../../src/core/search/types.js';
import { join } from 'path';
import { tmpdir } from 'os';
import { mkdtemp, rm, writeFile, mkdir } from 'fs/promises';
import * as os from 'os';

describe('Command Line Search Engine - Cross-Platform Tests', () => {
  let testWorkspace: string;
  let searchEngine: CommandLineSearchEngine;
  
  // Test files with various programming language patterns
  const testFiles = {
    'src/typescript/utils.ts': `
      // TypeScript functions and classes
      export function parseJsonData(input: string): object {
        return JSON.parse(input);
      }
      
      export interface UserData {
        id: number;
        name: string;
        email?: string;
      }
      
      export class DataProcessor {
        private data: UserData[] = [];
        
        async processUsers(users: UserData[]): Promise<void> {
          this.data = users;
        }
        
        getUserById(id: number): UserData | undefined {
          return this.data.find(user => user.id === id);
        }
      }
      
      // TODO: Add input validation
      // FIXME: Handle null cases
    `,
    
    'src/javascript/helpers.js': `
      // JavaScript ES6+ patterns
      const calculateTotal = (items) => {
        return items.reduce((sum, item) => sum + item.price, 0);
      };
      
      class ShoppingCart {
        constructor() {
          this.items = [];
        }
        
        addItem(item) {
          this.items.push(item);
        }
        
        getTotal() {
          return calculateTotal(this.items);
        }
      }
      
      export { calculateTotal, ShoppingCart };
      
      // TODO: Add discount calculations
    `,
    
    'src/python/analyzer.py': `
      # Python functions and classes
      import json
      from typing import List, Optional, Dict, Any
      
      def analyze_data(data: List[Dict[str, Any]]) -> Dict[str, Any]:
          """Analyze dataset and return statistics"""
          if not data:
              return {}
          
          total_records = len(data)
          return {
              'total': total_records,
              'keys': list(data[0].keys()) if data else []
          }
      
      class DataAnalyzer:
          def __init__(self, data: List[Dict[str, Any]]):
              self.data = data
              
          def get_summary(self) -> Dict[str, Any]:
              return analyze_data(self.data)
              
          def filter_by_key(self, key: str, value: Any) -> List[Dict[str, Any]]:
              return [item for item in self.data if item.get(key) == value]
      
      # TODO: Add more analysis functions
      # FIXME: Handle edge cases
    `,
    
    'tests/unit/utils.test.js': `
      // Jest test patterns
      describe('Utils', () => {
        it('should parse JSON correctly', () => {
          const result = parseJsonData('{"test": true}');
          expect(result.test).toBe(true);
        });
        
        it('should handle empty input', () => {
          expect(() => parseJsonData('')).toThrow();
        });
      });
    `,
    
    'config/settings.json': `{
      "database": {
        "host": "localhost",
        "port": 5432,
        "name": "testdb"
      },
      "redis": {
        "host": "localhost",
        "port": 6379
      },
      "logging": {
        "level": "info",
        "format": "json"
      }
    }`,
    
    'README.md': `
      # Test Project
      
      This is a test project for hybrid search functionality.
      
      ## Features
      
      - TypeScript support
      - JavaScript ES6+
      - Python data analysis
      - Cross-platform testing
      
      ## Installation
      
      \`\`\`bash
      npm install
      pip install -r requirements.txt
      \`\`\`
      
      TODO: Add more documentation
    `
  };

  beforeAll(async () => {
    // Create isolated test workspace
    testWorkspace = await mkdtemp(join(tmpdir(), 'search-engine-test-'));
    
    // Create test file structure
    for (const [filePath, content] of Object.entries(testFiles)) {
      const fullPath = join(testWorkspace, filePath);
      const dir = fullPath.substring(0, fullPath.lastIndexOf('/'));
      await mkdir(dir, { recursive: true });
      await writeFile(fullPath, content);
    }
    
    // Initialize search engine
    searchEngine = new CommandLineSearchEngine(testWorkspace);
  });

  afterAll(async () => {
    await rm(testWorkspace, { recursive: true, force: true });
  });

  beforeEach(() => {
    // Clear cache before each test
    searchEngine.clearCache();
  });

  describe('Basic Search Functionality', () => {
    it('should find simple text patterns', async () => {
      const options: SearchOptions = {
        query: 'parseJsonData',
        maxResults: 10
      };

      const results = await searchEngine.searchInFiles(options);
      
      expect(results).toBeDefined();
      expect(results.length).toBeGreaterThan(0);
      
      const match = results.find(result => 
        result.content.includes('parseJsonData') && 
        result.filePath?.includes('utils.ts')
      );
      expect(match).toBeDefined();
      expect(match?.line).toBeGreaterThan(0);
      expect(match?.column).toBeGreaterThanOrEqual(0);
    });

    it('should support case-insensitive searches', async () => {
      const options: SearchOptions = {
        query: 'PARSEJSONDATA',
        caseSensitive: false,
        maxResults: 10
      };

      const results = await searchEngine.searchInFiles(options);
      
      expect(results.length).toBeGreaterThan(0);
      const match = results.find(result => 
        result.content.toLowerCase().includes('parsejsondata')
      );
      expect(match).toBeDefined();
    });

    it('should support whole word matching', async () => {
      const options: SearchOptions = {
        query: 'data',
        wholeWord: true,
        maxResults: 20
      };

      const results = await searchEngine.searchInFiles(options);
      
      // Should find 'data' as a whole word, not as part of other words
      expect(results.length).toBeGreaterThan(0);
      
      // Verify whole word matching
      results.forEach(result => {
        const content = result.content.toLowerCase();
        const index = content.indexOf('data');
        if (index >= 0) {
          // Check character before
          if (index > 0) {
            const before = content[index - 1];
            expect(/[^a-z0-9_]/.test(before)).toBe(true);
          }
          // Check character after
          if (index + 4 < content.length) {
            const after = content[index + 4];
            expect(/[^a-z0-9_]/.test(after)).toBe(true);
          }
        }
      });
    });
  });

  describe('Pattern-Based Searches', () => {
    it('should generate and find function patterns', async () => {
      const pattern = CodePatternGenerator.generateFunctionPattern('calculate', 'javascript');
      
      const options: SearchOptions = {
        query: pattern,
        regex: true,
        fileTypes: ['js'],
        maxResults: 10
      };

      const results = await searchEngine.searchInFiles(options);
      
      expect(results.length).toBeGreaterThan(0);
      const match = results.find(result => 
        result.content.includes('calculateTotal')
      );
      expect(match).toBeDefined();
    });

    it('should generate and find class patterns', async () => {
      const pattern = CodePatternGenerator.generateClassPattern('.*Cart', 'javascript');
      
      const options: SearchOptions = {
        query: pattern,
        regex: true,
        fileTypes: ['js'],
        maxResults: 10
      };

      const results = await searchEngine.searchInFiles(options);
      
      expect(results.length).toBeGreaterThan(0);
      const match = results.find(result => 
        result.content.includes('ShoppingCart')
      );
      expect(match).toBeDefined();
    });

    it('should find TypeScript interface patterns', async () => {
      const pattern = CodePatternGenerator.generateInterfacePattern('UserData');
      
      const options: SearchOptions = {
        query: pattern,
        regex: true,
        fileTypes: ['ts'],
        maxResults: 10
      };

      const results = await searchEngine.searchInFiles(options);
      
      expect(results.length).toBeGreaterThan(0);
      const match = results.find(result => 
        result.content.includes('interface UserData')
      );
      expect(match).toBeDefined();
    });

    it('should find import/export patterns', async () => {
      const pattern = CodePatternGenerator.generateImportPattern('json');
      
      const options: SearchOptions = {
        query: pattern,
        regex: true,
        maxResults: 10
      };

      const results = await searchEngine.searchInFiles(options);
      
      expect(results.length).toBeGreaterThan(0);
      const match = results.find(result => 
        result.content.includes('import') && result.content.includes('json')
      );
      expect(match).toBeDefined();
    });

    it('should find test patterns', async () => {
      const pattern = CodePatternGenerator.generateTestPattern('parse', 'javascript');
      
      const options: SearchOptions = {
        query: pattern,
        regex: true,
        fileTypes: ['js'],
        maxResults: 10
      };

      const results = await searchEngine.searchInFiles(options);
      
      expect(results.length).toBeGreaterThan(0);
      const match = results.find(result => 
        result.content.includes('should parse') || 
        result.content.includes('it(') ||
        result.content.includes('describe(')
      );
      expect(match).toBeDefined();
    });

    it('should find TODO and FIXME patterns', async () => {
      const options: SearchOptions = {
        query: '(TODO|FIXME):.*',
        regex: true,
        maxResults: 20
      };

      const results = await searchEngine.searchInFiles(options);
      
      expect(results.length).toBeGreaterThan(0);
      
      const todoCount = results.filter(r => r.content.includes('TODO')).length;
      const fixmeCount = results.filter(r => r.content.includes('FIXME')).length;
      
      expect(todoCount).toBeGreaterThan(0);
      expect(fixmeCount).toBeGreaterThan(0);
    });
  });

  describe('File Type Filtering', () => {
    it('should filter by single file type', async () => {
      const options: SearchOptions = {
        query: 'function',
        fileTypes: ['ts'],
        maxResults: 10
      };

      const results = await searchEngine.searchInFiles(options);
      
      expect(results.length).toBeGreaterThan(0);
      results.forEach(result => {
        expect(result.filePath).toMatch(/\.ts$/);
      });
    });

    it('should filter by multiple file types', async () => {
      const options: SearchOptions = {
        query: 'class',
        fileTypes: ['ts', 'js', 'py'],
        maxResults: 20
      };

      const results = await searchEngine.searchInFiles(options);
      
      expect(results.length).toBeGreaterThan(0);
      results.forEach(result => {
        expect(result.filePath).toMatch(/\.(ts|js|py)$/);
      });
    });

    it('should search all files when no type specified', async () => {
      const options: SearchOptions = {
        query: 'TODO',
        maxResults: 20
      };

      const results = await searchEngine.searchInFiles(options);
      
      expect(results.length).toBeGreaterThan(0);
      
      // Should find results in different file types
      const fileTypes = new Set(
        results.map(r => r.filePath?.split('.').pop()).filter(Boolean)
      );
      expect(fileTypes.size).toBeGreaterThan(1);
    });
  });

  describe('Context and Result Formatting', () => {
    it('should provide context lines when requested', async () => {
      const options: SearchOptions = {
        query: 'DataProcessor',
        contextLines: { context: 2 },
        maxResults: 5
      };

      const results = await searchEngine.searchInFiles(options);
      
      expect(results.length).toBeGreaterThan(0);
      const match = results[0];
      
      expect(match.content).toBeDefined();
      expect(match.content.length).toBeGreaterThan(0);
      
      // Context should include surrounding lines
      expect(match.content.split('\n').length).toBeGreaterThanOrEqual(3);
    });

    it('should limit results when maxResults specified', async () => {
      const options: SearchOptions = {
        query: 'function',
        maxResults: 3
      };

      const results = await searchEngine.searchInFiles(options);
      
      expect(results.length).toBeLessThanOrEqual(3);
    });

    it('should provide accurate line and column information', async () => {
      const options: SearchOptions = {
        query: 'export function parseJsonData',
        maxResults: 5
      };

      const results = await searchEngine.searchInFiles(options);
      
      expect(results.length).toBeGreaterThan(0);
      const match = results[0];
      
      expect(match.line).toBeGreaterThan(0);
      expect(match.column).toBeGreaterThanOrEqual(0);
      expect(match.filePath).toContain('utils.ts');
    });
  });

  describe('Cross-Platform Compatibility', () => {
    it('should work on current platform', async () => {
      const platform = os.platform();
      console.log(`Testing on platform: ${platform}`);
      
      const options: SearchOptions = {
        query: 'function',
        maxResults: 5
      };

      const results = await searchEngine.searchInFiles(options);
      
      // Should work regardless of platform
      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
    });

    it('should handle file paths correctly on current platform', async () => {
      const options: SearchOptions = {
        query: 'ShoppingCart',
        maxResults: 5
      };

      const results = await searchEngine.searchInFiles(options);
      
      expect(results.length).toBeGreaterThan(0);
      results.forEach(result => {
        expect(result.filePath).toBeDefined();
        expect(result.filePath!.length).toBeGreaterThan(0);
        
        // Path should be valid for current platform
        if (os.platform() === 'win32') {
          expect(result.filePath).toMatch(/[A-Za-z]:\\|^\\\\/);
        } else {
          expect(result.filePath).toMatch(/^\//);
        }
      });
    });

    it('should detect and use best available search tool', async () => {
      // This test verifies the tool selection logic
      const methods = await searchEngine.detectAvailableTools();
      
      expect(methods).toBeDefined();
      expect(methods.length).toBeGreaterThan(0);
      
      // Should prefer ripgrep if available, otherwise use platform-specific tools
      const hasRipgrep = methods.includes('ripgrep');
      const hasPlatformTool = os.platform() === 'win32' 
        ? methods.includes('powershell') || methods.includes('findstr')
        : methods.includes('grep') || methods.includes('find');
      
      expect(hasRipgrep || hasPlatformTool).toBe(true);
    });
  });

  describe('Performance and Caching', () => {
    it('should cache results for identical queries', async () => {
      const options: SearchOptions = {
        query: 'calculateTotal',
        maxResults: 5
      };

      // First search
      const start1 = Date.now();
      const results1 = await searchEngine.searchInFiles(options);
      const time1 = Date.now() - start1;

      // Second identical search
      const start2 = Date.now();
      const results2 = await searchEngine.searchInFiles(options);
      const time2 = Date.now() - start2;

      // Results should be identical
      expect(results1.length).toBe(results2.length);
      expect(results1[0]?.content).toBe(results2[0]?.content);
      
      // Second search should be faster (cached)
      expect(time2).toBeLessThan(time1 * 0.8); // At least 20% faster
    });

    it('should handle large result sets efficiently', async () => {
      const options: SearchOptions = {
        query: '\\w+', // Match any word
        regex: true,
        maxResults: 100
      };

      const start = Date.now();
      const results = await searchEngine.searchInFiles(options);
      const time = Date.now() - start;

      expect(results.length).toBeGreaterThan(0);
      expect(results.length).toBeLessThanOrEqual(100);
      
      // Should complete in reasonable time (less than 5 seconds)
      expect(time).toBeLessThan(5000);
    });

    it('should provide performance statistics', async () => {
      const options: SearchOptions = {
        query: 'function',
        maxResults: 10
      };

      const results = await searchEngine.searchInFiles(options);
      
      // Check if performance metrics are available
      const stats = searchEngine.getPerformanceStats();
      
      expect(stats).toBeDefined();
      expect(stats.totalSearches).toBeGreaterThan(0);
      expect(stats.cacheHitRate).toBeGreaterThanOrEqual(0);
      expect(stats.averageSearchTime).toBeGreaterThan(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid regex patterns gracefully', async () => {
      const options: SearchOptions = {
        query: '[invalid[regex',
        regex: true,
        maxResults: 5
      };

      // Should not throw, but return empty results or fallback
      const results = await searchEngine.searchInFiles(options);
      
      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
    });

    it('should handle non-existent directory gracefully', async () => {
      const invalidSearchEngine = new CommandLineSearchEngine('/non/existent/path');
      
      const options: SearchOptions = {
        query: 'test',
        maxResults: 5
      };

      // Should not throw, but return empty results
      const results = await invalidSearchEngine.searchInFiles(options);
      
      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBe(0);
    });

    it('should handle empty queries gracefully', async () => {
      const options: SearchOptions = {
        query: '',
        maxResults: 5
      };

      const results = await searchEngine.searchInFiles(options);
      
      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
    });

    it('should handle very large queries', async () => {
      const largeQuery = 'a'.repeat(10000); // 10KB query
      
      const options: SearchOptions = {
        query: largeQuery,
        maxResults: 5
      };

      const results = await searchEngine.searchInFiles(options);
      
      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
    });
  });

  describe('Language-Specific Patterns', () => {
    it('should correctly identify TypeScript patterns', async () => {
      const patterns = [
        CodePatternGenerator.generateFunctionPattern('process', 'typescript'),
        CodePatternGenerator.generateClassPattern('DataProcessor', 'typescript'),
        CodePatternGenerator.generateInterfacePattern('UserData')
      ];

      for (const pattern of patterns) {
        const options: SearchOptions = {
          query: pattern,
          regex: true,
          fileTypes: ['ts'],
          maxResults: 10
        };

        const results = await searchEngine.searchInFiles(options);
        expect(results.length).toBeGreaterThan(0);
      }
    });

    it('should correctly identify Python patterns', async () => {
      const patterns = [
        CodePatternGenerator.generateFunctionPattern('analyze', 'python'),
        CodePatternGenerator.generateClassPattern('DataAnalyzer', 'python')
      ];

      for (const pattern of patterns) {
        const options: SearchOptions = {
          query: pattern,
          regex: true,
          fileTypes: ['py'],
          maxResults: 10
        };

        const results = await searchEngine.searchInFiles(options);
        expect(results.length).toBeGreaterThan(0);
      }
    });

    it('should identify configuration patterns', async () => {
      const options: SearchOptions = {
        query: '"host":\\s*"[^"]*"',
        regex: true,
        fileTypes: ['json'],
        maxResults: 10
      };

      const results = await searchEngine.searchInFiles(options);
      
      expect(results.length).toBeGreaterThan(0);
      const match = results.find(result => 
        result.content.includes('"host"') && result.content.includes('localhost')
      );
      expect(match).toBeDefined();
    });
  });
});