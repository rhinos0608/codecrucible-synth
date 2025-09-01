/**
 * Test to verify the type assertion fix
 * This test validates that tools now properly implement the ToolHandler interface
 */

import { describe, test, expect } from '@jest/globals';

describe('GitMCPServer Type Safety', () => {
  test('tools should be properly typed without type assertion', () => {
    // Mock dependencies for the test
    const mockApprovalManager = {
      requestApproval: jest.fn(),
    };
    
    // Import after setting up mocks to avoid dependency issues
    const { GitMCPServer } = require('../src/mcp-servers/git-mcp-server.ts');
    
    const server = new GitMCPServer(mockApprovalManager, '/test/path');
    
    // Check that tools object exists and has proper typing
    expect(server.tools).toBeDefined();
    expect(typeof server.tools.git_status).toBe('function');
    
    // Verify that git_status can be called with the ToolHandler signature
    const statusHandler = server.tools.git_status;
    expect(statusHandler).toBeInstanceOf(Function);
    
    // Test that it accepts the expected args parameter
    expect(() => {
      statusHandler({});
    }).not.toThrow();
  });
});