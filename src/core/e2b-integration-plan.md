# E2B Code Interpreter Integration Plan for CodeCrucible

## Executive Summary

This document outlines the integration of E2B Code Interpreter into CodeCrucible CLI to address critical security vulnerabilities in code execution and provide enterprise-grade sandboxed code execution capabilities.

## Current State Analysis

### Critical Security Issues Identified
- **Direct shell command execution** without sandboxing
- **Arbitrary code execution** in host environment  
- **Command injection vulnerabilities** in terminal tools
- **No resource limits** or isolation for spawned processes
- **Full environment variable access** including secrets

### Current Execution Points Requiring E2B Integration
1. `CodeExecutionTool` - Direct language execution
2. `TerminalExecuteTool` - Shell command execution
3. `AdvancedProcessTool` - Long-running process management
4. `PackageManagerTool` - Package installation commands

## E2B Integration Architecture

### 1. Core E2B Service Layer

```typescript
// src/core/e2b/e2b-service.ts
export class E2BService {
  private sandboxPool: Map<string, E2BSandbox> = new Map();
  private sessionManager: E2BSessionManager;
  
  async createSandbox(sessionId: string, environment?: string): Promise<E2BSandbox>
  async getSandbox(sessionId: string): Promise<E2BSandbox | null>
  async destroySandbox(sessionId: string): Promise<void>
  async executeCode(sessionId: string, code: string, language: string): Promise<ExecutionResult>
  async uploadFile(sessionId: string, filePath: string, content: string): Promise<void>
  async downloadFile(sessionId: string, filePath: string): Promise<string>
}
```

### 2. Sandbox Session Management

```typescript
// src/core/e2b/e2b-session-manager.ts
export class E2BSessionManager {
  private activeSessions: Map<string, SessionContext> = new Map();
  
  async createSession(agentId: string, userId?: string): Promise<string>
  async getSession(sessionId: string): Promise<SessionContext | null>
  async destroySession(sessionId: string): Promise<void>
  async cleanupExpiredSessions(): Promise<void>
  
  // Session lifecycle hooks
  onSessionCreated(callback: (sessionId: string) => void): void
  onSessionDestroyed(callback: (sessionId: string) => void): void
}

interface SessionContext {
  sessionId: string;
  sandboxId: string;
  agentId: string;
  userId?: string;
  createdAt: Date;
  lastUsed: Date;
  environment: string;
  resourceLimits: ResourceLimits;
}
```

### 3. Secure Execution Tools

```typescript
// src/core/tools/e2b/e2b-code-execution-tool.ts
export class E2BCodeExecutionTool extends BaseTool {
  constructor(
    private e2bService: E2BService,
    private sessionManager: E2BSessionManager,
    agentContext: AgentContext
  ) {
    super({
      name: 'executeCode',
      description: 'Execute code safely in an isolated E2B sandbox',
      inputSchema: z.object({
        code: z.string(),
        language: z.enum(['python', 'javascript', 'typescript', 'bash']),
        sessionId: z.string().optional(),
        timeout: z.number().optional().default(30000),
        resourceLimits: z.object({
          memory: z.string().optional(),
          cpu: z.string().optional()
        }).optional()
      })
    });
  }

  async execute(args: any): Promise<ExecutionResult> {
    const sessionId = args.sessionId || await this.getOrCreateSession();
    
    return await this.e2bService.executeCode(
      sessionId,
      args.code,
      args.language
    );
  }
  
  private async getOrCreateSession(): Promise<string> {
    // Session management logic
  }
}
```

### 4. File System Operations

```typescript
// src/core/tools/e2b/e2b-file-operations-tool.ts
export class E2BFileOperationsTool extends BaseTool {
  async execute(args: any): Promise<any> {
    const sessionId = await this.getSessionId();
    
    switch (args.operation) {
      case 'upload':
        return await this.e2bService.uploadFile(
          sessionId, 
          args.path, 
          args.content
        );
      case 'download':
        return await this.e2bService.downloadFile(
          sessionId, 
          args.path
        );
      case 'list':
        return await this.e2bService.executeCode(
          sessionId,
          `import os; print(os.listdir('${args.path}'))`,
          'python'
        );
    }
  }
}
```

### 5. Terminal Operations

```typescript
// src/core/tools/e2b/e2b-terminal-tool.ts
export class E2BTerminalTool extends BaseTool {
  async execute(args: any): Promise<any> {
    const sessionId = await this.getSessionId();
    
    // Validate command against security policies
    if (!this.isCommandSafe(args.command)) {
      throw new Error('Command not allowed by security policy');
    }
    
    return await this.e2bService.executeCode(
      sessionId,
      args.command,
      'bash'
    );
  }
  
  private isCommandSafe(command: string): boolean {
    // Enhanced security validation
    const dangerousPatterns = [
      /rm\s+-rf\s+\//, // Dangerous deletion
      /format\s+/, // Format commands
      /mkfs/, // Filesystem creation
      /dd\s+if=/, // Low-level disk operations
      /shutdown/, // System shutdown
      /reboot/, // System reboot
      /sudo\s+/, // Privilege escalation
      /su\s+/, // User switching
      /passwd/, // Password changes
      /chmod\s+777/, // Dangerous permissions
      /curl.*\|\s*bash/, // Pipe to shell
      /wget.*\|\s*sh/, // Download and execute
    ];
    
    return !dangerousPatterns.some(pattern => pattern.test(command));
  }
}
```

## Integration Strategy

### Phase 1: Core Infrastructure Setup

1. **Install E2B SDK**
```bash
npm install @e2b/code-interpreter
```

2. **Environment Configuration**
```typescript
// Add to config/default.yaml
e2b:
  apiKey: "${E2B_API_KEY}"
  defaultEnvironment: "base"
  sessionTimeout: 3600000 # 1 hour
  maxConcurrentSessions: 10
  resourceLimits:
    memory: "512MB"
    cpu: "0.5"
    diskSpace: "1GB"
```

3. **Service Registration**
```typescript
// src/core/cli.ts modifications
import { E2BService } from './e2b/e2b-service.js';
import { E2BSessionManager } from './e2b/e2b-session-manager.js';

class CLI {
  private e2bService: E2BService;
  private e2bSessionManager: E2BSessionManager;
  
  async initialize() {
    this.e2bSessionManager = new E2BSessionManager();
    this.e2bService = new E2BService(this.e2bSessionManager);
    
    // Replace unsafe tools with E2B tools
    this.initializeE2BTools();
  }
}
```

### Phase 2: Tool Migration

1. **Replace Unsafe Tools**
   - `CodeExecutionTool` → `E2BCodeExecutionTool`
   - `TerminalExecuteTool` → `E2BTerminalTool`
   - `AdvancedProcessTool` → `E2BProcessTool`

2. **Update Agent Tool Registration**
```typescript
// src/core/react-agent.ts
private initializeTools(): BaseTool[] {
  return [
    // Safe E2B tools
    new E2BCodeExecutionTool(this.e2bService, this.sessionManager, this.agentContext),
    new E2BTerminalTool(this.e2bService, this.sessionManager, this.agentContext),
    new E2BFileOperationsTool(this.e2bService, this.sessionManager, this.agentContext),
    
    // Keep safe tools
    new ReadFileTool(this.agentContext),
    new WriteFileTool(this.agentContext),
    // ... other safe tools
  ];
}
```

3. **Agent Context Integration**
```typescript
export interface AgentContext {
  workingDirectory: string;
  e2bSessionId?: string; // Add E2B session tracking
  // ... existing properties
}
```

### Phase 3: Security Enhancements

1. **Command Validation Framework**
```typescript
// src/core/e2b/security-validator.ts
export class SecurityValidator {
  static validateCommand(command: string): ValidationResult
  static validateCode(code: string, language: string): ValidationResult
  static validateFileOperation(operation: string, path: string): ValidationResult
}
```

2. **Audit Logging**
```typescript
// src/core/e2b/audit-logger.ts
export class E2BAuditLogger {
  logExecution(sessionId: string, code: string, result: ExecutionResult): void
  logSecurityViolation(sessionId: string, attempt: string, reason: string): void
  logResourceUsage(sessionId: string, usage: ResourceUsage): void
}
```

3. **Resource Monitoring**
```typescript
// src/core/e2b/resource-monitor.ts
export class ResourceMonitor {
  async getSessionUsage(sessionId: string): Promise<ResourceUsage>
  async enforceResourceLimits(sessionId: string): Promise<void>
  async alertOnThresholds(sessionId: string, thresholds: ResourceThresholds): Promise<void>
}
```

## Error Handling & Recovery

### Robust Error Handling
```typescript
export class E2BExecutionError extends Error {
  constructor(
    public sessionId: string,
    public code: string,
    public originalError: any,
    public executionContext: ExecutionContext
  ) {
    super(`E2B execution failed: ${originalError.message}`);
  }
}

// Error recovery strategies
export class E2BErrorRecovery {
  async handleExecutionError(error: E2BExecutionError): Promise<RecoveryResult> {
    switch (error.type) {
      case 'TIMEOUT':
        return await this.handleTimeout(error);
      case 'MEMORY_LIMIT':
        return await this.handleMemoryLimit(error);
      case 'SANDBOX_UNAVAILABLE':
        return await this.recreateSandbox(error);
      default:
        return await this.fallbackRecovery(error);
    }
  }
}
```

## Performance Optimizations

### Session Pooling
```typescript
export class E2BSandboxPool {
  private warmPool: E2BSandbox[] = [];
  private activePool: Map<string, E2BSandbox> = new Map();
  
  async getWarmSandbox(): Promise<E2BSandbox>
  async returnToPool(sandbox: E2BSandbox): Promise<void>
  async maintainPoolSize(targetSize: number): Promise<void>
}
```

### Caching Strategy
```typescript
export class E2BResultCache {
  private cache: Map<string, CachedResult> = new Map();
  
  async getCachedResult(codeHash: string): Promise<ExecutionResult | null>
  async cacheResult(codeHash: string, result: ExecutionResult): Promise<void>
  private generateCodeHash(code: string, language: string): string
}
```

## Migration Timeline

### Week 1: Infrastructure Setup
- Install E2B SDK
- Create core E2B services
- Set up configuration and authentication

### Week 2: Tool Migration
- Implement E2B-based execution tools
- Replace unsafe tools in agent configurations
- Add comprehensive testing

### Week 3: Security & Monitoring
- Implement security validation
- Add audit logging
- Set up resource monitoring

### Week 4: Testing & Optimization
- Performance testing and optimization
- Security penetration testing
- Production readiness assessment

## Success Metrics

### Security Improvements
- ✅ Zero direct host system command execution
- ✅ Complete sandbox isolation for all code execution
- ✅ Comprehensive audit trail for all operations
- ✅ Resource limits enforced for all sessions

### Performance Targets
- 🎯 Sandbox creation: <500ms
- 🎯 Code execution latency: <2s for typical operations
- 🎯 Session cleanup: <100ms
- 🎯 Resource utilization: <80% of allocated limits

### Reliability Goals
- 🎯 99.9% sandbox availability
- 🎯 <0.1% execution failure rate (excluding intentional errors)
- 🎯 Complete session recovery on failures
- 🎯 Zero data leakage between sessions

## Risk Mitigation

### Technical Risks
1. **E2B Service Availability**: Implement circuit breaker pattern and fallback mechanisms
2. **Performance Degradation**: Monitor execution times and implement optimization strategies
3. **Resource Exhaustion**: Implement strict resource limits and monitoring

### Security Risks
1. **Sandbox Escape**: Regular security audits and E2B platform updates
2. **Data Exfiltration**: Network isolation and output sanitization
3. **Resource Abuse**: Strict quotas and usage monitoring

This integration plan provides a comprehensive roadmap for securely implementing E2B Code Interpreter in CodeCrucible, addressing all identified security vulnerabilities while maintaining high performance and reliability.