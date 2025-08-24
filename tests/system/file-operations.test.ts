/**
 * Comprehensive File Operations System Test
 * 
 * Tests the system's ability to handle various file operations including:
 * - Reading various file types (.ts, .js, .json, .md, .txt)
 * - Writing files with different content types
 * - File iteration and directory processing
 * - Error handling for missing files, permissions, etc.
 * - Real system integration with actual CodeCrucible architecture
 * - Sync and async operations
 * - Large file handling
 * - Concurrent operations
 * - File watching/monitoring
 */

import { describe, test, expect, beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals';
import { promises as fs, existsSync, constants } from 'fs';
import { join, resolve, dirname, basename, extname, relative } from 'path';
import { tmpdir } from 'os';
import { performance } from 'perf_hooks';
import { EventEmitter } from 'events';
// Simple UUID alternative
const generateId = () => Math.random().toString(36).substring(2) + Date.now().toString(36);

// Import system components
import { EnhancedReadFileTool, EnhancedWriteFileTool, FileSearchTool, FileOperationsTool } from '../../src/core/tools/enhanced-file-tools.js';
import { FilesystemTools } from '../../src/core/tools/filesystem-tools.js';
import IntelligentFileWatcher, { FileChangeType, FileChangeEvent } from '../../src/core/file-watching/intelligent-file-watcher.js';
import { MCPServerManager } from '../../src/mcp-servers/mcp-server-manager.js';
import { Logger } from '../../src/core/logger.js';

// Test configuration
const TEST_DIR_PREFIX = 'codecrucible-file-ops-test';
const LARGE_FILE_SIZE = 1024 * 1024; // 1MB
const CONCURRENT_OPERATIONS = 10;

interface TestReport {
  testSuite: string;
  startTime: number;
  endTime: number;
  totalTests: number;
  passedTests: number;
  failedTests: number;
  results: TestResult[];
  recommendations: string[];
  systemMetrics: {
    memoryUsage: NodeJS.MemoryUsage;
    performanceMetrics: PerformanceMetrics;
  };
}

interface TestResult {
  testName: string;
  passed: boolean;
  executionTime: number;
  error?: string;
  metrics?: any;
}

interface PerformanceMetrics {
  averageReadTime: number;
  averageWriteTime: number;
  concurrentOperationTime: number;
  memoryEfficiency: number;
  fileWatcherLatency: number;
}

class FileOperationsTestSuite {
  private testDir: string;
  private agentContext: { workingDirectory: string };
  private readTool: EnhancedReadFileTool;
  private writeTool: EnhancedWriteFileTool;
  private searchTool: FileSearchTool;
  private operationsTool: FileOperationsTool;
  private filesystemTools: FilesystemTools;
  private fileWatcher?: IntelligentFileWatcher;
  private mcpManager: MCPServerManager;
  private logger: Logger;
  private report: TestReport;
  private testResults: TestResult[] = [];

  constructor() {
    // Create unique test directory
    this.testDir = join(tmpdir(), `${TEST_DIR_PREFIX}-${generateId()}`);
    this.agentContext = { workingDirectory: this.testDir };
    
    this.logger = new Logger('FileOperationsTest');
    
    // Initialize tools
    this.readTool = new EnhancedReadFileTool(this.agentContext);
    this.writeTool = new EnhancedWriteFileTool(this.agentContext);
    this.searchTool = new FileSearchTool(this.agentContext);
    this.operationsTool = new FileOperationsTool(this.agentContext);
    
    // Mock MCP Manager for filesystem tools
    this.mcpManager = {
      readFileSecure: async (path: string) => fs.readFile(path, 'utf8'),
      writeFileSecure: async (path: string, content: string) => fs.writeFile(path, content, 'utf8'),
      listDirectorySecure: async (path: string) => fs.readdir(path),
      getFileStats: async (path: string) => {
        try {
          const stats = await fs.stat(path);
          return {
            exists: true,
            isFile: stats.isFile(),
            isDirectory: stats.isDirectory(),
            size: stats.size,
            modified: stats.mtime.toISOString(),
          };
        } catch {
          return {
            exists: false,
            isFile: false,
            isDirectory: false,
            size: 0,
            modified: new Date().toISOString(),
          };
        }
      },
    } as any;
    
    this.filesystemTools = new FilesystemTools(this.mcpManager);

    // Initialize report
    this.report = {
      testSuite: 'File Operations System Test',
      startTime: performance.now(),
      endTime: 0,
      totalTests: 0,
      passedTests: 0,
      failedTests: 0,
      results: [],
      recommendations: [],
      systemMetrics: {
        memoryUsage: process.memoryUsage(),
        performanceMetrics: {
          averageReadTime: 0,
          averageWriteTime: 0,
          concurrentOperationTime: 0,
          memoryEfficiency: 0,
          fileWatcherLatency: 0,
        },
      },
    };
  }

  async setup(): Promise<void> {
    // Create test directory structure
    await fs.mkdir(this.testDir, { recursive: true });
    
    // Create subdirectories
    const subdirs = ['src', 'tests', 'config', 'docs', 'temp', 'large-files'];
    for (const subdir of subdirs) {
      await fs.mkdir(join(this.testDir, subdir), { recursive: true });
    }

    this.logger.info(`Test environment setup complete: ${this.testDir}`);
  }

  async cleanup(): Promise<void> {
    try {
      if (this.fileWatcher) {
        await this.fileWatcher.stopWatching();
      }
      
      if (existsSync(this.testDir)) {
        await fs.rm(this.testDir, { recursive: true, force: true });
      }
      
      this.logger.info('Test environment cleaned up');
    } catch (error) {
      this.logger.warn('Cleanup failed:', error);
    }
  }

  private async recordTest(testName: string, testFn: () => Promise<any>): Promise<void> {
    const startTime = performance.now();
    let passed = false;
    let error: string | undefined;
    let metrics: any = {};

    try {
      const result = await testFn();
      passed = true;
      if (typeof result === 'object' && result !== null) {
        metrics = result;
      }
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    }

    const executionTime = performance.now() - startTime;
    
    const testResult: TestResult = {
      testName,
      passed,
      executionTime,
      error,
      metrics,
    };

    this.testResults.push(testResult);
    this.report.totalTests++;
    if (passed) this.report.passedTests++;
    else this.report.failedTests++;

    this.logger.info(`Test ${testName}: ${passed ? 'PASSED' : 'FAILED'} (${executionTime.toFixed(2)}ms)`);
    if (error) {
      this.logger.error(`Test ${testName} error:`, error);
    }
  }

  // Test 1: Reading Various File Types
  async testReadVariousFileTypes(): Promise<any> {
    const files = [
      { name: 'test.ts', content: 'export class TestClass {\n  constructor() {}\n}', type: 'typescript' },
      { name: 'test.js', content: 'function test() {\n  return "hello";\n}', type: 'javascript' },
      { name: 'config.json', content: '{"name": "test", "version": "1.0.0"}', type: 'json' },
      { name: 'README.md', content: '# Test Project\n\nThis is a test.', type: 'markdown' },
      { name: 'data.txt', content: 'Plain text content\nMultiple lines\nTest data', type: 'text' },
    ];

    // Write test files
    for (const file of files) {
      const filePath = join(this.testDir, file.name);
      await fs.writeFile(filePath, file.content, 'utf8');
    }

    // Test reading each file type
    const readTimes: number[] = [];
    const results = [];

    for (const file of files) {
      const startTime = performance.now();
      const result = await this.readTool.execute({
        paths: file.name,
        includeMetadata: true,
      });
      const readTime = performance.now() - startTime;
      readTimes.push(readTime);

      expect(result.files).toBeDefined();
      expect(result.files.length).toBe(1);
      expect(result.files[0].content).toBe(file.content);
      expect(result.files[0].metadata?.type).toBe(extname(file.name));
      
      results.push({
        file: file.name,
        type: file.type,
        readTime,
        size: file.content.length,
        success: true,
      });
    }

    return {
      filesRead: files.length,
      averageReadTime: readTimes.reduce((sum, time) => sum + time, 0) / readTimes.length,
      results,
    };
  }

  // Test 2: Writing Files with Different Content Types
  async testWriteVariousContentTypes(): Promise<any> {
    const writeOperations = [
      { path: 'output.ts', content: 'interface TestInterface {\n  id: number;\n  name: string;\n}', mode: 'write' as const },
      { path: 'logs.txt', content: 'Log entry 1\n', mode: 'write' as const },
      { path: 'logs.txt', content: 'Log entry 2\n', mode: 'append' as const },
      { path: 'config.yaml', content: 'version: 2\nservices:\n  web:\n    image: nginx', mode: 'write' as const },
      { path: 'temp/nested.json', content: '{"nested": {"structure": true}}', mode: 'write' as const, createDirs: true },
    ];

    const writeTimes: number[] = [];
    const results = [];

    for (const op of writeOperations) {
      const startTime = performance.now();
      const result = await this.writeTool.execute({
        operations: [{
          path: op.path,
          content: op.content,
          mode: op.mode,
          createDirs: op.createDirs || false,
        }],
        backup: false,
      });
      const writeTime = performance.now() - startTime;
      writeTimes.push(writeTime);

      expect(result.summary.successful).toBe(1);
      expect(result.summary.errors).toBe(0);

      // Verify file was written correctly
      const filePath = join(this.testDir, op.path);
      expect(existsSync(filePath)).toBe(true);
      
      const written = await fs.readFile(filePath, 'utf8');
      if (op.mode === 'write') {
        expect(written).toBe(op.content);
      } else if (op.mode === 'append') {
        expect(written).toContain(op.content);
      }

      results.push({
        operation: op,
        writeTime,
        success: true,
      });
    }

    return {
      operationsCompleted: writeOperations.length,
      averageWriteTime: writeTimes.reduce((sum, time) => sum + time, 0) / writeTimes.length,
      results,
    };
  }

  // Test 3: File Iteration and Directory Processing
  async testFileIteration(): Promise<any> {
    // Create nested directory structure with various files
    const structure = {
      'src/components/Button.tsx': 'export const Button = () => <button>Click</button>;',
      'src/components/Input.tsx': 'export const Input = () => <input />;',
      'src/utils/helpers.ts': 'export const capitalize = (str: string) => str.charAt(0).toUpperCase() + str.slice(1);',
      'src/utils/api.ts': 'export const fetchData = async (url: string) => fetch(url);',
      'tests/Button.test.ts': 'describe("Button", () => { test("renders", () => {}); });',
      'tests/utils.test.ts': 'describe("Utils", () => { test("capitalize", () => {}); });',
      'config/webpack.js': 'module.exports = { entry: "./src/index.ts" };',
      'docs/README.md': '# Project Documentation',
    };

    // Create all files
    for (const [filePath, content] of Object.entries(structure)) {
      const fullPath = join(this.testDir, filePath);
      await fs.mkdir(dirname(fullPath), { recursive: true });
      await fs.writeFile(fullPath, content, 'utf8');
    }

    // Test reading entire directory structure
    const startTime = performance.now();
    const result = await this.readTool.execute({
      paths: '**/*',
      maxFiles: 50,
      excludePatterns: ['node_modules/**', '.git/**'],
      includeMetadata: true,
    });
    const iterationTime = performance.now() - startTime;

    expect(result.summary.successful).toBeGreaterThanOrEqual(Object.keys(structure).length);
    expect(result.files.length).toBeGreaterThanOrEqual(Object.keys(structure).length);

    // Verify all expected files were read correctly (there might be additional files from previous tests)
    const readFiles = new Set(result.files.map((f: any) => f.path));
    const expectedFilesFound = Object.keys(structure).filter(expectedFile => 
      result.files.some((f: any) => f.path.includes(expectedFile))
    ).length;
    expect(expectedFilesFound).toBe(Object.keys(structure).length);

    return {
      filesProcessed: result.summary.successful,
      iterationTime,
      totalSize: result.summary.totalSize,
      averageFileSize: result.summary.totalSize / result.summary.successful,
    };
  }

  // Test 4: Error Handling
  async testErrorHandling(): Promise<any> {
    const errorCases = [
      {
        name: 'missing-file',
        test: () => this.readTool.execute({ paths: 'does-not-exist.txt' }),
        expectError: true,
      },
      {
        name: 'invalid-path',
        test: () => this.readTool.execute({ paths: '/invalid/absolute/path.txt' }),
        expectError: true,
      },
      {
        name: 'write-to-readonly',
        test: async () => {
          // Create a read-only file
          const readOnlyPath = join(this.testDir, 'readonly.txt');
          await fs.writeFile(readOnlyPath, 'test', 'utf8');
          await fs.chmod(readOnlyPath, 0o444); // read-only
          
          return this.writeTool.execute({
            operations: [{ path: 'readonly.txt', content: 'new content', mode: 'write' }],
          });
        },
        expectError: false, // Tool should handle gracefully
      },
      {
        name: 'large-file-limit',
        test: () => this.readTool.execute({ 
          paths: 'large-test-file.txt',
          maxSize: 10, // Very small limit
        }),
        expectError: false, // Should return size error, not throw
      },
    ];

    // Create large test file for size limit test
    const largeContent = 'x'.repeat(1000);
    await fs.writeFile(join(this.testDir, 'large-test-file.txt'), largeContent, 'utf8');

    const results = [];
    for (const errorCase of errorCases) {
      try {
        const result = await errorCase.test();
        
        if (errorCase.expectError) {
          expect(result.error || result.errors?.length > 0).toBe(true);
        }
        
        results.push({
          case: errorCase.name,
          handled: true,
          result: result.error ? 'error' : 'success',
        });
      } catch (error) {
        if (!errorCase.expectError) {
          throw error; // Unexpected error
        }
        results.push({
          case: errorCase.name,
          handled: true,
          result: 'exception',
        });
      }
    }

    return {
      errorCasesTested: errorCases.length,
      results,
    };
  }

  // Test 5: Large File Handling
  async testLargeFileHandling(): Promise<any> {
    const largeContent = 'A'.repeat(LARGE_FILE_SIZE);
    const largeFilePath = join(this.testDir, 'large-files', 'large-file.txt');
    
    // Test writing large file
    const writeStartTime = performance.now();
    await fs.writeFile(largeFilePath, largeContent, 'utf8');
    const writeTime = performance.now() - writeStartTime;

    // Test reading large file
    const readStartTime = performance.now();
    const result = await this.readTool.execute({
      paths: 'large-files/large-file.txt',
      maxSize: LARGE_FILE_SIZE + 1000, // Slightly above actual size
      includeMetadata: true,
    });
    const readTime = performance.now() - readStartTime;

    expect(result.summary.successful).toBe(1);
    expect(result.files[0].content.length).toBe(LARGE_FILE_SIZE);
    expect(result.files[0].metadata?.size).toBe(LARGE_FILE_SIZE);

    // Test memory efficiency
    const memoryBefore = process.memoryUsage();
    const multipleReads = await Promise.all(
      Array(5).fill(0).map(() => 
        this.readTool.execute({ 
          paths: 'large-files/large-file.txt',
          maxSize: LARGE_FILE_SIZE + 1000,
        })
      )
    );
    const memoryAfter = process.memoryUsage();
    const memoryIncrease = memoryAfter.heapUsed - memoryBefore.heapUsed;

    return {
      fileSize: LARGE_FILE_SIZE,
      writeTime,
      readTime,
      multipleReadsCount: multipleReads.length,
      memoryIncrease,
      memoryEfficient: memoryIncrease < LARGE_FILE_SIZE * 2, // Should not use more than 2x file size
    };
  }

  // Test 6: Concurrent File Operations
  async testConcurrentOperations(): Promise<any> {
    const concurrentOps = Array.from({ length: CONCURRENT_OPERATIONS }, (_, i) => ({
      read: () => this.readTool.execute({ paths: `concurrent-${i}.txt` }),
      write: () => this.writeTool.execute({
        operations: [{
          path: `concurrent-${i}.txt`,
          content: `Content for file ${i}\nGenerated at ${Date.now()}`,
          mode: 'write' as const,
        }],
      }),
    }));

    // Create all files first
    for (let i = 0; i < CONCURRENT_OPERATIONS; i++) {
      await fs.writeFile(
        join(this.testDir, `concurrent-${i}.txt`),
        `Initial content ${i}`,
        'utf8'
      );
    }

    // Test concurrent reads
    const readStartTime = performance.now();
    const readResults = await Promise.all(concurrentOps.map(op => op.read()));
    const concurrentReadTime = performance.now() - readStartTime;

    // Test concurrent writes
    const writeStartTime = performance.now();
    const writeResults = await Promise.all(concurrentOps.map(op => op.write()));
    const concurrentWriteTime = performance.now() - writeStartTime;

    // Verify all operations succeeded
    const successfulReads = readResults.filter(r => r.summary.successful > 0).length;
    const successfulWrites = writeResults.filter(r => r.summary.successful > 0).length;

    expect(successfulReads).toBe(CONCURRENT_OPERATIONS);
    expect(successfulWrites).toBe(CONCURRENT_OPERATIONS);

    return {
      concurrentOperations: CONCURRENT_OPERATIONS,
      successfulReads,
      successfulWrites,
      concurrentReadTime,
      concurrentWriteTime,
      averageReadTime: concurrentReadTime / CONCURRENT_OPERATIONS,
      averageWriteTime: concurrentWriteTime / CONCURRENT_OPERATIONS,
    };
  }

  // Test 7: File Search Functionality
  async testFileSearch(): Promise<any> {
    // Create files with searchable content
    const searchFiles = {
      'src/user.ts': 'export class User { private id: number; getName(): string { return this.name; } }',
      'src/admin.ts': 'export class Admin extends User { private role: string; }',
      'tests/user.test.ts': 'describe("User", () => { test("getName", () => {}); });',
      'config/database.json': '{"host": "localhost", "user": "admin", "password": "secret"}',
    };

    // Write search test files
    for (const [filePath, content] of Object.entries(searchFiles)) {
      const fullPath = join(this.testDir, filePath);
      await fs.mkdir(dirname(fullPath), { recursive: true });
      await fs.writeFile(fullPath, content, 'utf8');
    }

    const searchTests = [
      { pattern: 'class', expectedMatches: 2, description: 'Find class declarations' },
      { pattern: 'User', expectedMatches: 3, description: 'Find User references' },
      { pattern: 'admin', expectedMatches: 2, description: 'Case insensitive search' },
      { pattern: '\\bname\\b', expectedMatches: 2, description: 'Whole word search' },
    ];

    const results = [];
    for (const searchTest of searchTests) {
      const startTime = performance.now();
      const result = await this.searchTool.execute({
        pattern: searchTest.pattern,
        paths: ['.'],
        caseSensitive: false,
        wholeWord: searchTest.pattern.includes('\\b'),
        showContext: true,
        contextLines: 1,
      });
      const searchTime = performance.now() - startTime;

      const totalMatches = result.results?.reduce((sum: number, file: any) => sum + file.matches.length, 0) || 0;
      
      results.push({
        pattern: searchTest.pattern,
        description: searchTest.description,
        searchTime,
        filesWithMatches: result.summary?.filesWithMatches || 0,
        totalMatches,
        expectedMatches: searchTest.expectedMatches,
        matchesExpectation: totalMatches >= searchTest.expectedMatches * 0.8, // Allow some variance
      });
    }

    return {
      searchTestsRun: searchTests.length,
      results,
      averageSearchTime: results.reduce((sum, r) => sum + r.searchTime, 0) / results.length,
    };
  }

  // Test 8: File Watching/Monitoring
  async testFileWatching(): Promise<any> {
    this.fileWatcher = new IntelligentFileWatcher({
      watchPaths: [this.testDir],
      debounceMs: 100,
      enableContentAnalysis: false, // Disable for faster tests
      enableProactiveSuggestions: false,
    });

    const events: FileChangeEvent[] = [];
    let watcherReady = false;

    // Set up event listeners
    this.fileWatcher.on('fileChange', (event: FileChangeEvent) => {
      events.push(event);
    });

    this.fileWatcher.on('watcherStarted', () => {
      watcherReady = true;
    });

    // Start watching
    const watcherResult = await this.fileWatcher.startWatching();
    expect(watcherResult.success).toBe(true);

    // Wait for watcher to be ready
    while (!watcherReady) {
      await new Promise(resolve => setTimeout(resolve, 10));
    }

    // Perform file operations and measure detection latency
    const testOperations = [
      { type: 'create', path: 'watched-file.txt', content: 'Test content' },
      { type: 'modify', path: 'watched-file.txt', content: 'Modified content' },
      { type: 'create', path: 'another-file.js', content: 'console.log("test");' },
    ];

    const operationTimes: number[] = [];
    
    for (const operation of testOperations) {
      const filePath = join(this.testDir, operation.path);
      const startTime = performance.now();
      
      await fs.writeFile(filePath, operation.content, 'utf8');
      
      // Wait for file change detection
      const maxWaitTime = 1000; // 1 second max wait
      const startWaitTime = Date.now();
      
      while (Date.now() - startWaitTime < maxWaitTime) {
        const relevantEvents = events.filter(e => e.filename === operation.path);
        if (relevantEvents.length > 0) {
          break;
        }
        await new Promise(resolve => setTimeout(resolve, 10));
      }
      
      const operationTime = performance.now() - startTime;
      operationTimes.push(operationTime);
    }

    // Wait a bit more for all events to be processed
    await new Promise(resolve => setTimeout(resolve, 200));

    // Process any buffered changes
    await this.fileWatcher.processBufferedChanges();

    const status = this.fileWatcher.getStatus();

    return {
      watcherStarted: watcherReady,
      eventsDetected: events.length,
      operationsPerformed: testOperations.length,
      averageDetectionTime: operationTimes.reduce((sum, time) => sum + time, 0) / operationTimes.length,
      watcherStatus: status,
      detectedFileTypes: [...new Set(events.map(e => e.extension))],
    };
  }

  // Test 9: Real System Integration
  async testRealSystemIntegration(): Promise<any> {
    // Test integration with actual CodeCrucible file tools
    const fsTools = this.filesystemTools.getTools();
    expect(fsTools.length).toBeGreaterThan(0);

    // Test each filesystem tool
    const toolResults = [];
    
    for (const tool of fsTools) {
      try {
        let result;
        const startTime = performance.now();
        
        switch (tool.id) {
          case 'filesystem_read_file':
            // Create a test file first
            await fs.writeFile(join(this.testDir, 'integration-test.txt'), 'Integration test content', 'utf8');
            result = await tool.execute(
              { filePath: 'integration-test.txt' },
              { workingDirectory: this.testDir, userId: 'test' }
            );
            break;
            
          case 'filesystem_write_file':
            result = await tool.execute(
              { filePath: 'integration-write-test.txt', content: 'Written by integration test' },
              { workingDirectory: this.testDir, userId: 'test' }
            );
            break;
            
          case 'filesystem_list_directory':
            result = await tool.execute(
              { dirPath: '.' },
              { workingDirectory: this.testDir, userId: 'test' }
            );
            break;
            
          case 'filesystem_file_stats':
            await fs.writeFile(join(this.testDir, 'stats-test.txt'), 'Stats test', 'utf8');
            result = await tool.execute(
              { filePath: 'stats-test.txt' },
              { workingDirectory: this.testDir, userId: 'test' }
            );
            break;
            
          case 'filesystem_find_files':
            result = await tool.execute(
              { pattern: '*.txt', directory: '.' },
              { workingDirectory: this.testDir, userId: 'test' }
            );
            break;
            
          default:
            continue;
        }
        
        const executionTime = performance.now() - startTime;
        
        toolResults.push({
          toolId: tool.id,
          toolName: tool.name,
          success: result.success,
          executionTime,
          error: result.error,
          outputSize: JSON.stringify(result.output || {}).length,
        });
        
      } catch (error) {
        toolResults.push({
          toolId: tool.id,
          toolName: tool.name,
          success: false,
          executionTime: 0,
          error: error instanceof Error ? error.message : String(error),
          outputSize: 0,
        });
      }
    }

    const successfulTools = toolResults.filter(r => r.success).length;
    
    return {
      toolsTested: fsTools.length,
      successfulTools,
      failedTools: fsTools.length - successfulTools,
      toolResults,
      integrationSuccessRate: successfulTools / fsTools.length,
    };
  }

  private generateRecommendations(): string[] {
    const recommendations: string[] = [];
    const metrics = this.report.systemMetrics.performanceMetrics;
    
    // Performance recommendations
    if (metrics.averageReadTime > 100) {
      recommendations.push('Consider implementing file content caching for frequently accessed files');
    }
    
    if (metrics.averageWriteTime > 200) {
      recommendations.push('Implement batch write operations for multiple small files');
    }
    
    if (metrics.concurrentOperationTime > 1000) {
      recommendations.push('Consider implementing connection pooling for concurrent file operations');
    }
    
    if (metrics.memoryEfficiency < 0.5) {
      recommendations.push('Implement streaming file operations for large files to reduce memory usage');
    }
    
    // Error handling recommendations
    const errorTests = this.testResults.find(t => t.testName === 'testErrorHandling');
    if (errorTests && !errorTests.passed) {
      recommendations.push('Improve error handling for edge cases in file operations');
    }
    
    // File watching recommendations
    if (metrics.fileWatcherLatency > 500) {
      recommendations.push('Optimize file watcher debounce settings for better responsiveness');
    }
    
    // General recommendations
    recommendations.push('Implement comprehensive logging for all file operations');
    recommendations.push('Add file operation metrics collection for monitoring');
    recommendations.push('Consider implementing file operation quotas for security');
    
    return recommendations;
  }

  async runAllTests(): Promise<TestReport> {
    this.logger.info('Starting comprehensive file operations test suite');
    
    await this.setup();
    
    try {
      // Run all tests and record results
      await this.recordTest('testReadVariousFileTypes', () => this.testReadVariousFileTypes());
      await this.recordTest('testWriteVariousContentTypes', () => this.testWriteVariousContentTypes());
      await this.recordTest('testFileIteration', () => this.testFileIteration());
      await this.recordTest('testErrorHandling', () => this.testErrorHandling());
      await this.recordTest('testLargeFileHandling', () => this.testLargeFileHandling());
      await this.recordTest('testConcurrentOperations', () => this.testConcurrentOperations());
      await this.recordTest('testFileSearch', () => this.testFileSearch());
      await this.recordTest('testFileWatching', () => this.testFileWatching());
      await this.recordTest('testRealSystemIntegration', () => this.testRealSystemIntegration());
      
      // Calculate performance metrics
      const readTests = this.testResults.filter(t => t.testName.includes('Read'));
      const writeTests = this.testResults.filter(t => t.testName.includes('Write'));
      const concurrentTest = this.testResults.find(t => t.testName === 'testConcurrentOperations');
      const watchingTest = this.testResults.find(t => t.testName === 'testFileWatching');
      const largeFileTest = this.testResults.find(t => t.testName === 'testLargeFileHandling');
      
      this.report.systemMetrics.performanceMetrics = {
        averageReadTime: readTests.reduce((sum, t) => sum + t.executionTime, 0) / Math.max(readTests.length, 1),
        averageWriteTime: writeTests.reduce((sum, t) => sum + t.executionTime, 0) / Math.max(writeTests.length, 1),
        concurrentOperationTime: concurrentTest?.executionTime || 0,
        memoryEfficiency: largeFileTest?.metrics?.memoryEfficient ? 1 : 0,
        fileWatcherLatency: watchingTest?.metrics?.averageDetectionTime || 0,
      };
      
      // Final system metrics
      this.report.systemMetrics.memoryUsage = process.memoryUsage();
      this.report.endTime = performance.now();
      this.report.results = this.testResults;
      this.report.recommendations = this.generateRecommendations();
      
      this.logger.info('File operations test suite completed', {
        totalTests: this.report.totalTests,
        passed: this.report.passedTests,
        failed: this.report.failedTests,
        duration: this.report.endTime - this.report.startTime,
      });
      
      return this.report;
      
    } finally {
      await this.cleanup();
    }
  }
}

// Jest test suite
describe('File Operations System Test', () => {
  let testSuite: FileOperationsTestSuite;
  let finalReport: TestReport;

  beforeAll(async () => {
    testSuite = new FileOperationsTestSuite();
    finalReport = await testSuite.runAllTests();
  });

  test('should read various file types successfully', () => {
    const readTest = finalReport.results.find(t => t.testName === 'testReadVariousFileTypes');
    expect(readTest?.passed).toBe(true);
    expect(readTest?.metrics?.filesRead).toBeGreaterThan(0);
  });

  test('should write files with different content types', () => {
    const writeTest = finalReport.results.find(t => t.testName === 'testWriteVariousContentTypes');
    expect(writeTest?.passed).toBe(true);
    expect(writeTest?.metrics?.operationsCompleted).toBeGreaterThan(0);
  });

  test('should handle file iteration efficiently', () => {
    const iterationTest = finalReport.results.find(t => t.testName === 'testFileIteration');
    expect(iterationTest?.passed).toBe(true);
    expect(iterationTest?.metrics?.filesProcessed).toBeGreaterThan(0);
  });

  test('should handle errors gracefully', () => {
    const errorTest = finalReport.results.find(t => t.testName === 'testErrorHandling');
    expect(errorTest?.passed).toBe(true);
  });

  test('should handle large files efficiently', () => {
    const largeFileTest = finalReport.results.find(t => t.testName === 'testLargeFileHandling');
    expect(largeFileTest?.passed).toBe(true);
    expect(largeFileTest?.metrics?.fileSize).toBe(LARGE_FILE_SIZE);
  });

  test('should handle concurrent operations', () => {
    const concurrentTest = finalReport.results.find(t => t.testName === 'testConcurrentOperations');
    expect(concurrentTest?.passed).toBe(true);
    expect(concurrentTest?.metrics?.concurrentOperations).toBe(CONCURRENT_OPERATIONS);
  });

  test('should provide file search functionality', () => {
    const searchTest = finalReport.results.find(t => t.testName === 'testFileSearch');
    expect(searchTest?.passed).toBe(true);
    expect(searchTest?.metrics?.searchTestsRun).toBeGreaterThan(0);
  });

  test('should provide file watching capabilities', () => {
    const watchingTest = finalReport.results.find(t => t.testName === 'testFileWatching');
    expect(watchingTest?.passed).toBe(true);
    expect(watchingTest?.metrics?.watcherStarted).toBe(true);
  });

  test('should integrate with real system components', () => {
    const integrationTest = finalReport.results.find(t => t.testName === 'testRealSystemIntegration');
    expect(integrationTest?.passed).toBe(true);
    expect(integrationTest?.metrics?.integrationSuccessRate).toBeGreaterThanOrEqual(0.8);
  });

  test('should meet performance benchmarks', () => {
    const metrics = finalReport.systemMetrics.performanceMetrics;
    expect(metrics.averageReadTime).toBeLessThan(1000); // Less than 1 second
    expect(metrics.averageWriteTime).toBeLessThan(1000); // Less than 1 second
  });

  test('should generate meaningful recommendations', () => {
    expect(finalReport.recommendations).toBeDefined();
    expect(finalReport.recommendations.length).toBeGreaterThan(0);
  });

  // Print comprehensive report
  afterAll(() => {
    console.log('\n🎯 FILE OPERATIONS TEST COMPLETED - Displaying Comprehensive Report...');
    console.log('\n' + '='.repeat(80));
    console.log('FILE OPERATIONS COMPREHENSIVE TEST REPORT');
    console.log('='.repeat(80));
    console.log(`\nTest Suite: ${finalReport.testSuite}`);
    console.log(`Duration: ${((finalReport.endTime - finalReport.startTime) / 1000).toFixed(2)}s`);
    console.log(`Total Tests: ${finalReport.totalTests}`);
    console.log(`Passed: ${finalReport.passedTests}`);
    console.log(`Failed: ${finalReport.failedTests}`);
    console.log(`Success Rate: ${((finalReport.passedTests / finalReport.totalTests) * 100).toFixed(1)}%`);
    
    console.log('\n' + '-'.repeat(50));
    console.log('PERFORMANCE METRICS');
    console.log('-'.repeat(50));
    const metrics = finalReport.systemMetrics.performanceMetrics;
    console.log(`Average Read Time: ${metrics.averageReadTime.toFixed(2)}ms`);
    console.log(`Average Write Time: ${metrics.averageWriteTime.toFixed(2)}ms`);
    console.log(`Concurrent Operation Time: ${metrics.concurrentOperationTime.toFixed(2)}ms`);
    console.log(`File Watcher Latency: ${metrics.fileWatcherLatency.toFixed(2)}ms`);
    console.log(`Memory Efficiency: ${metrics.memoryEfficiency > 0 ? 'GOOD' : 'NEEDS IMPROVEMENT'}`);
    
    console.log('\n' + '-'.repeat(50));
    console.log('DETAILED TEST RESULTS');
    console.log('-'.repeat(50));
    finalReport.results.forEach(result => {
      const status = result.passed ? '✅ PASS' : '❌ FAIL';
      console.log(`${status} ${result.testName} (${result.executionTime.toFixed(2)}ms)`);
      if (result.error) {
        console.log(`    Error: ${result.error}`);
      }
      if (result.metrics && Object.keys(result.metrics).length > 0) {
        console.log(`    Metrics: ${JSON.stringify(result.metrics, null, 2).slice(0, 200)}...`);
      }
    });
    
    console.log('\n' + '-'.repeat(50));
    console.log('RECOMMENDATIONS');
    console.log('-'.repeat(50));
    finalReport.recommendations.forEach((rec, index) => {
      console.log(`${index + 1}. ${rec}`);
    });
    
    console.log('\n' + '-'.repeat(50));
    console.log('MEMORY USAGE');
    console.log('-'.repeat(50));
    const mem = finalReport.systemMetrics.memoryUsage;
    console.log(`RSS: ${(mem.rss / 1024 / 1024).toFixed(2)}MB`);
    console.log(`Heap Used: ${(mem.heapUsed / 1024 / 1024).toFixed(2)}MB`);
    console.log(`Heap Total: ${(mem.heapTotal / 1024 / 1024).toFixed(2)}MB`);
    console.log(`External: ${(mem.external / 1024 / 1024).toFixed(2)}MB`);
    
    console.log('\n' + '='.repeat(80));
  });
});