/**
 * End-to-End User Workflow Tests
 * Tests real customer workflows and use cases
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { exec } from 'child_process';
import { promisify } from 'util';
import { readFile, writeFile, unlink, access } from 'fs/promises';
import path from 'path';

const execAsync = promisify(exec);

describe('User Workflows', () => {
  const CLI_PATH = path.join(process.cwd(), 'dist', 'index.js');
  const TEST_FILE = path.join(process.cwd(), 'test-generated-file.js');

  beforeAll(async () => {
    // Ensure CLI is built
    try {
      await execAsync('npm run build');
    } catch (error) {
      console.warn('Build may have failed, continuing with existing dist');
    }
  }, 30000);

  afterAll(async () => {
    // Cleanup test files
    try {
      await unlink(TEST_FILE);
    } catch (error) {
      // File may not exist, ignore
    }
  });

  describe('Developer Code Generation Workflow', () => {
    it('should generate and analyze code in complete workflow', async () => {
      // Step 1: Generate code
      const { stdout: generateOutput } = await execAsync(
        `node "${CLI_PATH}" "Create a JavaScript function that calculates factorial and save it to test-generated-file.js"`,
        { timeout: 45000 }
      );

      expect(generateOutput).toContain('function');
      expect(generateOutput).toMatch(/factorial|test-generated-file/i);

      // Step 2: Verify file was mentioned/code was provided
      expect(generateOutput.length).toBeGreaterThan(50);

      // Step 3: Analyze the project status
      const { stdout: statusOutput } = await execAsync(`node "${CLI_PATH}" status`, {
        timeout: 30000,
      });

      expect(statusOutput).toContain('Status');
      expect(statusOutput).toMatch(/Available|Not available/);
    }, 80000);

    it('should handle file analysis workflow', async () => {
      // Create a test file to analyze
      const testCode = `
function testFunction() {
  return "Hello World";
}

module.exports = testFunction;
`;
      await writeFile(TEST_FILE, testCode);

      // Analyze the file
      const { stdout } = await execAsync(`node "${CLI_PATH}" analyze "${TEST_FILE}"`, {
        timeout: 40000,
      });

      expect(stdout).toMatch(/analysis|analyzing/i);
      expect(stdout).toContain(path.basename(TEST_FILE));

      // Verify file exists and is readable
      await access(TEST_FILE);
      const fileContent = await readFile(TEST_FILE, 'utf-8');
      expect(fileContent).toContain('testFunction');
    }, 45000);
  });

  describe('Help and Information Workflow', () => {
    it('should provide help information', async () => {
      const { stdout } = await execAsync(`node "${CLI_PATH}" --help`, {
        timeout: 20000,
      });

      expect(stdout).toMatch(/usage|help|options|commands/i);
      expect(stdout.length).toBeGreaterThan(100);
    }, 25000);

    it('should show system status', async () => {
      const { stdout } = await execAsync(`node "${CLI_PATH}" status`, {
        timeout: 40000,
      });

      expect(stdout).toMatch(/status|version|platform/i);
      expect(stdout).toMatch(/ollama|lm.studio/i);
    }, 45000);

    it('should list available models', async () => {
      const { stdout } = await execAsync(`node "${CLI_PATH}" models`, {
        timeout: 30000,
      });

      expect(stdout).toMatch(/models|available/i);
      // Should show either models available or indicate none found
      expect(stdout.length).toBeGreaterThan(20);
    }, 35000);
  });

  describe('Interactive Question Workflow', () => {
    it('should answer technical questions', async () => {
      const { stdout } = await execAsync(
        `node "${CLI_PATH}" "Explain what async/await does in JavaScript"`,
        { timeout: 45000 }
      );

      expect(stdout).toMatch(/async|await|promise|javascript/i);
      expect(stdout.length).toBeGreaterThan(50);
    }, 50000);

    it('should handle code explanation requests', async () => {
      const { stdout } = await execAsync(
        `node "${CLI_PATH}" "What does Array.prototype.map() do?"`,
        { timeout: 40000 }
      );

      expect(stdout).toMatch(/array|map|function|returns/i);
      expect(stdout.length).toBeGreaterThan(30);
    }, 45000);
  });

  describe('Error Handling Workflow', () => {
    it('should handle non-existent file analysis gracefully', async () => {
      const { stdout, stderr } = await execAsync(
        `node "${CLI_PATH}" analyze non-existent-file.js`,
        { timeout: 30000 }
      );

      // Should not crash, but may show error or handle gracefully
      expect(stdout.length + stderr.length).toBeGreaterThan(0);

      // Should not contain "Fatal error" or system crashes
      expect(stdout + stderr).not.toMatch(/fatal.*error/i);
    }, 35000);

    it('should handle malformed requests gracefully', async () => {
      const { stdout } = await execAsync(`node "${CLI_PATH}" ""`, { timeout: 25000 });

      // Should handle empty input without crashing
      expect(stdout.length).toBeGreaterThan(0);
    }, 30000);
  });

  describe('Advanced Feature Workflow', () => {
    it('should handle complex code generation requests', async () => {
      const { stdout } = await execAsync(
        `node "${CLI_PATH}" "Create a TypeScript class with constructor, private properties, and getter methods"`,
        { timeout: 50000 }
      );

      expect(stdout).toMatch(/class|constructor|private|getter|typescript/i);
      expect(stdout.length).toBeGreaterThan(100);
    }, 55000);

    it('should provide intelligent suggestions', async () => {
      const { stdout } = await execAsync(
        `node "${CLI_PATH}" "Best practices for error handling in Node.js"`,
        { timeout: 45000 }
      );

      expect(stdout).toMatch(/error|handling|node|best.*practice/i);
      expect(stdout.length).toBeGreaterThan(80);
    }, 50000);
  });

  describe('Security Validation Workflow', () => {
    it('should accept legitimate code analysis requests', async () => {
      const { stdout, stderr } = await execAsync(`node "${CLI_PATH}" analyze package.json`, {
        timeout: 40000,
      });

      // Security validation should pass
      expect(stderr).not.toMatch(/suspicious.*file.*operation/i);
      expect(stderr).not.toMatch(/security.*validation.*failed/i);
      expect(stdout).toMatch(/analysis|package/i);
    }, 45000);

    it('should handle legitimate file operations', async () => {
      const { stdout, stderr } = await execAsync(
        `node "${CLI_PATH}" "Analyze the structure of this project"`,
        { timeout: 40000 }
      );

      // Should not be blocked by security validation
      expect(stderr).not.toMatch(/input.*contains.*suspicious/i);
      expect(stdout.length).toBeGreaterThan(20);
    }, 45000);
  });

  describe('MCP Integration Workflow', () => {
    it('should initialize MCP servers successfully', async () => {
      const { stdout, stderr } = await execAsync(`node "${CLI_PATH}" status`, {
        timeout: 50000,
      });

      // Should show MCP initialization in logs
      const output = stdout + stderr;
      expect(output).toMatch(/mcp.*server|enhanced.*tool.*integration/i);

      // Should not show critical MCP failures
      expect(output).not.toMatch(/fatal.*mcp.*error/i);
    }, 55000);
  });
});
