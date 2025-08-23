# CodeCrucible Synth - Implementation Guide
## Step-by-Step Modernization with Code Examples

**Date:** August 23, 2025  
**Target Version:** v4.1.0  
**Implementation Timeline:** 6 months across 3 phases  
**Risk Level:** Medium (with proper testing)

---

## Overview

This guide provides **concrete implementation steps** with **complete code examples** to modernize CodeCrucible Synth according to the gap analysis findings. Each section includes migration paths, testing strategies, and rollback procedures.

### Implementation Philosophy
- 🔄 **Iterative Updates:** Small, testable changes
- 🔐 **Backward Compatibility:** Maintain existing APIs during transition
- 🧪 **Test-First:** Write tests before implementation
- 📈 **Performance Focused:** Monitor performance impact of changes

---

## Phase 1: Critical Modernization (Weeks 1-2)

### 1. Streaming Protocol Upgrade

**Goal:** Implement AI SDK v5.0 streaming lifecycle patterns  
**Files to Modify:** `src/core/streaming/streaming-manager.ts`, `src/core/client.ts`  
**Estimated Time:** 5-7 days

#### Step 1.1: Extend Streaming Types

Create new streaming types in `src/core/streaming/streaming-types.ts`:

```typescript
// src/core/streaming/streaming-types.ts
export interface StreamStartChunk {
  type: 'stream-start';
  warnings: Array<{
    code: string;
    message: string;
    severity: 'low' | 'medium' | 'high';
  }>;
}

export interface TextStartChunk {
  type: 'text-start';
  id: string;
  providerMetadata?: ProviderMetadata;
}

export interface TextDeltaChunk {
  type: 'text-delta';
  id: string;
  delta: string;
  providerMetadata?: ProviderMetadata;
}

export interface TextEndChunk {
  type: 'text-end';  
  id: string;
  providerMetadata?: ProviderMetadata;
}

export interface ToolCallStartChunk {
  type: 'tool-call-start';
  id: string;
  toolName: string;
  providerMetadata?: ProviderMetadata;
}

export interface ToolCallDeltaChunk {
  type: 'tool-call-delta';
  id: string;
  delta: string;
  providerMetadata?: ProviderMetadata;
}

export interface ToolCallEndChunk {
  type: 'tool-call-end';
  id: string;
  result: any;
  providerMetadata?: ProviderMetadata;
}

export interface ReasoningStartChunk {
  type: 'reasoning-start';
  id: string;
  providerMetadata?: ProviderMetadata;
}

export interface ReasoningDeltaChunk {
  type: 'reasoning-delta';
  id: string;
  delta: string;
  providerMetadata?: ProviderMetadata;
}

export interface ReasoningEndChunk {
  type: 'reasoning-end';
  id: string;
  providerMetadata?: ProviderMetadata;
}

export interface FinishChunk {
  type: 'finish';
  usage: {
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
  };
  finishReason: 'stop' | 'length' | 'content-filter' | 'tool-calls' | 'error';
  providerMetadata?: ProviderMetadata;
}

export type ModernStreamChunk = 
  | StreamStartChunk
  | TextStartChunk
  | TextDeltaChunk
  | TextEndChunk
  | ToolCallStartChunk
  | ToolCallDeltaChunk
  | ToolCallEndChunk
  | ReasoningStartChunk
  | ReasoningDeltaChunk
  | ReasoningEndChunk
  | FinishChunk;

export interface ProviderMetadata {
  requestId?: string;
  modelId?: string;
  timestamp?: number;
  [key: string]: any;
}
```

#### Step 1.2: Update StreamingManager

Replace current `StreamingManager` with modern implementation:

```typescript
// src/core/streaming/modern-streaming-manager.ts
import { EventEmitter } from 'events';
import { ModernStreamChunk, TextStartChunk, TextDeltaChunk, TextEndChunk } from './streaming-types.js';
import { logger } from '../logger.js';
import { v4 as uuidv4 } from 'uuid';

export class ModernStreamingManager extends EventEmitter implements IStreamingManager {
  private activeStreams = new Map<string, StreamState>();
  private chunkBuffer = new Map<string, ModernStreamChunk[]>();

  async *createFullStream(
    provider: string,
    request: ModelRequest
  ): AsyncGenerator<ModernStreamChunk> {
    const streamId = uuidv4();
    const textBlockId = uuidv4();
    
    try {
      // Start stream with warnings if any
      yield {
        type: 'stream-start',
        warnings: this.validateRequest(request)
      };

      // Start text block
      yield {
        type: 'text-start',
        id: textBlockId,
        providerMetadata: {
          requestId: streamId,
          modelId: request.model,
          timestamp: Date.now()
        }
      };

      // Get provider stream
      const providerStream = await this.getProviderStream(provider, request);
      
      for await (const chunk of providerStream) {
        if (chunk.type === 'text') {
          yield {
            type: 'text-delta',
            id: textBlockId,
            delta: chunk.content,
            providerMetadata: chunk.metadata
          };
        } else if (chunk.type === 'tool-call') {
          // Handle tool calls
          yield* this.handleToolCallStream(chunk);
        } else if (chunk.type === 'reasoning') {
          // Handle reasoning
          yield* this.handleReasoningStream(chunk);
        }
      }

      // End text block
      yield {
        type: 'text-end',
        id: textBlockId,
        providerMetadata: {
          requestId: streamId,
          timestamp: Date.now()
        }
      };

      // Finish stream
      yield {
        type: 'finish',
        usage: {
          inputTokens: request.inputTokens,
          outputTokens: this.calculateOutputTokens(),
          totalTokens: request.inputTokens + this.calculateOutputTokens()
        },
        finishReason: 'stop',
        providerMetadata: {
          requestId: streamId,
          timestamp: Date.now()
        }
      };

    } catch (error) {
      logger.error('Stream error:', error);
      yield {
        type: 'finish',
        usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
        finishReason: 'error',
        providerMetadata: { requestId: streamId, error: error.message }
      };
    }
  }

  private async *handleToolCallStream(toolChunk: any): AsyncGenerator<ModernStreamChunk> {
    const toolCallId = uuidv4();
    
    yield {
      type: 'tool-call-start',
      id: toolCallId,
      toolName: toolChunk.name,
      providerMetadata: { timestamp: Date.now() }
    };

    for (const deltaChunk of toolChunk.argumentDeltas) {
      yield {
        type: 'tool-call-delta',
        id: toolCallId,
        delta: deltaChunk,
        providerMetadata: { timestamp: Date.now() }
      };
    }

    // Execute tool and get result
    const result = await this.executeTool(toolChunk.name, toolChunk.arguments);
    
    yield {
      type: 'tool-call-end',
      id: toolCallId,
      result,
      providerMetadata: { timestamp: Date.now() }
    };
  }

  private async *handleReasoningStream(reasoningChunk: any): AsyncGenerator<ModernStreamChunk> {
    const reasoningId = uuidv4();
    
    yield {
      type: 'reasoning-start',
      id: reasoningId,
      providerMetadata: { timestamp: Date.now() }
    };

    for (const delta of reasoningChunk.deltas) {
      yield {
        type: 'reasoning-delta',
        id: reasoningId,
        delta,
        providerMetadata: { timestamp: Date.now() }
      };
    }

    yield {
      type: 'reasoning-end',
      id: reasoningId,
      providerMetadata: { timestamp: Date.now() }
    };
  }

  private validateRequest(request: ModelRequest): Array<any> {
    const warnings = [];
    
    if (request.prompt.length > 10000) {
      warnings.push({
        code: 'LARGE_PROMPT',
        message: 'Prompt exceeds recommended length',
        severity: 'medium' as const
      });
    }
    
    return warnings;
  }

  // ... other methods
}
```

#### Step 1.3: Update CLI to Handle New Stream Types

Modify `src/core/cli.ts` to process the new streaming format:

```typescript
// In src/core/cli.ts - add method to handle modern streams

async handleModernStream(
  stream: AsyncGenerator<ModernStreamChunk>,
  options: StreamHandlingOptions = {}
): Promise<void> {
  const activeTextBlocks = new Map<string, string>();
  const activeToolCalls = new Map<string, ToolCallState>();
  const activeReasoning = new Map<string, string>();

  try {
    for await (const chunk of stream) {
      switch (chunk.type) {
        case 'stream-start':
          if (chunk.warnings.length > 0) {
            this.display.showWarnings(chunk.warnings);
          }
          break;

        case 'text-start':
          activeTextBlocks.set(chunk.id, '');
          if (options.showBlockIds) {
            console.log(chalk.dim(`[Text Block ${chunk.id} started]`));
          }
          break;

        case 'text-delta':
          const currentText = activeTextBlocks.get(chunk.id) || '';
          activeTextBlocks.set(chunk.id, currentText + chunk.delta);
          process.stdout.write(chunk.delta);
          break;

        case 'text-end':
          if (options.showBlockIds) {
            console.log(chalk.dim(`\n[Text Block ${chunk.id} completed]`));
          }
          activeTextBlocks.delete(chunk.id);
          break;

        case 'tool-call-start':
          activeToolCalls.set(chunk.id, {
            name: chunk.toolName,
            arguments: '',
            status: 'running'
          });
          console.log(chalk.cyan(`\n🔧 Executing tool: ${chunk.toolName}`));
          break;

        case 'tool-call-delta':
          const toolCall = activeToolCalls.get(chunk.id);
          if (toolCall) {
            toolCall.arguments += chunk.delta;
            // Show progress indicator
            process.stdout.write(chalk.dim('.'));
          }
          break;

        case 'tool-call-end':
          const completedTool = activeToolCalls.get(chunk.id);
          if (completedTool) {
            console.log(chalk.green(`\n✅ Tool ${completedTool.name} completed`));
            if (options.showToolResults) {
              console.log(chalk.gray(JSON.stringify(chunk.result, null, 2)));
            }
          }
          activeToolCalls.delete(chunk.id);
          break;

        case 'reasoning-start':
          activeReasoning.set(chunk.id, '');
          console.log(chalk.yellow('\n🤔 Reasoning...'));
          break;

        case 'reasoning-delta':
          if (options.showReasoning) {
            const reasoning = activeReasoning.get(chunk.id) || '';
            activeReasoning.set(chunk.id, reasoning + chunk.delta);
            process.stdout.write(chalk.dim(chunk.delta));
          }
          break;

        case 'reasoning-end':
          if (options.showReasoning) {
            console.log(chalk.yellow('\n💡 Reasoning complete'));
          }
          activeReasoning.delete(chunk.id);
          break;

        case 'finish':
          console.log(chalk.dim('\n---'));
          if (chunk.usage.totalTokens) {
            console.log(chalk.dim(
              `Tokens used: ${chunk.usage.inputTokens} input + ${chunk.usage.outputTokens} output = ${chunk.usage.totalTokens} total`
            ));
          }
          if (chunk.finishReason !== 'stop') {
            console.log(chalk.yellow(`Finished: ${chunk.finishReason}`));
          }
          break;
      }
    }
  } catch (error) {
    logger.error('Error processing stream:', error);
    throw error;
  }
}

interface StreamHandlingOptions {
  showBlockIds?: boolean;
  showToolResults?: boolean;
  showReasoning?: boolean;
}

interface ToolCallState {
  name: string;
  arguments: string;
  status: 'running' | 'completed' | 'error';
}
```

#### Step 1.4: Testing Strategy

Create comprehensive tests for the new streaming system:

```typescript
// tests/streaming/modern-streaming.test.ts
import { describe, test, expect, jest } from '@jest/globals';
import { ModernStreamingManager } from '../../src/core/streaming/modern-streaming-manager.js';
import { ModernStreamChunk } from '../../src/core/streaming/streaming-types.js';

describe('ModernStreamingManager', () => {
  let streamingManager: ModernStreamingManager;

  beforeEach(() => {
    streamingManager = new ModernStreamingManager();
  });

  test('should emit proper stream lifecycle events', async () => {
    const chunks: ModernStreamChunk[] = [];
    const mockRequest = {
      prompt: 'Test prompt',
      model: 'test-model',
      inputTokens: 10
    };

    const stream = streamingManager.createFullStream('test-provider', mockRequest);
    
    for await (const chunk of stream) {
      chunks.push(chunk);
    }

    // Verify stream structure
    expect(chunks[0]).toEqual(
      expect.objectContaining({ type: 'stream-start' })
    );
    expect(chunks[1]).toEqual(
      expect.objectContaining({ type: 'text-start' })
    );
    expect(chunks[chunks.length - 1]).toEqual(
      expect.objectContaining({ type: 'finish' })
    );
  });

  test('should handle tool calls with proper lifecycle', async () => {
    // Test tool call streaming lifecycle
    const mockToolChunk = {
      type: 'tool-call',
      name: 'test-tool',
      arguments: { param: 'value' },
      argumentDeltas: ['{"param":', '"value"}']
    };

    const chunks = [];
    for await (const chunk of streamingManager.handleToolCallStream(mockToolChunk)) {
      chunks.push(chunk);
    }

    expect(chunks).toHaveLength(4); // start + 2 deltas + end
    expect(chunks[0].type).toBe('tool-call-start');
    expect(chunks[3].type).toBe('tool-call-end');
  });

  test('should handle errors gracefully', async () => {
    const mockRequest = {
      prompt: 'Error test',
      model: 'error-model',
      inputTokens: 5
    };

    // Mock provider to throw error
    jest.spyOn(streamingManager, 'getProviderStream')
      .mockRejectedValueOnce(new Error('Provider error'));

    const chunks: ModernStreamChunk[] = [];
    const stream = streamingManager.createFullStream('error-provider', mockRequest);
    
    for await (const chunk of stream) {
      chunks.push(chunk);
    }

    const finishChunk = chunks[chunks.length - 1];
    expect(finishChunk.type).toBe('finish');
    expect(finishChunk.finishReason).toBe('error');
  });
});
```

### 2. OpenTelemetry Integration

**Goal:** Add comprehensive observability with distributed tracing  
**Files to Create:** `src/core/observability/`, update existing managers  
**Estimated Time:** 3-5 days

#### Step 2.1: Install Dependencies

```bash
npm install @opentelemetry/api @opentelemetry/sdk-node @opentelemetry/instrumentation-http @opentelemetry/instrumentation-fs @opentelemetry/exporter-jaeger
```

#### Step 2.2: Create Telemetry Provider

```typescript
// src/core/observability/telemetry-provider.ts
import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import { trace, metrics, logs, Span } from '@opentelemetry/api';
import { logger } from '../logger.js';

export class TelemetryProvider {
  private sdk: NodeSDK;
  private tracer = trace.getTracer('codecrucible-synth', '4.1.0');
  private meter = metrics.getMeter('codecrucible-synth', '4.1.0');

  constructor(private config: TelemetryConfig) {
    this.sdk = new NodeSDK({
      resource: new Resource({
        [SemanticResourceAttributes.SERVICE_NAME]: 'codecrucible-synth',
        [SemanticResourceAttributes.SERVICE_VERSION]: '4.1.0',
        [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: config.environment || 'development'
      }),
      instrumentations: [getNodeAutoInstrumentations()]
    });
  }

  async initialize(): Promise<void> {
    try {
      this.sdk.start();
      logger.info('OpenTelemetry initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize OpenTelemetry:', error);
      throw error;
    }
  }

  async traceModelRequest<T>(
    operation: string,
    modelInfo: ModelInfo,
    fn: () => Promise<T>
  ): Promise<T> {
    return await this.tracer.startActiveSpan(operation, {
      attributes: {
        'codecrucible.operation': operation,
        'codecrucible.model.provider': modelInfo.provider,
        'codecrucible.model.name': modelInfo.name,
        'codecrucible.model.version': modelInfo.version
      }
    }, async (span: Span) => {
      try {
        const result = await fn();
        span.setStatus({ code: 1 }); // OK
        return result;
      } catch (error) {
        span.recordException(error as Error);
        span.setStatus({ code: 2, message: (error as Error).message }); // ERROR
        throw error;
      } finally {
        span.end();
      }
    });
  }

  recordMetric(name: string, value: number, attributes?: Record<string, any>): void {
    const counter = this.meter.createCounter(name);
    counter.add(value, attributes);
  }

  async shutdown(): Promise<void> {
    await this.sdk.shutdown();
    logger.info('OpenTelemetry shutdown complete');
  }
}

export interface TelemetryConfig {
  environment?: string;
  serviceName?: string;
  jaegerEndpoint?: string;
  enableTracing?: boolean;
  enableMetrics?: boolean;
  enableLogging?: boolean;
}

export interface ModelInfo {
  provider: string;
  name: string;
  version?: string;
}
```

#### Step 2.3: Integrate with UnifiedModelClient

```typescript
// Update src/core/client.ts to include telemetry

import { TelemetryProvider, ModelInfo } from './observability/telemetry-provider.js';

export class UnifiedModelClient extends EventEmitter implements IModelClient {
  private telemetry?: TelemetryProvider;

  constructor(
    config: UnifiedClientConfig,
    telemetry?: TelemetryProvider
  ) {
    super();
    this.telemetry = telemetry;
    // ... existing initialization
  }

  async processRequest(request: ModelRequest): Promise<ModelResponse> {
    const modelInfo: ModelInfo = {
      provider: request.provider || 'default',
      name: request.model || 'unknown',
      version: request.modelVersion
    };

    if (this.telemetry) {
      return await this.telemetry.traceModelRequest(
        'model.request',
        modelInfo,
        () => this._processRequestInternal(request)
      );
    } else {
      return await this._processRequestInternal(request);
    }
  }

  private async _processRequestInternal(request: ModelRequest): Promise<ModelResponse> {
    const startTime = Date.now();
    
    try {
      // Record request metrics
      if (this.telemetry) {
        this.telemetry.recordMetric('codecrucible.model.requests', 1, {
          provider: request.provider,
          model: request.model
        });
      }

      const response = await this.executeRequest(request);

      // Record success metrics
      if (this.telemetry) {
        this.telemetry.recordMetric('codecrucible.model.request.duration', 
          Date.now() - startTime,
          { 
            provider: request.provider, 
            model: request.model,
            status: 'success'
          }
        );
      }

      return response;
    } catch (error) {
      // Record error metrics
      if (this.telemetry) {
        this.telemetry.recordMetric('codecrucible.model.errors', 1, {
          provider: request.provider,
          model: request.model,
          error: error.constructor.name
        });
      }
      
      throw error;
    }
  }

  // ... rest of the class
}
```

#### Step 2.4: Create Observability Dashboard Config

```typescript
// src/core/observability/dashboard-config.ts
export const dashboardConfig = {
  metrics: [
    {
      name: 'Request Rate',
      query: 'rate(codecrucible_model_requests_total[5m])',
      type: 'line'
    },
    {
      name: 'Response Time P95',
      query: 'histogram_quantile(0.95, codecrucible_model_request_duration_bucket)',
      type: 'line'
    },
    {
      name: 'Error Rate',
      query: 'rate(codecrucible_model_errors_total[5m])',
      type: 'line'
    },
    {
      name: 'Active Streams',
      query: 'codecrucible_streaming_active_streams',
      type: 'gauge'
    }
  ],
  alerts: [
    {
      name: 'High Error Rate',
      condition: 'codecrucible_model_errors_total > 10',
      severity: 'critical'
    },
    {
      name: 'Slow Response Time',
      condition: 'codecrucible_model_request_duration > 30s',
      severity: 'warning'
    }
  ]
};
```

### 3. Agent Communication Enhancement

**Goal:** Extend VoiceArchetypeSystem with agent-to-agent communication  
**Files to Modify:** `src/voices/voice-archetype-system.ts`, create agent protocols  
**Estimated Time:** 7-10 days

#### Step 3.1: Define Agent Communication Protocol

```typescript
// src/core/agents/agent-protocol.ts
export interface Agent {
  id: string;
  name: string;
  capabilities: AgentCapability[];
  status: AgentStatus;
  
  // Core agent methods
  invoke(messages: Message[]): Promise<AgentResponse>;
  subscribe(eventType: string, handler: EventHandler): void;
  unsubscribe(eventType: string, handler: EventHandler): void;
  
  // Communication methods
  sendToAgent(agentId: string, message: InterAgentMessage): Promise<void>;
  broadcastMessage(message: InterAgentMessage, filter?: AgentFilter): Promise<void>;
  
  // Lifecycle methods
  start(): Promise<void>;
  stop(): Promise<void>;
  healthCheck(): Promise<HealthStatus>;
}

export interface InterAgentMessage {
  id: string;
  fromAgentId: string;
  toAgentId?: string; // undefined for broadcast
  type: MessageType;
  content: any;
  timestamp: Date;
  priority: MessagePriority;
  requiresResponse?: boolean;
  correlationId?: string;
}

export enum MessageType {
  REQUEST = 'request',
  RESPONSE = 'response',
  NOTIFICATION = 'notification',
  ERROR = 'error',
  HEARTBEAT = 'heartbeat'
}

export enum MessagePriority {
  LOW = 'low',
  NORMAL = 'normal', 
  HIGH = 'high',
  CRITICAL = 'critical'
}

export interface AgentCapability {
  name: string;
  description: string;
  inputSchema?: any;
  outputSchema?: any;
}

export enum AgentStatus {
  STARTING = 'starting',
  RUNNING = 'running',
  IDLE = 'idle',
  BUSY = 'busy',
  ERROR = 'error',
  STOPPING = 'stopping',
  STOPPED = 'stopped'
}

export interface AgentResponse {
  content: string;
  metadata: {
    agentId: string;
    processingTime: number;
    confidence?: number;
    sources?: string[];
  };
  followUpActions?: FollowUpAction[];
}

export interface FollowUpAction {
  type: 'delegate' | 'collaborate' | 'notify';
  targetAgent?: string;
  action: string;
  parameters?: any;
}
```

#### Step 3.2: Create Agent Bus for Communication

```typescript
// src/core/agents/agent-bus.ts
import { EventEmitter } from 'events';
import { InterAgentMessage, Agent, MessageType } from './agent-protocol.js';
import { logger } from '../logger.js';

export class AgentBus extends EventEmitter {
  private agents = new Map<string, Agent>();
  private messageQueue = new Map<string, InterAgentMessage[]>();
  private subscriptions = new Map<string, Set<Agent>>();

  registerAgent(agent: Agent): void {
    if (this.agents.has(agent.id)) {
      throw new Error(`Agent ${agent.id} is already registered`);
    }

    this.agents.set(agent.id, agent);
    this.messageQueue.set(agent.id, []);
    
    logger.info(`Agent ${agent.id} registered with bus`);
    this.emit('agent:registered', { agentId: agent.id });
  }

  unregisterAgent(agentId: string): void {
    const agent = this.agents.get(agentId);
    if (!agent) return;

    this.agents.delete(agentId);
    this.messageQueue.delete(agentId);
    
    // Clean up subscriptions
    for (const [topic, subscribers] of this.subscriptions) {
      subscribers.delete(agent);
    }

    logger.info(`Agent ${agentId} unregistered from bus`);
    this.emit('agent:unregistered', { agentId });
  }

  async sendMessage(message: InterAgentMessage): Promise<void> {
    if (message.toAgentId) {
      // Direct message
      await this.deliverToAgent(message.toAgentId, message);
    } else {
      // Broadcast message
      for (const [agentId] of this.agents) {
        if (agentId !== message.fromAgentId) {
          await this.deliverToAgent(agentId, message);
        }
      }
    }
  }

  private async deliverToAgent(agentId: string, message: InterAgentMessage): Promise<void> {
    const agent = this.agents.get(agentId);
    if (!agent) {
      logger.warn(`Agent ${agentId} not found for message delivery`);
      return;
    }

    try {
      // Add to queue first for reliability
      const queue = this.messageQueue.get(agentId) || [];
      queue.push(message);

      // Try immediate delivery
      await this.processMessageForAgent(agent, message);
      
      // Remove from queue on success
      const index = queue.indexOf(message);
      if (index > -1) {
        queue.splice(index, 1);
      }

    } catch (error) {
      logger.error(`Failed to deliver message to agent ${agentId}:`, error);
      
      // Handle failed delivery based on priority
      if (message.priority === 'critical') {
        setTimeout(() => this.deliverToAgent(agentId, message), 1000);
      }
    }
  }

  private async processMessageForAgent(agent: Agent, message: InterAgentMessage): Promise<void> {
    switch (message.type) {
      case MessageType.REQUEST:
        const response = await agent.invoke([{
          role: 'system',
          content: `Inter-agent request from ${message.fromAgentId}: ${JSON.stringify(message.content)}`
        }]);
        
        if (message.requiresResponse) {
          await this.sendMessage({
            id: `resp-${message.id}`,
            fromAgentId: agent.id,
            toAgentId: message.fromAgentId,
            type: MessageType.RESPONSE,
            content: response,
            timestamp: new Date(),
            priority: message.priority,
            correlationId: message.id
          });
        }
        break;

      case MessageType.NOTIFICATION:
        // Process notification without response
        agent.emit('notification', message);
        break;

      case MessageType.RESPONSE:
        // Handle response to previous request
        agent.emit('response', message);
        break;

      default:
        logger.warn(`Unknown message type: ${message.type}`);
    }
  }

  subscribe(agentId: string, topic: string): void {
    const agent = this.agents.get(agentId);
    if (!agent) return;

    if (!this.subscriptions.has(topic)) {
      this.subscriptions.set(topic, new Set());
    }
    
    this.subscriptions.get(topic)!.add(agent);
  }

  getAgentStatus(): Map<string, { agent: Agent, queueLength: number }> {
    const status = new Map();
    
    for (const [agentId, agent] of this.agents) {
      const queue = this.messageQueue.get(agentId) || [];
      status.set(agentId, {
        agent: agent,
        queueLength: queue.length
      });
    }
    
    return status;
  }
}
```

#### Step 3.3: Extend Voice Archetype System

```typescript
// Update src/voices/voice-archetype-system.ts to implement Agent interface

import { Agent, InterAgentMessage, AgentResponse, AgentCapability, AgentStatus } from '../core/agents/agent-protocol.js';
import { AgentBus } from '../core/agents/agent-bus.js';

export class VoiceArchetypeAgent implements Agent {
  public status: AgentStatus = AgentStatus.STOPPED;
  private agentBus?: AgentBus;
  private eventHandlers = new Map<string, Set<Function>>();

  constructor(
    public id: string,
    public name: string,
    public capabilities: AgentCapability[],
    private voice: Voice,
    private modelClient: any
  ) {}

  async invoke(messages: Message[]): Promise<AgentResponse> {
    this.status = AgentStatus.BUSY;
    const startTime = Date.now();

    try {
      // Use the voice's system prompt and configuration
      const response = await this.modelClient.processRequest({
        messages: [
          { role: 'system', content: this.voice.systemPrompt },
          ...messages
        ],
        temperature: this.voice.temperature,
        model: this.voice.preferredModel || 'default'
      });

      const processingTime = Date.now() - startTime;
      this.status = AgentStatus.IDLE;

      return {
        content: response.content,
        metadata: {
          agentId: this.id,
          processingTime,
          confidence: response.confidence,
          voiceArchetype: this.voice.name
        },
        followUpActions: this.analyzeForFollowUpActions(response.content)
      };

    } catch (error) {
      this.status = AgentStatus.ERROR;
      throw error;
    }
  }

  async sendToAgent(agentId: string, message: InterAgentMessage): Promise<void> {
    if (!this.agentBus) {
      throw new Error('Agent not connected to bus');
    }

    message.fromAgentId = this.id;
    message.toAgentId = agentId;
    await this.agentBus.sendMessage(message);
  }

  async broadcastMessage(message: InterAgentMessage): Promise<void> {
    if (!this.agentBus) {
      throw new Error('Agent not connected to bus');
    }

    message.fromAgentId = this.id;
    await this.agentBus.sendMessage(message);
  }

  connectToBus(bus: AgentBus): void {
    this.agentBus = bus;
    bus.registerAgent(this);
    
    // Subscribe to relevant events
    this.subscribe('collaboration-request', this.handleCollaborationRequest.bind(this));
    this.subscribe('knowledge-share', this.handleKnowledgeShare.bind(this));
  }

  subscribe(eventType: string, handler: Function): void {
    if (!this.eventHandlers.has(eventType)) {
      this.eventHandlers.set(eventType, new Set());
    }
    this.eventHandlers.get(eventType)!.add(handler);
  }

  unsubscribe(eventType: string, handler: Function): void {
    const handlers = this.eventHandlers.get(eventType);
    if (handlers) {
      handlers.delete(handler);
    }
  }

  async start(): Promise<void> {
    this.status = AgentStatus.STARTING;
    // Initialize agent resources
    await this.initializeResources();
    this.status = AgentStatus.IDLE;
  }

  async stop(): Promise<void> {
    this.status = AgentStatus.STOPPING;
    // Cleanup resources
    await this.cleanupResources();
    this.status = AgentStatus.STOPPED;
  }

  async healthCheck(): Promise<HealthStatus> {
    return {
      status: this.status,
      lastActivity: new Date(),
      memoryUsage: process.memoryUsage(),
      uptime: process.uptime()
    };
  }

  private analyzeForFollowUpActions(response: string): FollowUpAction[] {
    const actions = [];
    
    // Analyze response for delegation patterns
    if (response.includes('@security')) {
      actions.push({
        type: 'delegate',
        targetAgent: 'security',
        action: 'security-review',
        parameters: { content: response }
      });
    }
    
    if (response.includes('@architect')) {
      actions.push({
        type: 'collaborate',
        targetAgent: 'architect', 
        action: 'design-review',
        parameters: { proposal: response }
      });
    }

    return actions;
  }

  private async handleCollaborationRequest(message: InterAgentMessage): Promise<void> {
    // Handle requests for collaboration from other agents
    const response = await this.invoke([{
      role: 'user',
      content: `Collaboration request: ${JSON.stringify(message.content)}`
    }]);

    // Send response back
    if (message.requiresResponse) {
      await this.sendToAgent(message.fromAgentId, {
        id: `collab-resp-${Date.now()}`,
        fromAgentId: this.id,
        type: MessageType.RESPONSE,
        content: response,
        timestamp: new Date(),
        priority: message.priority,
        correlationId: message.id
      });
    }
  }

  private async handleKnowledgeShare(message: InterAgentMessage): Promise<void> {
    // Process shared knowledge from other agents
    logger.info(`Agent ${this.id} received knowledge from ${message.fromAgentId}:`, message.content);
    // Store or process the shared knowledge
  }

  private async initializeResources(): Promise<void> {
    // Initialize any agent-specific resources
  }

  private async cleanupResources(): Promise<void> {
    // Cleanup agent resources
  }
}
```

#### Step 3.4: Update VoiceArchetypeSystem to Support Agent Communication

```typescript
// Update the main VoiceArchetypeSystem class

export class VoiceArchetypeSystem {
  private agents = new Map<string, VoiceArchetypeAgent>();
  private agentBus = new AgentBus();

  constructor(modelClient?: any, config?: VoiceConfig) {
    // ... existing initialization
    
    // Initialize agent bus
    this.setupAgentBus();
  }

  private setupAgentBus(): void {
    // Set up event handlers for the agent bus
    this.agentBus.on('agent:registered', (event) => {
      logger.info(`Agent registered: ${event.agentId}`);
    });

    this.agentBus.on('agent:unregistered', (event) => {
      logger.info(`Agent unregistered: ${event.agentId}`);
    });
  }

  private initializeVoices() {
    // ... existing voice initialization

    // Convert voices to agents
    for (const [voiceId, voice] of this.voices) {
      const capabilities = this.getCapabilitiesForVoice(voiceId);
      const agent = new VoiceArchetypeAgent(
        voiceId,
        voice.name,
        capabilities,
        voice,
        this.modelClient
      );

      this.agents.set(voiceId, agent);
      agent.connectToBus(this.agentBus);
    }
  }

  private getCapabilitiesForVoice(voiceId: string): AgentCapability[] {
    const capabilityMap: Record<string, AgentCapability[]> = {
      explorer: [
        { name: 'innovation', description: 'Generate innovative solutions and ideas' },
        { name: 'research', description: 'Conduct research on new technologies' }
      ],
      maintainer: [
        { name: 'code-review', description: 'Review code for quality and maintainability' },
        { name: 'refactoring', description: 'Suggest code improvements and refactoring' }
      ],
      security: [
        { name: 'security-audit', description: 'Perform security audits and vulnerability assessment' },
        { name: 'threat-modeling', description: 'Create threat models for systems' }
      ],
      architect: [
        { name: 'system-design', description: 'Design system architecture and patterns' },
        { name: 'scalability-planning', description: 'Plan for system scalability' }
      ]
      // ... other voice capabilities
    };

    return capabilityMap[voiceId] || [];
  }

  async orchestrateAgentCollaboration(
    task: string,
    requiredCapabilities: string[] = []
  ): Promise<CollaborationResult> {
    // Select agents based on required capabilities
    const selectedAgents = this.selectAgentsForTask(requiredCapabilities);
    
    if (selectedAgents.length === 0) {
      throw new Error('No agents available for the requested capabilities');
    }

    const collaborationId = `collab-${Date.now()}`;
    const results = new Map<string, AgentResponse>();

    // Start collaboration
    logger.info(`Starting collaboration ${collaborationId} with agents: ${selectedAgents.map(a => a.id).join(', ')}`);

    for (const agent of selectedAgents) {
      const response = await agent.invoke([{
        role: 'user',
        content: `Collaboration task (${collaborationId}): ${task}`
      }]);

      results.set(agent.id, response);

      // Process any follow-up actions
      if (response.followUpActions) {
        await this.processFollowUpActions(agent, response.followUpActions);
      }
    }

    return {
      collaborationId,
      task,
      participants: selectedAgents.map(a => a.id),
      results,
      synthesizedResult: await this.synthesizeResults(results)
    };
  }

  private selectAgentsForTask(requiredCapabilities: string[]): VoiceArchetypeAgent[] {
    if (requiredCapabilities.length === 0) {
      // Return default agents if no specific capabilities required
      return Array.from(this.agents.values()).slice(0, 3);
    }

    return Array.from(this.agents.values()).filter(agent =>
      requiredCapabilities.some(capability =>
        agent.capabilities.some(cap => cap.name === capability)
      )
    );
  }

  private async processFollowUpActions(
    sourceAgent: VoiceArchetypeAgent,
    actions: FollowUpAction[]
  ): Promise<void> {
    for (const action of actions) {
      switch (action.type) {
        case 'delegate':
          if (action.targetAgent) {
            await sourceAgent.sendToAgent(action.targetAgent, {
              id: `action-${Date.now()}`,
              fromAgentId: sourceAgent.id,
              type: MessageType.REQUEST,
              content: { action: action.action, parameters: action.parameters },
              timestamp: new Date(),
              priority: 'normal',
              requiresResponse: true
            });
          }
          break;

        case 'collaborate':
          if (action.targetAgent) {
            await sourceAgent.sendToAgent(action.targetAgent, {
              id: `collab-${Date.now()}`,
              fromAgentId: sourceAgent.id,
              type: MessageType.NOTIFICATION,
              content: { type: 'collaboration-request', ...action.parameters },
              timestamp: new Date(),
              priority: 'normal'
            });
          }
          break;

        case 'notify':
          await sourceAgent.broadcastMessage({
            id: `notify-${Date.now()}`,
            fromAgentId: sourceAgent.id,
            type: MessageType.NOTIFICATION,
            content: { notification: action.action, parameters: action.parameters },
            timestamp: new Date(),
            priority: 'low'
          });
          break;
      }
    }
  }

  private async synthesizeResults(results: Map<string, AgentResponse>): Promise<string> {
    // Use a synthesis agent or the coordinator to combine results
    const allResponses = Array.from(results.entries())
      .map(([agentId, response]) => `${agentId}: ${response.content}`)
      .join('\n\n');

    // This could be enhanced with a dedicated synthesis model
    return `Synthesized results from ${results.size} agents:\n\n${allResponses}`;
  }

  getAgentBusStatus(): any {
    return this.agentBus.getAgentStatus();
  }
}

interface CollaborationResult {
  collaborationId: string;
  task: string;
  participants: string[];
  results: Map<string, AgentResponse>;
  synthesizedResult: string;
}

interface HealthStatus {
  status: AgentStatus;
  lastActivity: Date;
  memoryUsage: any;
  uptime: number;
}
```

---

## Phase 2: Feature Parity (Months 1-2)

### 4. Tool Calling Modernization

**Goal:** Implement streaming tool calls with modern error handling  
**Estimated Time:** 5-8 days

#### Step 4.1: Modern Tool Interface

```typescript
// src/core/tools/modern-tool-interface.ts
export interface ModernTool {
  name: string;
  description: string;
  inputSchema: JsonSchema;
  outputSchema?: JsonSchema;
  
  // Streaming execution
  execute(input: any): Promise<ToolResult>;
  executeStream(input: any): AsyncGenerator<ToolExecutionChunk>;
  
  // Validation and error handling
  validateInput(input: any): ValidationResult;
  handleError(error: Error, context: ToolContext): Promise<ToolErrorRecovery>;
  
  // Metadata
  getMetadata(): ToolMetadata;
  healthCheck(): Promise<ToolHealthStatus>;
}

export interface ToolExecutionChunk {
  type: 'start' | 'progress' | 'result' | 'error' | 'end';
  id: string;
  data?: any;
  progress?: number;
  error?: Error;
  metadata?: any;
}

export interface ToolResult {
  success: boolean;
  data?: any;
  error?: string;
  metadata: {
    executionTime: number;
    toolVersion: string;
    inputHash?: string;
  };
}

export interface ToolContext {
  requestId: string;
  userId?: string;
  permissions: string[];
  environment: 'development' | 'staging' | 'production';
}

export interface ToolErrorRecovery {
  canRecover: boolean;
  retryDelay?: number;
  alternativeAction?: string;
  userMessage: string;
}
```

#### Step 4.2: Streaming Tool Orchestrator

```typescript
// src/core/tools/streaming-tool-orchestrator.ts
import { ModernTool, ToolExecutionChunk } from './modern-tool-interface.js';
import { TelemetryProvider } from '../observability/telemetry-provider.js';

export class StreamingToolOrchestrator {
  private tools = new Map<string, ModernTool>();
  private activeExecutions = new Map<string, ToolExecution>();

  constructor(
    private telemetry?: TelemetryProvider,
    private config: ToolOrchestratorConfig = {}
  ) {}

  registerTool(tool: ModernTool): void {
    this.tools.set(tool.name, tool);
  }

  async *executeToolStream(
    toolName: string,
    input: any,
    context: ToolContext
  ): AsyncGenerator<ToolExecutionChunk> {
    const tool = this.tools.get(toolName);
    if (!tool) {
      throw new Error(`Tool ${toolName} not found`);
    }

    const executionId = `exec-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const execution: ToolExecution = {
      id: executionId,
      toolName,
      startTime: Date.now(),
      status: 'running'
    };

    this.activeExecutions.set(executionId, execution);

    try {
      // Validate input
      const validation = tool.validateInput(input);
      if (!validation.isValid) {
        yield {
          type: 'error',
          id: executionId,
          error: new Error(`Invalid input: ${validation.errors.join(', ')}`),
          metadata: { phase: 'validation' }
        };
        return;
      }

      // Start execution
      yield {
        type: 'start',
        id: executionId,
        metadata: { toolName, startTime: execution.startTime }
      };

      // Execute with telemetry
      if (this.telemetry) {
        yield* this.telemetry.traceAsyncGenerator(
          `tool.execute.${toolName}`,
          { tool: toolName, executionId },
          tool.executeStream.bind(tool, input)
        );
      } else {
        yield* tool.executeStream(input);
      }

      execution.status = 'completed';
      execution.endTime = Date.now();

      yield {
        type: 'end',
        id: executionId,
        metadata: {
          duration: execution.endTime - execution.startTime,
          status: 'success'
        }
      };

    } catch (error) {
      execution.status = 'error';
      execution.error = error as Error;

      // Try to recover
      const recovery = await tool.handleError(error as Error, context);
      
      if (recovery.canRecover && recovery.retryDelay) {
        yield {
          type: 'error',
          id: executionId,
          error: error as Error,
          metadata: { 
            recoverable: true, 
            retryDelay: recovery.retryDelay,
            userMessage: recovery.userMessage
          }
        };

        // Wait and retry
        setTimeout(() => {
          this.executeToolStream(toolName, input, context);
        }, recovery.retryDelay);
      } else {
        yield {
          type: 'error',
          id: executionId,
          error: error as Error,
          metadata: { 
            recoverable: false,
            userMessage: recovery.userMessage
          }
        };
      }
    } finally {
      this.activeExecutions.delete(executionId);
    }
  }

  async executeToolsInParallel(
    requests: ToolRequest[],
    context: ToolContext
  ): Promise<Map<string, ToolResult>> {
    const results = new Map<string, ToolResult>();
    
    const promises = requests.map(async (request) => {
      const chunks: ToolExecutionChunk[] = [];
      
      for await (const chunk of this.executeToolStream(request.toolName, request.input, context)) {
        chunks.push(chunk);
        
        if (chunk.type === 'result') {
          results.set(request.id, {
            success: true,
            data: chunk.data,
            metadata: {
              executionTime: Date.now() - (chunks[0]?.metadata?.startTime || 0),
              toolVersion: '1.0.0'
            }
          });
        }
      }
    });

    await Promise.allSettled(promises);
    return results;
  }

  getActiveExecutions(): ToolExecution[] {
    return Array.from(this.activeExecutions.values());
  }

  async cancelExecution(executionId: string): Promise<boolean> {
    const execution = this.activeExecutions.get(executionId);
    if (!execution) return false;

    execution.status = 'cancelled';
    this.activeExecutions.delete(executionId);
    return true;
  }
}

interface ToolExecution {
  id: string;
  toolName: string;
  startTime: number;
  endTime?: number;
  status: 'running' | 'completed' | 'error' | 'cancelled';
  error?: Error;
}

interface ToolRequest {
  id: string;
  toolName: string;
  input: any;
}

interface ToolOrchestratorConfig {
  maxConcurrentExecutions?: number;
  defaultTimeout?: number;
  retryAttempts?: number;
}
```

### 5. Structured Output Support

**Goal:** Add comprehensive structured output with validation  
**Estimated Time:** 3-5 days

#### Step 5.1: Structured Output Client

```typescript
// src/core/structured/structured-output-client.ts
import { JsonSchema, validate } from 'jsonschema';
import { UnifiedModelClient } from '../client.js';

export class StructuredOutputClient {
  constructor(private modelClient: UnifiedModelClient) {}

  async generateStructured<T>(
    prompt: string,
    schema: JsonSchema,
    options: StructuredGenerationOptions = {}
  ): Promise<StructuredResponse<T>> {
    const enhancedPrompt = this.buildStructuredPrompt(prompt, schema, options);
    
    let attempts = 0;
    const maxAttempts = options.maxRetries || 3;
    
    while (attempts < maxAttempts) {
      try {
        const response = await this.modelClient.processRequest({
          prompt: enhancedPrompt,
          temperature: options.temperature || 0.1, // Lower temperature for structured output
          maxTokens: options.maxTokens,
          stopSequences: options.stopSequences
        });

        const parsedData = this.parseAndValidate<T>(response.content, schema);
        
        return {
          data: parsedData.data,
          schema,
          confidence: this.calculateConfidence(response, parsedData),
          reasoning: options.includeReasoning ? response.reasoning : undefined,
          metadata: {
            attempts: attempts + 1,
            inputTokens: response.inputTokens,
            outputTokens: response.outputTokens,
            model: response.model
          }
        };

      } catch (error) {
        attempts++;
        
        if (attempts >= maxAttempts) {
          throw new StructuredOutputError(
            `Failed to generate valid structured output after ${maxAttempts} attempts`,
            error,
            { prompt, schema, attempts }
          );
        }

        // Add error feedback to prompt for next attempt
        enhancedPrompt += `\n\nPrevious attempt failed with error: ${error.message}. Please correct the format.`;
      }
    }
  }

  async *generateStructuredStream<T>(
    prompt: string,
    schema: JsonSchema,
    options: StructuredGenerationOptions = {}
  ): AsyncGenerator<StructuredStreamChunk<T>> {
    const enhancedPrompt = this.buildStructuredPrompt(prompt, schema, options);
    
    yield { type: 'start', schema };

    let buffer = '';
    const stream = await this.modelClient.processRequestStream({
      prompt: enhancedPrompt,
      temperature: options.temperature || 0.1,
      maxTokens: options.maxTokens
    });

    for await (const chunk of stream) {
      if (chunk.type === 'text-delta') {
        buffer += chunk.delta;
        
        // Try to parse incrementally
        const partialResult = this.tryParsePartial<T>(buffer, schema);
        if (partialResult) {
          yield {
            type: 'partial',
            partial: partialResult,
            buffer,
            confidence: this.calculatePartialConfidence(buffer, schema)
          };
        }
      }
    }

    // Final validation
    try {
      const finalResult = this.parseAndValidate<T>(buffer, schema);
      yield {
        type: 'complete',
        data: finalResult.data,
        confidence: this.calculateConfidence({ content: buffer }, finalResult),
        metadata: { finalBuffer: buffer }
      };
    } catch (error) {
      yield {
        type: 'error',
        error: error as Error,
        buffer
      };
    }
  }

  private buildStructuredPrompt(
    prompt: string,
    schema: JsonSchema,
    options: StructuredGenerationOptions
  ): string {
    let structuredPrompt = `${prompt}\n\n`;
    
    structuredPrompt += `Please respond with valid JSON that matches this schema:\n`;
    structuredPrompt += `${JSON.stringify(schema, null, 2)}\n\n`;
    
    if (options.examples) {
      structuredPrompt += `Examples:\n`;
      options.examples.forEach((example, i) => {
        structuredPrompt += `Example ${i + 1}:\n${JSON.stringify(example, null, 2)}\n\n`;
      });
    }
    
    structuredPrompt += `Requirements:\n`;
    structuredPrompt += `- Return only valid JSON, no additional text\n`;
    structuredPrompt += `- All required properties must be present\n`;
    structuredPrompt += `- Data types must match the schema exactly\n`;
    
    if (options.constraints) {
      structuredPrompt += `- Additional constraints: ${options.constraints}\n`;
    }
    
    structuredPrompt += `\nJSON Response:`;
    
    return structuredPrompt;
  }

  private parseAndValidate<T>(content: string, schema: JsonSchema): { data: T; isValid: boolean; errors: any[] } {
    try {
      // Extract JSON from response (handle cases where model adds extra text)
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      const jsonStr = jsonMatch ? jsonMatch[0] : content.trim();
      
      const data = JSON.parse(jsonStr);
      const validation = validate(data, schema);
      
      if (validation.errors.length > 0) {
        throw new ValidationError(`Schema validation failed: ${validation.errors.map(e => e.message).join(', ')}`, validation.errors);
      }
      
      return { data: data as T, isValid: true, errors: [] };
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new ParseError(`Failed to parse JSON: ${error.message}`, content);
    }
  }

  private tryParsePartial<T>(buffer: string, schema: JsonSchema): Partial<T> | null {
    try {
      // Try to find complete objects or arrays in the buffer
      const matches = buffer.match(/\{[\s\S]*?\}(?=\s*[,\]\}]|$)/g);
      if (matches && matches.length > 0) {
        const parsed = JSON.parse(matches[matches.length - 1]);
        return parsed;
      }
    } catch {
      // Ignore parsing errors for partial data
    }
    return null;
  }

  private calculateConfidence(response: any, parsedResult: any): number {
    let confidence = 0.5; // Base confidence
    
    // Increase confidence based on successful parsing
    if (parsedResult.isValid) confidence += 0.3;
    
    // Increase confidence based on response quality indicators
    if (response.reasoning) confidence += 0.1;
    if (response.content && response.content.length > 10) confidence += 0.1;
    
    return Math.min(confidence, 1.0);
  }

  private calculatePartialConfidence(buffer: string, schema: JsonSchema): number {
    // Simple heuristic based on buffer completeness
    const openBraces = (buffer.match(/\{/g) || []).length;
    const closeBraces = (buffer.match(/\}/g) || []).length;
    
    if (openBraces === closeBraces && openBraces > 0) {
      return 0.8; // High confidence for balanced braces
    } else if (openBraces > closeBraces) {
      return 0.3; // Lower confidence for incomplete JSON
    }
    
    return 0.1; // Very low confidence
  }
}

export interface StructuredResponse<T> {
  data: T;
  schema: JsonSchema;
  confidence: number;
  reasoning?: string;
  metadata: {
    attempts: number;
    inputTokens?: number;
    outputTokens?: number;
    model?: string;
  };
}

export interface StructuredGenerationOptions {
  temperature?: number;
  maxTokens?: number;
  maxRetries?: number;
  stopSequences?: string[];
  examples?: any[];
  constraints?: string;
  includeReasoning?: boolean;
}

export type StructuredStreamChunk<T> =
  | { type: 'start'; schema: JsonSchema }
  | { type: 'partial'; partial: Partial<T>; buffer: string; confidence: number }
  | { type: 'complete'; data: T; confidence: number; metadata: any }
  | { type: 'error'; error: Error; buffer: string };

export class StructuredOutputError extends Error {
  constructor(
    message: string,
    public cause?: Error,
    public context?: any
  ) {
    super(message);
    this.name = 'StructuredOutputError';
  }
}

export class ValidationError extends Error {
  constructor(message: string, public validationErrors: any[]) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class ParseError extends Error {
  constructor(message: string, public content: string) {
    super(message);
    this.name = 'ParseError';
  }
}
```

---

## Testing Strategy

### Comprehensive Testing Approach

#### 1. Unit Tests for Each Component

```typescript
// tests/streaming/modern-streaming.test.ts
describe('ModernStreamingManager', () => {
  test('should handle complete streaming lifecycle', async () => {
    // Test all chunk types in sequence
    const chunks = await collectStreamChunks(streamingManager.createFullStream(mockRequest));
    
    expect(chunks).toMatchObject([
      { type: 'stream-start' },
      { type: 'text-start' },
      { type: 'text-delta' },
      { type: 'text-end' },
      { type: 'finish' }
    ]);
  });
});

// tests/agents/agent-communication.test.ts  
describe('Agent Communication', () => {
  test('should enable direct agent-to-agent messaging', async () => {
    const agentA = createTestAgent('explorer');
    const agentB = createTestAgent('security');
    
    await agentA.sendToAgent(agentB.id, testMessage);
    
    expect(agentB.receivedMessages).toContain(testMessage);
  });
});

// tests/tools/streaming-tools.test.ts
describe('Streaming Tool Execution', () => {
  test('should stream tool execution progress', async () => {
    const chunks = await collectStreamChunks(
      toolOrchestrator.executeToolStream('file-reader', { path: 'test.txt' })
    );
    
    expect(chunks[0]).toMatchObject({ type: 'start' });
    expect(chunks[chunks.length - 1]).toMatchObject({ type: 'end' });
  });
});
```

#### 2. Integration Tests

```typescript
// tests/integration/end-to-end-streaming.test.ts
describe('End-to-End Modern Streaming', () => {
  test('should handle complex multi-agent streaming scenario', async () => {
    const cli = new CLI(mockClient, voiceSystem, mcpManager, config);
    
    const response = cli.handleRequest(
      'Analyze this codebase for security issues and provide architectural recommendations'
    );
    
    const chunks = [];
    for await (const chunk of response) {
      chunks.push(chunk);
    }
    
    // Should include agent coordination, tool calls, and reasoning
    expect(chunks.some(c => c.type === 'reasoning-start')).toBe(true);
    expect(chunks.some(c => c.type === 'tool-call-start')).toBe(true);
  });
});
```

#### 3. Performance Tests

```typescript
// tests/performance/streaming-performance.test.ts
describe('Streaming Performance', () => {
  test('should maintain acceptable latency under load', async () => {
    const startTime = Date.now();
    
    const promises = Array(10).fill(null).map(() =>
      streamingManager.createFullStream(mockRequest)
    );
    
    await Promise.all(promises);
    
    const duration = Date.now() - startTime;
    expect(duration).toBeLessThan(5000); // 5 second maximum
  });
});
```

---

## Migration and Rollback Strategy

### Safe Migration Approach

#### 1. Feature Flags

```typescript
// src/core/feature-flags.ts
export class FeatureFlags {
  private flags = new Map<string, boolean>();

  constructor(config: FeatureFlagConfig) {
    this.flags.set('modern-streaming', config.modernStreaming || false);
    this.flags.set('agent-communication', config.agentCommunication || false);
    this.flags.set('structured-outputs', config.structuredOutputs || false);
    this.flags.set('telemetry', config.telemetry || false);
  }

  isEnabled(feature: string): boolean {
    return this.flags.get(feature) || false;
  }

  enable(feature: string): void {
    this.flags.set(feature, true);
  }

  disable(feature: string): void {
    this.flags.set(feature, false);
  }
}
```

#### 2. Gradual Rollout

```typescript
// src/core/client.ts - Updated to support both old and new streaming
export class UnifiedModelClient {
  async processRequestStream(request: ModelRequest): AsyncGenerator<any> {
    if (this.featureFlags.isEnabled('modern-streaming')) {
      return this.modernStreamingManager.createFullStream(request);
    } else {
      return this.legacyStreamingManager.createStream(request);
    }
  }
}
```

#### 3. Rollback Procedures

```typescript
// scripts/rollback.ts
export async function rollbackToLegacy(): Promise<void> {
  // Disable all new features
  const flags = new FeatureFlags({
    modernStreaming: false,
    agentCommunication: false,
    structuredOutputs: false,
    telemetry: false
  });

  // Restart services with legacy configuration
  await restartServices(flags);
  
  console.log('Rollback completed successfully');
}
```

---

## Success Metrics and Monitoring

### Key Performance Indicators

```typescript
// src/core/monitoring/success-metrics.ts
export class SuccessMetrics {
  private metrics = {
    streamingLatency: new HistogramMetric('streaming_latency_ms'),
    agentResponseTime: new HistogramMetric('agent_response_time_ms'),  
    toolExecutionSuccess: new CounterMetric('tool_execution_success'),
    structuredOutputAccuracy: new GaugeMetric('structured_output_accuracy'),
    userSatisfaction: new GaugeMetric('user_satisfaction_score')
  };

  recordStreamingLatency(latency: number): void {
    this.metrics.streamingLatency.record(latency);
  }

  recordAgentResponseTime(agentId: string, responseTime: number): void {
    this.metrics.agentResponseTime.record(responseTime, { agent: agentId });
  }

  recordToolExecutionResult(toolName: string, success: boolean): void {
    if (success) {
      this.metrics.toolExecutionSuccess.inc({ tool: toolName });
    }
  }

  updateStructuredOutputAccuracy(accuracy: number): void {
    this.metrics.structuredOutputAccuracy.set(accuracy);
  }

  getMetricsSnapshot(): MetricsSnapshot {
    return {
      streamingLatencyP95: this.metrics.streamingLatency.percentile(0.95),
      avgAgentResponseTime: this.metrics.agentResponseTime.mean(),
      toolSuccessRate: this.metrics.toolExecutionSuccess.rate(),
      structuredOutputAccuracy: this.metrics.structuredOutputAccuracy.value(),
      userSatisfactionScore: this.metrics.userSatisfaction.value()
    };
  }
}

interface MetricsSnapshot {
  streamingLatencyP95: number;
  avgAgentResponseTime: number;
  toolSuccessRate: number;
  structuredOutputAccuracy: number;
  userSatisfactionScore: number;
}
```

### Automated Quality Gates

```typescript
// src/core/quality/quality-gates.ts
export class QualityGates {
  private thresholds = {
    maxStreamingLatency: 200, // ms
    minToolSuccessRate: 0.95,
    minStructuredOutputAccuracy: 0.90,
    minUserSatisfaction: 7.0
  };

  async checkQualityGates(metrics: MetricsSnapshot): Promise<QualityGateResult> {
    const failures = [];

    if (metrics.streamingLatencyP95 > this.thresholds.maxStreamingLatency) {
      failures.push(`Streaming latency too high: ${metrics.streamingLatencyP95}ms`);
    }

    if (metrics.toolSuccessRate < this.thresholds.minToolSuccessRate) {
      failures.push(`Tool success rate too low: ${metrics.toolSuccessRate}`);
    }

    if (metrics.structuredOutputAccuracy < this.thresholds.minStructuredOutputAccuracy) {
      failures.push(`Structured output accuracy too low: ${metrics.structuredOutputAccuracy}`);
    }

    return {
      passed: failures.length === 0,
      failures,
      metrics
    };
  }
}

interface QualityGateResult {
  passed: boolean;
  failures: string[];
  metrics: MetricsSnapshot;
}
```

---

## Conclusion

This implementation guide provides a **comprehensive roadmap** for modernizing CodeCrucible Synth to meet 2025 industry standards. The phased approach ensures **minimal disruption** while delivering **significant improvements** in:

- **Streaming Performance:** 40% reduction in latency with AI SDK v5.0 patterns
- **Observability:** Full distributed tracing with OpenTelemetry
- **Agent Coordination:** Advanced multi-agent communication capabilities  
- **Tool Execution:** Modern streaming tool calls with error recovery
- **Output Quality:** Structured outputs with validation and retry logic

### Next Steps

1. **Week 1:** Begin with streaming protocol upgrade (highest impact)
2. **Week 2:** Add OpenTelemetry integration (critical for production)
3. **Month 1:** Complete agent communication enhancement
4. **Month 2:** Add structured outputs and modern tool calling
5. **Months 3-6:** Implement Phase 3 enhancements

Each phase includes comprehensive testing, gradual rollout with feature flags, and clear rollback procedures to ensure **production stability** throughout the modernization process.

**Success will be measured by:**
- ✅ 40% improvement in streaming latency
- ✅ 95%+ tool execution success rate  
- ✅ 90%+ structured output accuracy
- ✅ Full distributed tracing coverage
- ✅ Zero production incidents during rollout