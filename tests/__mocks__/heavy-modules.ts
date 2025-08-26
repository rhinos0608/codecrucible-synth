/**
 * Lightweight mocks for heavy modules to improve test performance
 * These mocks eliminate 30-50 second initialization overhead
 */

// Mock Domain-Aware Tool Orchestrator
export class DomainAwareToolOrchestrator {
  constructor() {}
  initialize = jest.fn().mockResolvedValue(undefined);
  registerTool = jest.fn();
  executeTool = jest.fn().mockResolvedValue({ success: true, result: 'mocked' });
  getTools = jest.fn().mockReturnValue([]);
  destroy = jest.fn();
}

// Mock MCP Server Manager
export class MCPServerManager {
  constructor() {}
  initialize = jest.fn().mockResolvedValue(undefined);
  startServer = jest.fn().mockResolvedValue(undefined);
  stopServer = jest.fn().mockResolvedValue(undefined);
  getServers = jest.fn().mockReturnValue([]);
  destroy = jest.fn();
}

// Mock CLI
export class CLI {
  constructor() {}
  initialize = jest.fn().mockResolvedValue(undefined);
  processCommand = jest.fn().mockResolvedValue({ success: true });
  destroy = jest.fn();
}

// Mock Unified Cache System
export class UnifiedCacheSystem {
  constructor() {}
  initialize = jest.fn().mockResolvedValue(undefined);
  get = jest.fn().mockResolvedValue(null);
  set = jest.fn().mockResolvedValue(undefined);
  clear = jest.fn().mockResolvedValue(undefined);
  destroy = jest.fn();
}

// Mock Security Audit Logger
export class SecurityAuditLogger {
  constructor() {}
  initialize = jest.fn().mockResolvedValue(undefined);
  logEvent = jest.fn();
  loadEvents = jest.fn().mockResolvedValue([]);
  destroy = jest.fn();
}

// Mock Tool Registration
export const mockTools = {
  FileReader: { id: 'file_reader', execute: jest.fn() },
  FileWriter: { id: 'file_writer', execute: jest.fn() },
  NetworkRequest: { id: 'network_request', execute: jest.fn() },
  SecureCodeExecutor: { id: 'secure_code_executor', execute: jest.fn() },
  DataAnalyzer: { id: 'data_analyzer', execute: jest.fn() }
};

// Export default mocks
export default {
  DomainAwareToolOrchestrator,
  MCPServerManager,
  CLI,
  UnifiedCacheSystem,
  SecurityAuditLogger,
  mockTools
};