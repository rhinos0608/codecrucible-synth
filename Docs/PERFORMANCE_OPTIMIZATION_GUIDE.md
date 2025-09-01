# Performance Optimization Implementation Guide

## Executive Summary

Current performance baseline: 7.5-15s for simple generation tasks (e.g., React component creation). This guide outlines strategies to optimize the TypeScript-based orchestration layer while maintaining architectural integrity.

## Performance Baseline & Targets

### Current Metrics
- **Simple Generation (React Component)**: 15s
- **Input → Processing → Generation Pipeline**: 7.5-15s
- **Environment**: Node.js/TypeScript
- **Scope**: CLI agent, multi-voice loop, dynamic MCP hooks

### Target Metrics
| Task | Current | Target | Priority |
|------|---------|---------|----------|
| React component generation | 15s | 7-9s | HIGH |
| File read/write operations | 1-3s | <500ms | MEDIUM |
| Model selection & routing | 1s | <200ms | HIGH |
| Multi-file refactoring | TBD | 10-20s | LOW |

## Bottleneck Analysis

### Primary Bottlenecks (Measured)
1. **LLM Inference (60-70%)**: 6-9s for Ollama/LM Studio calls
2. **Tool Execution (15-20%)**: 1-3s for fs operations
3. **Prompt Preparation (10%)**: 0.3-1s for context building
4. **Event Bus Overhead (5%)**: 0.5s streaming latency

## Implementation Phases

### Phase 1: Quick Wins (1-2 days)

#### 1.1 Profile Instrumentation
```typescript
// src/core/performance/profiler.ts
export class PerformanceProfiler {
  private timers = new Map<string, number>();
  
  startTimer(label: string): void {
    this.timers.set(label, performance.now());
  }
  
  stopTimer(label: string): number {
    const start = this.timers.get(label);
    if (!start) return 0;
    const duration = performance.now() - start;
    this.timers.delete(label);
    logger.debug(`[PERF] ${label}: ${duration.toFixed(2)}ms`);
    return duration;
  }
  
  async measure<T>(label: string, fn: () => Promise<T>): Promise<T> {
    this.startTimer(label);
    try {
      return await fn();
    } finally {
      this.stopTimer(label);
    }
  }
}
```

#### 1.2 Prompt Template Caching
```typescript
// src/core/prompts/prompt-cache.ts
export class PromptTemplateCache {
  private cache = new Map<string, CompiledPrompt>();
  
  async getOrCompile(key: string, template: string): Promise<CompiledPrompt> {
    if (this.cache.has(key)) {
      return this.cache.get(key)!;
    }
    
    const compiled = await this.compile(template);
    this.cache.set(key, compiled);
    return compiled;
  }
  
  private compile(template: string): CompiledPrompt {
    // Pre-tokenize, pre-format, pre-validate
    return {
      tokens: tokenize(template),
      metadata: extractMetadata(template),
      hash: crypto.createHash('md5').update(template).digest('hex')
    };
  }
}
```

#### 1.3 Async Tool Execution
```typescript
// src/core/tools/async-tool-executor.ts
export class AsyncToolExecutor {
  async executeWithStreaming(tool: ITool, args: any): Promise<void> {
    // Start LLM generation immediately
    const generationPromise = this.generateResponse(args);
    
    // Execute tools in parallel, non-blocking
    const toolPromise = this.executeToolAsync(tool, args);
    
    // Stream results as they arrive
    for await (const token of generationPromise) {
      yield token;
    }
    
    // Append tool results when ready
    const toolResult = await toolPromise;
    if (toolResult) {
      yield `\n\nTool Result: ${toolResult}`;
    }
  }
}
```

### Phase 2: Model Optimization (3-5 days)

#### 2.1 Tiered Model Selection
```typescript
// src/core/models/tiered-model-selector.ts
export class TieredModelSelector {
  private models = {
    fast: 'qwen2.5-coder:3b',      // 2-4s latency
    balanced: 'qwen2.5-coder:7b',   // 5-8s latency
    quality: 'deepseek-coder:15b'   // 10-15s latency
  };
  
  selectForTask(task: TaskType): string {
    switch(task.complexity) {
      case 'simple':  // React component, simple edits
        return this.models.fast;
      case 'medium':  // Multi-file refactor
        return this.models.balanced;
      case 'complex': // Architecture design
        return this.models.quality;
    }
  }
}
```

#### 2.2 Model Prewarming
```typescript
// src/core/models/model-prewarmer.ts
export class ModelPrewarmer {
  async prewarmModels(): Promise<void> {
    const models = ['qwen2.5-coder:3b', 'qwen2.5-coder:7b'];
    
    await Promise.all(models.map(async (model) => {
      // Send dummy request to load model into memory
      await this.client.generate({
        model,
        prompt: 'Hello',
        max_tokens: 1
      });
    }));
  }
}
```

### Phase 3: Infrastructure Optimization (1 week)

#### 3.1 Request Batching
```typescript
// src/core/performance/request-batcher.ts
export class RequestBatcher {
  private queue: PendingRequest[] = [];
  private flushTimer?: NodeJS.Timeout;
  
  async add(request: Request): Promise<Response> {
    return new Promise((resolve, reject) => {
      this.queue.push({ request, resolve, reject });
      this.scheduleFlush();
    });
  }
  
  private scheduleFlush(): void {
    if (this.flushTimer) return;
    
    this.flushTimer = setTimeout(() => {
      this.flush();
    }, 50); // 50ms batching window
  }
  
  private async flush(): Promise<void> {
    const batch = this.queue.splice(0, this.queue.length);
    if (batch.length === 0) return;
    
    // Process batch in parallel
    const results = await this.processBatch(batch);
    
    // Resolve individual promises
    batch.forEach((item, i) => {
      item.resolve(results[i]);
    });
  }
}
```

#### 3.2 Worker Thread Pool
```typescript
// src/core/workers/worker-pool.ts
import { Worker } from 'worker_threads';

export class WorkerPool {
  private workers: Worker[] = [];
  private queue: WorkerTask[] = [];
  
  constructor(size: number = 4) {
    for (let i = 0; i < size; i++) {
      this.workers.push(new Worker('./dist/core/workers/analysis-worker.js'));
    }
  }
  
  async execute<T>(task: WorkerTask): Promise<T> {
    const worker = await this.getAvailableWorker();
    return new Promise((resolve, reject) => {
      worker.postMessage(task);
      worker.once('message', resolve);
      worker.once('error', reject);
    });
  }
}
```

### Phase 4: Caching Strategy (3-4 days)

#### 4.1 Multi-Layer Cache
```typescript
// src/core/cache/multi-layer-cache.ts
export class MultiLayerCache {
  private l1: Map<string, CacheEntry> = new Map(); // Memory
  private l2?: Redis;  // Redis (optional)
  private l3?: S3;     // S3 (optional)
  
  async get(key: string): Promise<any> {
    // Check L1 (memory)
    if (this.l1.has(key)) {
      return this.l1.get(key)!.value;
    }
    
    // Check L2 (Redis)
    if (this.l2) {
      const value = await this.l2.get(key);
      if (value) {
        this.l1.set(key, { value, ttl: Date.now() + 300000 });
        return value;
      }
    }
    
    // Check L3 (S3)
    if (this.l3) {
      const value = await this.l3.getObject(key);
      if (value) {
        await this.promote(key, value);
        return value;
      }
    }
    
    return null;
  }
}
```

## Monitoring & Metrics

### Key Performance Indicators
```typescript
// src/core/monitoring/performance-metrics.ts
export interface PerformanceMetrics {
  // Latency metrics
  p50_latency_ms: number;
  p95_latency_ms: number;
  p99_latency_ms: number;
  
  // Throughput metrics
  requests_per_second: number;
  tokens_per_second: number;
  
  // Resource metrics
  memory_usage_mb: number;
  cpu_usage_percent: number;
  
  // Component metrics
  llm_latency_ms: number;
  tool_execution_ms: number;
  prompt_prep_ms: number;
}
```

### Performance Dashboard
```typescript
// src/core/monitoring/performance-dashboard.ts
export class PerformanceDashboard {
  private metrics: PerformanceMetrics[] = [];
  
  async displayRealtime(): Promise<void> {
    setInterval(() => {
      console.clear();
      console.log('=== Performance Dashboard ===');
      console.log(`P50 Latency: ${this.calculateP50()}ms`);
      console.log(`P95 Latency: ${this.calculateP95()}ms`);
      console.log(`RPS: ${this.calculateRPS()}`);
      console.log(`Memory: ${process.memoryUsage().heapUsed / 1024 / 1024}MB`);
    }, 1000);
  }
}
```

## Testing Strategy

### Performance Test Suite
```typescript
// tests/performance/generation.perf.test.ts
describe('Generation Performance', () => {
  it('should generate React component in <9s', async () => {
    const start = performance.now();
    
    await cli.execute('Generate a React button component');
    
    const duration = performance.now() - start;
    expect(duration).toBeLessThan(9000);
  });
  
  it('should handle 10 concurrent requests', async () => {
    const requests = Array(10).fill(null).map(() => 
      cli.execute('Generate a function')
    );
    
    const start = performance.now();
    await Promise.all(requests);
    const duration = performance.now() - start;
    
    expect(duration).toBeLessThan(30000); // <30s for 10 requests
  });
});
```

## Rollout Plan

### Week 1
- [ ] Implement performance profiler
- [ ] Add prompt caching
- [ ] Deploy async tool execution

### Week 2
- [ ] Implement tiered model selection
- [ ] Add model prewarming
- [ ] Deploy request batching

### Week 3
- [ ] Implement worker thread pool
- [ ] Add multi-layer caching
- [ ] Deploy performance dashboard

### Week 4
- [ ] Run performance test suite
- [ ] Tune based on metrics
- [ ] Document optimizations

## Success Criteria

1. **Primary Goal**: Reduce simple generation time from 15s to 7-9s
2. **Secondary Goal**: Improve P95 latency by 30%
3. **Tertiary Goal**: Support 10 concurrent requests without degradation

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Cache invalidation bugs | Implement TTL and versioning |
| Memory leaks from caching | Set max cache size limits |
| Worker thread crashes | Implement worker restart logic |
| Model switching overhead | Pre-warm frequently used models |

## Conclusion

This optimization guide focuses on the TypeScript orchestration layer without requiring a Rust rewrite. By implementing profiling, caching, async execution, and tiered model selection, we can achieve the target 7-9s generation time while maintaining code quality and architectural integrity.