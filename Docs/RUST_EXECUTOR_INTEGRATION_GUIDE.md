# Rust Executor Integration Guide

## Executive Summary

This guide outlines the strategic integration of Rust-based executors into the TypeScript orchestration layer. The approach is surgical and incremental - Rust serves as a performance and security enhancement for specific operations, not a wholesale replacement.

## Strategic Rationale

### When to Use Rust Executors
- **File I/O at scale**: Processing 1000+ files
- **Security-critical operations**: Sandboxed code execution
- **Performance bottlenecks**: Operations taking >500ms in Node
- **System-level operations**: Process management, syscall control
- **Deterministic execution**: Test runners, linters, formatters

### When NOT to Use Rust
- **Simple orchestration**: Keep in TypeScript
- **LLM interactions**: Stay with existing clients
- **UI/CLI rendering**: TypeScript excels here
- **Rapid prototyping**: TS iteration speed wins

## Architecture Overview

```
┌─────────────────────────────────────────────┐
│            TypeScript Layer                  │
│  (Orchestration, Planning, Routing)          │
└────────────────┬────────────────────────────┘
                 │ NDJSON Protocol
┌────────────────▼────────────────────────────┐
│            Rust Executor Layer               │
│  (File I/O, Sandboxing, Heavy Compute)       │
└─────────────────────────────────────────────┘
```

## Implementation Phases

### Phase 1: Foundation (Week 1)

#### 1.1 Rust Crate Structure
```rust
// rust/executor/Cargo.toml
[package]
name = "codecrucible-executor"
version = "0.1.0"
edition = "2021"

[dependencies]
serde = { version = "1.0", features = ["derive"] }
serde_json = "1.0"
tokio = { version = "1", features = ["full"] }
anyhow = "1.0"
tracing = "0.1"
napi = { version = "2", features = ["async"] }
napi-derive = "2"

[lib]
crate-type = ["cdylib"]
```

#### 1.2 Core Protocol Definition
```rust
// rust/executor/src/protocol.rs
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum Message {
    Hello {
        name: String,
        version: String,
        capabilities: Vec<String>,
    },
    Task {
        run_id: String,
        op: String,
        args: serde_json::Value,
        context: ExecutionContext,
    },
    Cancel {
        run_id: String,
    },
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ExecutionContext {
    pub working_dir: String,
    pub allowed_paths: Vec<String>,
    pub env: HashMap<String, String>,
    pub timeout_ms: u64,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(tag = "frame")]
pub enum Response {
    Log { run_id: String, level: String, message: String },
    Progress { run_id: String, percent: f32 },
    Result { run_id: String, status: String, data: serde_json::Value },
    Error { run_id: String, code: String, details: String },
}
```

#### 1.3 NAPI Bindings
```rust
// rust/executor/src/lib.rs
use napi::bindgen_prelude::*;
use napi_derive::napi;

#[napi]
pub struct RustExecutor {
    runtime: tokio::runtime::Runtime,
}

#[napi]
impl RustExecutor {
    #[napi(constructor)]
    pub fn new() -> Result<Self> {
        Ok(Self {
            runtime: tokio::runtime::Runtime::new()?,
        })
    }
    
    #[napi]
    pub async fn execute(&self, payload: String) -> Result<String> {
        let task: Message = serde_json::from_str(&payload)?;
        
        match task {
            Message::Task { op, args, context, .. } => {
                match op.as_str() {
                    "fs.read" => self.read_file(args, context).await,
                    "fs.write" => self.write_file(args, context).await,
                    "cmd.run" => self.run_command(args, context).await,
                    _ => Err(anyhow!("Unknown operation: {}", op).into()),
                }
            }
            _ => Err(anyhow!("Invalid message type").into()),
        }
    }
}
```

### Phase 2: Core Executors (Week 2)

#### 2.1 File System Executor
```rust
// rust/executor/src/fs_executor.rs
use std::path::{Path, PathBuf};
use tokio::fs;

pub struct FileSystemExecutor {
    sandbox_root: PathBuf,
}

impl FileSystemExecutor {
    pub fn new(sandbox_root: PathBuf) -> Self {
        Self { sandbox_root }
    }
    
    pub async fn read(&self, path: &str) -> Result<String> {
        let full_path = self.validate_path(path)?;
        
        // Apply resource limits
        let metadata = fs::metadata(&full_path).await?;
        if metadata.len() > 10_000_000 { // 10MB limit
            return Err(anyhow!("File too large"));
        }
        
        let content = fs::read_to_string(full_path).await?;
        Ok(content)
    }
    
    pub async fn write(&self, path: &str, content: &str) -> Result<()> {
        let full_path = self.validate_path(path)?;
        
        // Ensure parent directory exists
        if let Some(parent) = full_path.parent() {
            fs::create_dir_all(parent).await?;
        }
        
        fs::write(full_path, content).await?;
        Ok(())
    }
    
    fn validate_path(&self, path: &str) -> Result<PathBuf> {
        let path = Path::new(path);
        let canonical = path.canonicalize()?;
        
        // Ensure path is within sandbox
        if !canonical.starts_with(&self.sandbox_root) {
            return Err(anyhow!("Path outside sandbox"));
        }
        
        Ok(canonical)
    }
}
```

#### 2.2 Command Executor with Sandboxing
```rust
// rust/executor/src/cmd_executor.rs
use tokio::process::Command;
use std::time::Duration;

pub struct CommandExecutor {
    allowed_commands: Vec<String>,
}

impl CommandExecutor {
    pub async fn run(&self, cmd: &str, args: Vec<String>, timeout: Duration) -> Result<Output> {
        // Validate command
        if !self.allowed_commands.contains(&cmd.to_string()) {
            return Err(anyhow!("Command not allowed: {}", cmd));
        }
        
        // Create command with restrictions
        let mut command = Command::new(cmd);
        command.args(args);
        
        // Drop privileges (Unix only)
        #[cfg(unix)]
        {
            use std::os::unix::process::CommandExt;
            command.uid(1000); // Non-root user
            command.gid(1000);
        }
        
        // Set resource limits
        command.env("MALLOC_ARENA_MAX", "2");
        
        // Execute with timeout
        let output = tokio::time::timeout(
            timeout,
            command.output()
        ).await??;
        
        Ok(Output {
            stdout: String::from_utf8_lossy(&output.stdout).to_string(),
            stderr: String::from_utf8_lossy(&output.stderr).to_string(),
            status: output.status.code().unwrap_or(-1),
        })
    }
}
```

### Phase 3: TypeScript Integration (Week 2-3)

#### 3.1 TypeScript Wrapper
```typescript
// src/infrastructure/executors/rust-executor.ts
import { RustExecutor as NativeExecutor } from '../../../native/rust-executor.node';

export interface IRustExecutor {
  execute(op: string, args: any): Promise<any>;
  validatePath(path: string): boolean;
  getCapabilities(): string[];
}

export class RustExecutor implements IRustExecutor {
  private native: NativeExecutor;
  private capabilities: Set<string>;
  
  constructor() {
    this.native = new NativeExecutor();
    this.capabilities = new Set([
      'fs.read',
      'fs.write',
      'fs.list',
      'cmd.run',
      'lint.run',
      'test.run'
    ]);
  }
  
  async execute(op: string, args: any): Promise<any> {
    if (!this.capabilities.has(op)) {
      throw new Error(`Operation not supported: ${op}`);
    }
    
    const payload = JSON.stringify({
      type: 'Task',
      run_id: crypto.randomUUID(),
      op,
      args,
      context: this.buildContext()
    });
    
    const response = await this.native.execute(payload);
    return JSON.parse(response);
  }
  
  private buildContext(): ExecutionContext {
    return {
      working_dir: process.cwd(),
      allowed_paths: this.getAllowedPaths(),
      env: this.getSafeEnv(),
      timeout_ms: 30000
    };
  }
  
  private getAllowedPaths(): string[] {
    // Get from config or use defaults
    return [
      process.cwd(),
      '/tmp',
      os.homedir() + '/.cache'
    ];
  }
}
```

#### 3.2 Tool Registration
```typescript
// src/infrastructure/tools/rust-tool-adapter.ts
export class RustToolAdapter implements ITool {
  constructor(
    private executor: RustExecutor,
    private operation: string
  ) {}
  
  async execute(args: any): Promise<ToolResult> {
    try {
      const result = await this.executor.execute(this.operation, args);
      return {
        success: true,
        data: result
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }
  
  validate(args: any): ValidationResult {
    // Validate args based on operation
    switch(this.operation) {
      case 'fs.read':
        return this.validatePath(args.path);
      case 'cmd.run':
        return this.validateCommand(args.command);
      default:
        return { valid: true };
    }
  }
}
```

#### 3.3 Dependency Injection Integration
```typescript
// src/core/di/rust-executor-factory.ts
export class RustExecutorFactory {
  static register(container: DependencyContainer): void {
    // Register Rust executor
    container.register('RustExecutor', {
      useFactory: () => {
        if (!this.isRustEnabled()) {
          return null;
        }
        return new RustExecutor();
      },
      singleton: true
    });
    
    // Register Rust-backed tools
    container.register('RustFileTools', {
      useFactory: (executor: RustExecutor) => {
        if (!executor) return null;
        
        return {
          read: new RustToolAdapter(executor, 'fs.read'),
          write: new RustToolAdapter(executor, 'fs.write'),
          list: new RustToolAdapter(executor, 'fs.list')
        };
      },
      inject: ['RustExecutor']
    });
  }
  
  private static isRustEnabled(): boolean {
    return process.env.USE_RUST_EXECUTOR === 'true' ||
           config.get('executors.rust.enabled');
  }
}
```

### Phase 4: Advanced Features (Week 3-4)

#### 4.1 WASI Support
```rust
// rust/executor/src/wasi_executor.rs
use wasmtime::*;

pub struct WasiExecutor {
    engine: Engine,
    store: Store<()>,
}

impl WasiExecutor {
    pub fn new() -> Result<Self> {
        let engine = Engine::default();
        let mut store = Store::new(&engine, ());
        
        // Configure WASI
        let wasi = WasiCtxBuilder::new()
            .inherit_stdio()
            .preopened_dir("/sandbox", ".")?
            .build();
        
        store.data_mut().wasi = Some(wasi);
        
        Ok(Self { engine, store })
    }
    
    pub async fn execute_wasm(&mut self, module: &[u8]) -> Result<()> {
        let module = Module::new(&self.engine, module)?;
        let instance = Instance::new(&mut self.store, &module, &[])?;
        
        let start = instance.get_typed_func::<(), ()>(&mut self.store, "_start")?;
        start.call(&mut self.store, ())?;
        
        Ok(())
    }
}
```

#### 4.2 Performance Monitoring
```rust
// rust/executor/src/metrics.rs
use prometheus::{Counter, Histogram, register_counter, register_histogram};

pub struct ExecutorMetrics {
    pub operations: Counter,
    pub errors: Counter,
    pub duration: Histogram,
    pub memory_usage: Histogram,
}

impl ExecutorMetrics {
    pub fn new() -> Result<Self> {
        Ok(Self {
            operations: register_counter!("executor_operations_total", "Total operations")?,
            errors: register_counter!("executor_errors_total", "Total errors")?,
            duration: register_histogram!("executor_duration_seconds", "Operation duration")?,
            memory_usage: register_histogram!("executor_memory_bytes", "Memory usage")?,
        })
    }
    
    pub fn record_operation(&self, op: &str, duration: f64) {
        self.operations.inc();
        self.duration.observe(duration);
    }
}
```

## Build & Deployment

### Build Configuration
```json
// package.json additions
{
  "scripts": {
    "build:rust": "cd rust/executor && cargo build --release",
    "build:rust:napi": "cd rust/executor && napi build --platform --release ./native",
    "postinstall": "npm run build:rust:napi"
  },
  "napi": {
    "name": "rust-executor",
    "triples": {
      "defaults": true,
      "additional": [
        "x86_64-pc-windows-msvc",
        "x86_64-apple-darwin",
        "x86_64-unknown-linux-gnu"
      ]
    }
  }
}
```

### CI/CD Pipeline
```yaml
# .github/workflows/rust.yml
name: Rust Executor Build

on: [push, pull_request]

jobs:
  build:
    strategy:
      matrix:
        os: [ubuntu-latest, windows-latest, macos-latest]
    
    runs-on: ${{ matrix.os }}
    
    steps:
    - uses: actions/checkout@v2
    - uses: actions-rs/toolchain@v1
      with:
        toolchain: stable
    
    - name: Build Rust Executor
      run: |
        cd rust/executor
        cargo build --release
    
    - name: Build NAPI bindings
      run: npm run build:rust:napi
    
    - name: Upload artifacts
      uses: actions/upload-artifact@v2
      with:
        name: rust-executor-${{ matrix.os }}
        path: native/*.node
```

## Testing Strategy

### Rust Unit Tests
```rust
// rust/executor/src/tests.rs
#[cfg(test)]
mod tests {
    use super::*;
    
    #[tokio::test]
    async fn test_file_read_sandboxing() {
        let executor = FileSystemExecutor::new("/sandbox".into());
        
        // Should succeed - within sandbox
        assert!(executor.read("/sandbox/test.txt").await.is_ok());
        
        // Should fail - outside sandbox
        assert!(executor.read("/etc/passwd").await.is_err());
    }
    
    #[tokio::test]
    async fn test_command_timeout() {
        let executor = CommandExecutor::new();
        
        let result = executor.run(
            "sleep",
            vec!["10".to_string()],
            Duration::from_millis(100)
        ).await;
        
        assert!(result.is_err());
    }
}
```

### TypeScript Integration Tests
```typescript
// tests/integration/rust-executor.test.ts
describe('Rust Executor Integration', () => {
  let executor: RustExecutor;
  
  beforeAll(() => {
    executor = new RustExecutor();
  });
  
  test('should read file within sandbox', async () => {
    const result = await executor.execute('fs.read', {
      path: './test.txt'
    });
    
    expect(result).toBeDefined();
  });
  
  test('should reject path traversal', async () => {
    await expect(executor.execute('fs.read', {
      path: '../../../etc/passwd'
    })).rejects.toThrow('Path outside sandbox');
  });
  
  test('should enforce command timeout', async () => {
    await expect(executor.execute('cmd.run', {
      command: 'sleep',
      args: ['10'],
      timeout: 100
    })).rejects.toThrow('Timeout');
  });
});
```

## Performance Benchmarks

### Expected Performance Gains

| Operation | Node.js | Rust | Improvement |
|-----------|---------|------|-------------|
| Read 1000 files | 2500ms | 150ms | 16x |
| Parse large JSON | 800ms | 50ms | 16x |
| Run linter | 1200ms | 200ms | 6x |
| Sandbox spawn | 50ms | 5ms | 10x |
| Memory usage | 150MB | 25MB | 6x |

## Security Considerations

### Sandboxing Layers
1. **Path validation**: Canonical path checking
2. **Resource limits**: Memory, CPU, file size caps
3. **Process isolation**: Separate UID/GID (Unix)
4. **Network isolation**: Disabled by default
5. **Syscall filtering**: seccomp/Landlock (Linux)

### Security Audit Checklist
- [ ] Path traversal prevention
- [ ] Command injection prevention
- [ ] Resource exhaustion prevention
- [ ] Privilege escalation prevention
- [ ] Data leakage prevention

## Migration Strategy

### Phase 1: Optional Feature
- Feature flag: `USE_RUST_EXECUTOR=false`
- Fallback to Node.js implementation
- A/B testing with metrics

### Phase 2: Default for Heavy Ops
- Enable for file operations >100 files
- Enable for test runners
- Monitor performance impact

### Phase 3: Full Migration
- Make Rust default for all supported ops
- Keep Node.js for unsupported operations
- Deprecate Node.js implementations

## Conclusion

Rust executors provide surgical performance and security improvements without disrupting the TypeScript orchestration layer. By following this incremental approach, we maintain system stability while gaining significant performance in critical paths.