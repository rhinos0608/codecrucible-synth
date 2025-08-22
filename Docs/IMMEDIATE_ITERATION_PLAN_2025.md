# CodeCrucible Synth - Immediate Iteration Plan
**Date:** August 23, 2025  
**Priority:** CRITICAL FIXES FIRST  
**Timeline:** Iterative approach - Fix blocking issues, then improve incrementally

---

## 🚨 ITERATION 1: CRITICAL SECURITY & BUILD FIXES (Week 1)

### Priority: STOP THE BLEEDING
These issues prevent basic functionality and create immediate security risks.

### 1.1 Fix Exposed Secrets (CRITICAL - Day 1)
```bash
# Current vulnerability in src/core/security/secrets-manager.ts
const MASTER_KEY = 'your-secret-master-key-here'; // EXPOSED
```

**Immediate Fix:**
```typescript
// Generate unique key per installation
import { randomBytes } from 'crypto';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

class SecretsManager {
  private masterKey: string;
  private keyFile = join(homedir(), '.codecrucible', 'key.dat');

  constructor() {
    this.masterKey = this.getOrCreateMasterKey();
  }

  private getOrCreateMasterKey(): string {
    if (existsSync(this.keyFile)) {
      return readFileSync(this.keyFile, 'utf8');
    } else {
      const newKey = randomBytes(32).toString('hex');
      writeFileSync(this.keyFile, newKey, { mode: 0o600 });
      return newKey;
    }
  }
}
```

### 1.2 Fix Command Injection (CRITICAL - Day 2)
```bash
# Current vulnerability
async executeCommandSecure(command: string, args: string[]): Promise<string> {
  return await execAsync(`${command} ${args.join(' ')}`); // VULNERABLE
}
```

**Immediate Fix:**
```typescript
import { spawn } from 'child_process';

class SecureCommandExecutor {
  private allowedCommands = ['git', 'npm', 'node', 'ls', 'cat'];
  
  async executeCommandSecure(command: string, args: string[]): Promise<string> {
    // Validate command
    if (!this.allowedCommands.includes(command)) {
      throw new Error(`Command not allowed: ${command}`);
    }
    
    // Sanitize arguments
    const sanitizedArgs = args.map(arg => this.sanitizeArg(arg));
    
    return new Promise((resolve, reject) => {
      const child = spawn(command, sanitizedArgs, {
        shell: false, // NEVER use shell: true
        stdio: ['pipe', 'pipe', 'pipe']
      });
      
      let stdout = '';
      let stderr = '';
      
      child.stdout?.on('data', (data) => stdout += data);
      child.stderr?.on('data', (data) => stderr += data);
      
      child.on('close', (code) => {
        if (code === 0) {
          resolve(stdout);
        } else {
          reject(new Error(`Command failed: ${stderr}`));
        }
      });
      
      // Timeout after 30 seconds
      setTimeout(() => {
        child.kill();
        reject(new Error('Command timeout'));
      }, 30000);
    });
  }

  private sanitizeArg(arg: string): string {
    // Remove dangerous characters
    return arg.replace(/[;&|`$()]/g, '');
  }
}
```

### 1.3 Fix Missing bin/crucible.js (Day 3)
```bash
# Missing file breaks npm global install
```

**Create bin/crucible.js:**
```javascript
#!/usr/bin/env node
'use strict';

const { join } = require('path');

// Handle both development and production environments
const distPath = join(__dirname, '..', 'dist', 'index.js');
const srcPath = join(__dirname, '..', 'src', 'index.ts');

try {
  // Try production build first
  const { existsSync } = require('fs');
  if (existsSync(distPath)) {
    require(distPath);
  } else if (existsSync(srcPath)) {
    // Development mode - use ts-node
    require('ts-node').register({
      project: join(__dirname, '..', 'tsconfig.json')
    });
    require(srcPath);
  } else {
    console.error('CodeCrucible not built. Run: npm run build');
    process.exit(1);
  }
} catch (error) {
  console.error('Failed to start CodeCrucible:', error.message);
  process.exit(1);
}
```

**Update package.json:**
```json
{
  "bin": {
    "crucible": "./bin/crucible.js",
    "cc": "./bin/crucible.js",
    "codecrucible": "./bin/crucible.js"
  },
  "files": [
    "dist/**/*",
    "bin/**/*",
    "config/**/*",
    "README.md",
    "LICENSE"
  ]
}
```

### 1.4 Fix TypeScript Configuration Chaos (Day 4)

**Consolidate to single tsconfig.json:**
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "removeComments": false,
    "noImplicitAny": true,
    "noImplicitThis": true,
    "noImplicitReturns": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true
  },
  "include": [
    "src/**/*"
  ],
  "exclude": [
    "node_modules",
    "dist",
    "tests",
    "**/*.test.ts"
  ]
}
```

**Remove conflicting configs:**
```bash
rm tsconfig.build.json tsconfig.strict.json
```

---

## 🔧 ITERATION 2: MEMORY LEAKS & ASYNC FIXES (Week 2)

### 2.1 Fix Memory Leaks (Day 5-6)
```typescript
// WRONG: Band-aid approach
process.setMaxListeners(50);

// RIGHT: Fix the root cause
class EventManager {
  private emitters = new Map<string, EventEmitter>();
  
  getEmitter(name: string): EventEmitter {
    if (!this.emitters.has(name)) {
      const emitter = new EventEmitter();
      emitter.setMaxListeners(5); // Reasonable limit
      this.emitters.set(name, emitter);
    }
    return this.emitters.get(name)!;
  }
  
  cleanup(): void {
    for (const [name, emitter] of this.emitters) {
      emitter.removeAllListeners();
    }
    this.emitters.clear();
  }
}
```

### 2.2 Fix Sync Operations in Async Functions (Day 7-8)
```typescript
// WRONG: Blocking async functions
async analyzeProjectStructure() {
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
  return packageJson;
}

// RIGHT: Proper async patterns
import { readFile } from 'fs/promises';

async analyzeProjectStructure(): Promise<PackageJson> {
  try {
    const content = await readFile(packageJsonPath, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    throw new Error(`Failed to read package.json: ${error.message}`);
  }
}
```

### 2.3 Implement Proper Error Handling (Day 9-10)
```typescript
// WRONG: Silent failures
catch (error) {
  // Continue with defaults
}

// RIGHT: Explicit error handling
class Result<T, E = Error> {
  constructor(
    public readonly success: boolean,
    public readonly data?: T,
    public readonly error?: E
  ) {}

  static ok<T>(data: T): Result<T> {
    return new Result(true, data);
  }

  static err<E>(error: E): Result<never, E> {
    return new Result(false, undefined, error);
  }
}

async function safeOperation(): Promise<Result<string>> {
  try {
    const result = await riskyOperation();
    return Result.ok(result);
  } catch (error) {
    logger.error('Operation failed', { error: error.message });
    return Result.err(error as Error);
  }
}
```

---

## 🏗️ ITERATION 3: BASIC FUNCTIONALITY RESTORATION (Week 3)

### 3.1 Fix CLI Command Structure
```typescript
// Use Commander.js for proper CLI structure
import { Command } from 'commander';

const program = new Command();

program
  .name('codecrucible')
  .description('AI-powered code analysis and generation')
  .version(packageVersion);

program
  .command('status')
  .description('Show system status')
  .action(async () => {
    const result = await statusCommand();
    if (!result.success) {
      console.error('Status check failed:', result.error);
      process.exit(1);
    }
    console.log(result.data);
  });

program
  .command('analyze')
  .argument('<file>', 'File to analyze')
  .option('-v, --verbose', 'Verbose output')
  .action(async (file, options) => {
    const result = await analyzeCommand(file, options);
    if (!result.success) {
      console.error('Analysis failed:', result.error);
      process.exit(1);
    }
    console.log(result.data);
  });
```

### 3.2 Implement Basic Voice System (Real, not fake)
```typescript
interface Voice {
  name: string;
  role: string;
  temperature: number;
  systemPrompt: string;
  generate(prompt: string): Promise<string>;
}

class SecurityVoice implements Voice {
  name = 'Security';
  role = 'security-expert';
  temperature = 0.2;
  systemPrompt = `You are a security expert focused on identifying vulnerabilities 
    and ensuring secure coding practices. Always prioritize security over convenience.`;

  async generate(prompt: string): Promise<string> {
    // Call actual LLM with security-focused system prompt
    return await this.callLLM(this.systemPrompt + '\n\n' + prompt);
  }

  private async callLLM(fullPrompt: string): Promise<string> {
    // Implement actual LLM call with proper error handling
    // This replaces the fake template system
  }
}

class VoiceOrchestrator {
  private voices: Map<string, Voice> = new Map();

  addVoice(voice: Voice): void {
    this.voices.set(voice.name, voice);
  }

  async synthesize(prompt: string, voiceNames: string[]): Promise<string> {
    const responses = await Promise.allSettled(
      voiceNames.map(async name => {
        const voice = this.voices.get(name);
        if (!voice) throw new Error(`Voice not found: ${name}`);
        return await voice.generate(prompt);
      })
    );

    // Actual synthesis logic (not just concatenation)
    return this.performActualSynthesis(responses, prompt);
  }

  private performActualSynthesis(
    responses: PromiseSettledResult<string>[],
    originalPrompt: string
  ): string {
    // Implement real synthesis algorithm
    // - Identify common themes
    // - Resolve conflicts
    // - Create unified response
    // This is complex and requires LLM-based analysis
  }
}
```

---

## 📊 ITERATION 4: TESTING FOUNDATION (Week 4)

### 4.1 Set Up Proper Testing Framework
```bash
# Install proper testing tools
npm install --save-dev jest @types/jest ts-jest
npm install --save-dev supertest @types/supertest  # For API testing
npm install --save-dev @testing-library/jest-dom   # For assertions
```

**jest.config.js:**
```javascript
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/tests'],
  testMatch: ['**/__tests__/**/*.ts', '**/?(*.)+(spec|test).ts'],
  transform: {
    '^.+\\.ts$': 'ts-jest',
  },
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/__tests__/**',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70,
    },
  },
};
```

### 4.2 Write Core Tests
```typescript
// tests/core/secrets-manager.test.ts
import { SecretsManager } from '../../src/core/security/secrets-manager';
import { existsSync, unlinkSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

describe('SecretsManager', () => {
  const keyFile = join(homedir(), '.codecrucible', 'key.dat');

  afterEach(() => {
    if (existsSync(keyFile)) {
      unlinkSync(keyFile);
    }
  });

  it('should generate master key on first run', () => {
    const manager = new SecretsManager();
    expect(existsSync(keyFile)).toBe(true);
  });

  it('should reuse existing master key', () => {
    const manager1 = new SecretsManager();
    const manager2 = new SecretsManager();
    // Keys should be identical
    expect(manager1.getMasterKey()).toBe(manager2.getMasterKey());
  });

  it('should encrypt and decrypt data correctly', () => {
    const manager = new SecretsManager();
    const originalData = 'sensitive information';
    const encrypted = manager.encrypt(originalData);
    const decrypted = manager.decrypt(encrypted);
    expect(decrypted).toBe(originalData);
    expect(encrypted).not.toBe(originalData);
  });
});
```

---

## ⚡ ITERATION 5: PERFORMANCE FIXES (Week 5)

### 5.1 Fix Caching System
```typescript
// Replace fake "semantic routing" with actual implementation
interface CacheItem<T> {
  data: T;
  timestamp: number;
  tags: string[];
  size: number;
}

class UnifiedCacheSystem {
  private cache = new Map<string, CacheItem<any>>();
  private maxSize = 100 * 1024 * 1024; // 100MB
  private currentSize = 0;

  async get<T>(key: string): Promise<T | null> {
    const item = this.cache.get(key);
    if (!item) return null;

    // Check if expired
    if (Date.now() - item.timestamp > 3600000) { // 1 hour
      this.delete(key);
      return null;
    }

    return item.data;
  }

  async set<T>(key: string, data: T, tags: string[] = []): Promise<void> {
    const size = this.calculateSize(data);
    
    // Evict if needed
    while (this.currentSize + size > this.maxSize) {
      this.evictLRU();
    }

    const item: CacheItem<T> = {
      data,
      timestamp: Date.now(),
      tags,
      size
    };

    this.cache.set(key, item);
    this.currentSize += size;
  }

  async delete(key: string): Promise<void> {
    const item = this.cache.get(key);
    if (item) {
      this.currentSize -= item.size;
      this.cache.delete(key);
    }
  }

  async clearByTags(tags: string[]): Promise<void> {
    for (const [key, item] of this.cache) {
      if (tags.some(tag => item.tags.includes(tag))) {
        this.delete(key);
      }
    }
  }

  private evictLRU(): void {
    let oldest: string | null = null;
    let oldestTime = Date.now();

    for (const [key, item] of this.cache) {
      if (item.timestamp < oldestTime) {
        oldestTime = item.timestamp;
        oldest = key;
      }
    }

    if (oldest) {
      this.delete(oldest);
    }
  }

  private calculateSize(data: any): number {
    return JSON.stringify(data).length * 2; // Approximate
  }
}
```

---

## 📋 ITERATION TRACKING

### Completion Checklist

**Iteration 1 - Critical Fixes:**
- [ ] Fix exposed secrets
- [ ] Fix command injection  
- [ ] Create bin/crucible.js
- [ ] Consolidate TypeScript config
- [ ] Test basic installation

**Iteration 2 - Memory & Async:**
- [ ] Fix memory leaks
- [ ] Convert sync to async
- [ ] Implement proper error handling
- [ ] Test memory usage

**Iteration 3 - Basic Functionality:**
- [ ] Implement proper CLI structure
- [ ] Create real voice system
- [ ] Test core commands work
- [ ] Verify voice orchestration

**Iteration 4 - Testing:**
- [ ] Set up Jest properly
- [ ] Write security tests
- [ ] Write core functionality tests
- [ ] Achieve 70% coverage minimum

**Iteration 5 - Performance:**
- [ ] Implement real caching
- [ ] Fix performance bottlenecks
- [ ] Add performance monitoring
- [ ] Profile and optimize

---

## 🚀 FUTURE ITERATIONS (Weeks 6-12)

**Iteration 6:** Real MCP Protocol Implementation  
**Iteration 7:** Comprehensive Security Audit  
**Iteration 8:** Documentation Accuracy  
**Iteration 9:** Production Deployment  
**Iteration 10:** Monitoring & Observability  
**Iteration 11:** User Experience Polish  
**Iteration 12:** Performance Optimization  

---

## Success Metrics

### Iteration 1 Success:
- [ ] `npm install -g codecrucible-synth` works
- [ ] `crucible --version` works  
- [ ] No exposed secrets in code
- [ ] No command injection vulnerabilities
- [ ] TypeScript compiles without warnings

### Iteration 2 Success:
- [ ] No memory warnings during operation
- [ ] All file operations are async
- [ ] Errors are properly logged and handled
- [ ] Process doesn't crash under normal load

### Overall Success:
- [ ] Test coverage > 70%
- [ ] No critical security vulnerabilities
- [ ] Basic CLI functionality works
- [ ] Documentation matches implementation
- [ ] Performance meets baseline requirements

---

*This iterative approach ensures critical issues are fixed first, allowing for incremental improvement while maintaining system stability.*