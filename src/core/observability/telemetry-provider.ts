/**
 * OpenTelemetry Integration for CodeCrucible Synth
 * Implements comprehensive distributed tracing, metrics, and logging
 * 
 * Features:
 * - Distributed tracing for model requests
 * - Performance metrics collection
 * - Error tracking and monitoring
 * - Custom span attributes for AI operations
 * - Integration with external observability platforms
 * - Memory and resource usage tracking
 */

import { trace, metrics, logs, SpanStatusCode, SpanKind, context } from '@opentelemetry/api';
import { logger } from '../logger.js';

// Types for telemetry operations
export interface TelemetryConfig {
  serviceName: string;
  serviceVersion: string;
  environment: string;
  enableTracing?: boolean;
  enableMetrics?: boolean;
  enableLogging?: boolean;
  exporters?: {
    jaeger?: boolean;
    prometheus?: boolean;
    console?: boolean;
  };
}

export interface ModelRequestSpanAttributes {
  'codecrucible.model': string;
  'codecrucible.provider': string;
  'codecrucible.request.type': string;
  'codecrucible.request.complexity': string;
  'codecrucible.request.tokens.input'?: number;
  'codecrucible.request.tokens.output'?: number;
  'codecrucible.request.temperature'?: number;
  'codecrucible.streaming.enabled'?: boolean;
  'codecrucible.tools.count'?: number;
  'codecrucible.voice.archetype'?: string;
  'codecrucible.hybrid.routing.decision'?: string;
}

export interface StreamingSpanAttributes {
  'codecrucible.streaming.session_id': string;
  'codecrucible.streaming.chunk_type': string;
  'codecrucible.streaming.block_id'?: string;
  'codecrucible.streaming.total_chunks': number;
  'codecrucible.streaming.bytes_streamed': number;
}

export interface ToolExecutionSpanAttributes {
  'codecrucible.tool.name': string;
  'codecrucible.tool.execution_time': number;
  'codecrucible.tool.success': boolean;
  'codecrucible.tool.error_type'?: string;
}

export interface AgentCommunicationSpanAttributes {
  'codecrucible.agent.source_id': string;
  'codecrucible.agent.target_id': string;
  'codecrucible.agent.message_type': string;
  'codecrucible.agent.orchestration_strategy': string;
}

export interface TelemetryMetrics {
  // Request metrics
  requestCounter: any;
  requestDuration: any;
  requestSize: any;
  
  // Streaming metrics
  streamingSessionCounter: any;
  streamingLatency: any;
  streamingThroughput: any;
  
  // Tool metrics
  toolExecutionCounter: any;
  toolExecutionDuration: any;
  
  // System metrics
  memoryUsage: any;
  cpuUsage: any;
  cacheHitRate: any;
  
  // Error metrics
  errorCounter: any;
  errorRate: any;
}

export interface ITelemetryProvider {
  // Core tracing
  traceModelRequest<T>(
    operation: string,
    attributes: Partial<ModelRequestSpanAttributes>,
    fn: () => Promise<T>
  ): Promise<T>;
  
  traceStreamingSession<T>(
    attributes: Partial<StreamingSpanAttributes>,
    fn: () => Promise<T>
  ): Promise<T>;
  
  traceToolExecution<T>(
    toolName: string,
    attributes: Partial<ToolExecutionSpanAttributes>,
    fn: () => Promise<T>
  ): Promise<T>;
  
  traceAgentCommunication<T>(
    attributes: Partial<AgentCommunicationSpanAttributes>,
    fn: () => Promise<T>
  ): Promise<T>;
  
  // Metrics
  recordModelRequest(
    provider: string,
    model: string,
    duration: number,
    tokens: { input: number; output: number },
    success: boolean
  ): void;
  
  recordStreamingMetrics(
    sessionId: string,
    chunkCount: number,
    bytesStreamed: number,
    duration: number
  ): void;
  
  recordToolExecution(
    toolName: string,
    duration: number,
    success: boolean,
    errorType?: string
  ): void;
  
  recordCacheMetrics(hit: boolean, operation: string): void;
  
  recordSystemMetrics(memory: number, cpu: number): void;
  
  // Error tracking
  recordError(
    error: Error,
    context: Record<string, any>,
    severity: 'low' | 'medium' | 'high' | 'critical'
  ): void;
  
  // Configuration and lifecycle
  initialize(config: TelemetryConfig): Promise<void>;
  shutdown(): Promise<void>;
  
  // Health checks
  isHealthy(): boolean;
  getMetrics(): Record<string, any>;
}

/**
 * OpenTelemetry-based Telemetry Provider
 * Implements comprehensive observability for CodeCrucible Synth
 */
export class TelemetryProvider implements ITelemetryProvider {
  private tracer: any;
  private meter: any;
  private logger_otel: any;
  private config!: TelemetryConfig;
  private metrics!: TelemetryMetrics;
  private initialized = false;
  private spanCounter = 0;

  constructor() {
    // Initialize without starting - explicit initialization required
  }

  /**
   * Initialize OpenTelemetry with configuration
   */
  async initialize(config: TelemetryConfig): Promise<void> {
    this.config = config;
    
    try {
      // Initialize tracer
      if (config.enableTracing !== false) {
        this.tracer = trace.getTracer(
          config.serviceName,
          config.serviceVersion
        );
      }
      
      // Initialize metrics
      if (config.enableMetrics !== false) {
        this.meter = metrics.getMeter(
          config.serviceName,
          config.serviceVersion
        );
        
        this.initializeMetrics();
      }
      
      // Initialize logging
      if (config.enableLogging !== false) {
        this.logger_otel = logs.getLogger(
          config.serviceName,
          config.serviceVersion
        );
      }
      
      this.initialized = true;
      
      logger.info('🔍 Telemetry provider initialized', {
        service: config.serviceName,
        version: config.serviceVersion,
        environment: config.environment,
        tracing: config.enableTracing !== false,
        metrics: config.enableMetrics !== false,
        logging: config.enableLogging !== false
      });
      
    } catch (error) {
      logger.error('Failed to initialize telemetry provider', error);
      // Continue without telemetry rather than failing
      this.initialized = false;
    }
  }

  /**
   * Initialize metrics collectors
   */
  private initializeMetrics(): void {
    if (!this.meter) return;
    
    try {
      this.metrics = {
        // Request metrics
        requestCounter: this.meter.createCounter('codecrucible_requests_total', {
          description: 'Total number of model requests'
        }),
        
        requestDuration: this.meter.createHistogram('codecrucible_request_duration_ms', {
          description: 'Request duration in milliseconds'
        }),
        
        requestSize: this.meter.createHistogram('codecrucible_request_size_tokens', {
          description: 'Request size in tokens'
        }),
        
        // Streaming metrics
        streamingSessionCounter: this.meter.createCounter('codecrucible_streaming_sessions_total', {
          description: 'Total streaming sessions'
        }),
        
        streamingLatency: this.meter.createHistogram('codecrucible_streaming_latency_ms', {
          description: 'Streaming latency in milliseconds'
        }),
        
        streamingThroughput: this.meter.createHistogram('codecrucible_streaming_throughput_bps', {
          description: 'Streaming throughput in bytes per second'
        }),
        
        // Tool metrics
        toolExecutionCounter: this.meter.createCounter('codecrucible_tool_executions_total', {
          description: 'Total tool executions'
        }),
        
        toolExecutionDuration: this.meter.createHistogram('codecrucible_tool_duration_ms', {
          description: 'Tool execution duration in milliseconds'
        }),
        
        // System metrics
        memoryUsage: this.meter.createGauge('codecrucible_memory_usage_mb', {
          description: 'Memory usage in megabytes'
        }),
        
        cpuUsage: this.meter.createGauge('codecrucible_cpu_usage_percent', {
          description: 'CPU usage percentage'
        }),
        
        cacheHitRate: this.meter.createGauge('codecrucible_cache_hit_rate', {
          description: 'Cache hit rate percentage'
        }),
        
        // Error metrics
        errorCounter: this.meter.createCounter('codecrucible_errors_total', {
          description: 'Total number of errors'
        }),
        
        errorRate: this.meter.createGauge('codecrucible_error_rate', {
          description: 'Error rate percentage'
        })
      };
      
    } catch (error) {
      logger.warn('Failed to initialize metrics', error);
    }
  }

  /**
   * Trace model request operations
   */
  async traceModelRequest<T>(
    operation: string,
    attributes: Partial<ModelRequestSpanAttributes>,
    fn: () => Promise<T>
  ): Promise<T> {
    if (!this.initialized || !this.tracer) {
      // Execute without tracing if not initialized
      return await fn();
    }

    const spanName = `codecrucible.${operation}`;
    const spanId = ++this.spanCounter;
    
    return await this.tracer.startActiveSpan(
      spanName,
      {
        kind: SpanKind.CLIENT,
        attributes: {
          'codecrucible.operation': operation,
          'codecrucible.span.id': spanId,
          ...attributes
        }
      },
      async (span: any) => {
        const startTime = Date.now();
        
        try {
          // Add additional context
          span.setAttributes({
            'codecrucible.request.timestamp': new Date().toISOString(),
            'codecrucible.request.id': this.generateRequestId()
          });

          const result = await fn();
          
          // Record success metrics
          const duration = Date.now() - startTime;
          span.setAttributes({
            'codecrucible.request.duration_ms': duration,
            'codecrucible.request.success': true
          });
          
          span.setStatus({ code: SpanStatusCode.OK });
          
          // Record metrics if available
          if (this.metrics?.requestCounter) {
            this.metrics.requestCounter.add(1, {
              operation,
              provider: attributes['codecrucible.provider'] || 'unknown',
              model: attributes['codecrucible.model'] || 'unknown',
              success: 'true'
            });
            
            this.metrics.requestDuration.record(duration, {
              operation,
              provider: attributes['codecrucible.provider'] || 'unknown'
            });
          }
          
          return result;
          
        } catch (error) {
          // Record error
          const duration = Date.now() - startTime;
          const errorMessage = error instanceof Error ? error.message : String(error);
          
          span.recordException(error as Error);
          span.setStatus({ 
            code: SpanStatusCode.ERROR,
            message: errorMessage
          });
          
          span.setAttributes({
            'codecrucible.request.duration_ms': duration,
            'codecrucible.request.success': false,
            'codecrucible.error.message': errorMessage,
            'codecrucible.error.type': error instanceof Error ? error.constructor.name : 'Unknown'
          });
          
          // Record error metrics
          if (this.metrics?.requestCounter) {
            this.metrics.requestCounter.add(1, {
              operation,
              provider: attributes['codecrucible.provider'] || 'unknown',
              model: attributes['codecrucible.model'] || 'unknown',
              success: 'false'
            });
          }
          
          throw error;
        } finally {
          span.end();
        }
      }
    );
  }

  /**
   * Trace streaming session operations
   */
  async traceStreamingSession<T>(
    attributes: Partial<StreamingSpanAttributes>,
    fn: () => Promise<T>
  ): Promise<T> {
    if (!this.initialized || !this.tracer) {
      return await fn();
    }

    return await this.tracer.startActiveSpan(
      'codecrucible.streaming.session',
      {
        kind: SpanKind.INTERNAL,
        attributes: {
          'codecrucible.operation': 'streaming',
          ...attributes
        }
      },
      async (span: any) => {
        const startTime = Date.now();
        
        try {
          const result = await fn();
          const duration = Date.now() - startTime;
          
          span.setAttributes({
            'codecrucible.streaming.duration_ms': duration,
            'codecrucible.streaming.success': true
          });
          
          span.setStatus({ code: SpanStatusCode.OK });
          
          // Record streaming metrics
          if (this.metrics?.streamingSessionCounter && attributes['codecrucible.streaming.session_id']) {
            this.metrics.streamingSessionCounter.add(1, {
              session_id: attributes['codecrucible.streaming.session_id']
            });
            
            if (attributes['codecrucible.streaming.bytes_streamed']) {
              const throughput = attributes['codecrucible.streaming.bytes_streamed'] / (duration / 1000);
              this.metrics.streamingThroughput.record(throughput);
            }
          }
          
          return result;
          
        } catch (error) {
          span.recordException(error as Error);
          span.setStatus({ 
            code: SpanStatusCode.ERROR,
            message: error instanceof Error ? error.message : String(error)
          });
          throw error;
        } finally {
          span.end();
        }
      }
    );
  }

  /**
   * Trace tool execution
   */
  async traceToolExecution<T>(
    toolName: string,
    attributes: Partial<ToolExecutionSpanAttributes>,
    fn: () => Promise<T>
  ): Promise<T> {
    if (!this.initialized || !this.tracer) {
      return await fn();
    }

    return await this.tracer.startActiveSpan(
      'codecrucible.tool.execution',
      {
        kind: SpanKind.INTERNAL,
        attributes: {
          'codecrucible.tool.name': toolName,
          ...attributes
        }
      },
      async (span: any) => {
        const startTime = Date.now();
        
        try {
          const result = await fn();
          const duration = Date.now() - startTime;
          
          span.setAttributes({
            'codecrucible.tool.execution_time': duration,
            'codecrucible.tool.success': true
          });
          
          span.setStatus({ code: SpanStatusCode.OK });
          
          // Record tool metrics
          if (this.metrics?.toolExecutionCounter) {
            this.metrics.toolExecutionCounter.add(1, {
              tool_name: toolName,
              success: 'true'
            });
            
            this.metrics.toolExecutionDuration.record(duration, {
              tool_name: toolName
            });
          }
          
          return result;
          
        } catch (error) {
          const duration = Date.now() - startTime;
          
          span.recordException(error as Error);
          span.setStatus({ 
            code: SpanStatusCode.ERROR,
            message: error instanceof Error ? error.message : String(error)
          });
          
          span.setAttributes({
            'codecrucible.tool.execution_time': duration,
            'codecrucible.tool.success': false,
            'codecrucible.tool.error_type': error instanceof Error ? error.constructor.name : 'Unknown'
          });
          
          // Record tool error metrics
          if (this.metrics?.toolExecutionCounter) {
            this.metrics.toolExecutionCounter.add(1, {
              tool_name: toolName,
              success: 'false'
            });
          }
          
          throw error;
        } finally {
          span.end();
        }
      }
    );
  }

  /**
   * Trace agent communication
   */
  async traceAgentCommunication<T>(
    attributes: Partial<AgentCommunicationSpanAttributes>,
    fn: () => Promise<T>
  ): Promise<T> {
    if (!this.initialized || !this.tracer) {
      return await fn();
    }

    return await this.tracer.startActiveSpan(
      'codecrucible.agent.communication',
      {
        kind: SpanKind.PRODUCER,
        attributes
      },
      async (span: any) => {
        try {
          const result = await fn();
          span.setStatus({ code: SpanStatusCode.OK });
          return result;
        } catch (error) {
          span.recordException(error as Error);
          span.setStatus({ 
            code: SpanStatusCode.ERROR,
            message: error instanceof Error ? error.message : String(error)
          });
          throw error;
        } finally {
          span.end();
        }
      }
    );
  }

  /**
   * Record model request metrics
   */
  recordModelRequest(
    provider: string,
    model: string,
    duration: number,
    tokens: { input: number; output: number },
    success: boolean
  ): void {
    if (!this.initialized || !this.metrics) return;

    try {
      const labels = { provider, model, success: success.toString() };
      
      this.metrics.requestCounter.add(1, labels);
      this.metrics.requestDuration.record(duration, labels);
      
      if (tokens.input > 0) {
        this.metrics.requestSize.record(tokens.input, { ...labels, type: 'input' });
      }
      
      if (tokens.output > 0) {
        this.metrics.requestSize.record(tokens.output, { ...labels, type: 'output' });
      }
      
    } catch (error) {
      logger.warn('Failed to record model request metrics', error);
    }
  }

  /**
   * Record streaming metrics
   */
  recordStreamingMetrics(
    sessionId: string,
    chunkCount: number,
    bytesStreamed: number,
    duration: number
  ): void {
    if (!this.initialized || !this.metrics) return;

    try {
      const labels = { session_id: sessionId };
      
      this.metrics.streamingSessionCounter.add(1, labels);
      
      if (duration > 0) {
        this.metrics.streamingLatency.record(duration, labels);
        
        const throughput = bytesStreamed / (duration / 1000);
        this.metrics.streamingThroughput.record(throughput, labels);
      }
      
    } catch (error) {
      logger.warn('Failed to record streaming metrics', error);
    }
  }

  /**
   * Record tool execution metrics
   */
  recordToolExecution(
    toolName: string,
    duration: number,
    success: boolean,
    errorType?: string
  ): void {
    if (!this.initialized || !this.metrics) return;

    try {
      const labels = { 
        tool_name: toolName, 
        success: success.toString(),
        ...(errorType && { error_type: errorType })
      };
      
      this.metrics.toolExecutionCounter.add(1, labels);
      this.metrics.toolExecutionDuration.record(duration, labels);
      
    } catch (error) {
      logger.warn('Failed to record tool execution metrics', error);
    }
  }

  /**
   * Record cache metrics
   */
  recordCacheMetrics(hit: boolean, operation: string): void {
    if (!this.initialized || !this.metrics) return;

    try {
      // Update cache hit rate (simplified calculation)
      const hitRate = hit ? 1 : 0;
      this.metrics.cacheHitRate.record(hitRate, { operation });
      
    } catch (error) {
      logger.warn('Failed to record cache metrics', error);
    }
  }

  /**
   * Record system metrics
   */
  recordSystemMetrics(memory: number, cpu: number): void {
    if (!this.initialized || !this.metrics) return;

    try {
      this.metrics.memoryUsage.record(memory);
      this.metrics.cpuUsage.record(cpu);
      
    } catch (error) {
      logger.warn('Failed to record system metrics', error);
    }
  }

  /**
   * Record error with context
   */
  recordError(
    error: Error,
    context: Record<string, any>,
    severity: 'low' | 'medium' | 'high' | 'critical'
  ): void {
    if (!this.initialized) return;

    try {
      // Record error metric
      if (this.metrics?.errorCounter) {
        this.metrics.errorCounter.add(1, {
          error_type: error.constructor.name,
          severity,
          ...context
        });
      }
      
      // Create error span
      if (this.tracer) {
        const span = this.tracer.startSpan('codecrucible.error');
        span.recordException(error);
        span.setAttributes({
          'codecrucible.error.severity': severity,
          'codecrucible.error.context': JSON.stringify(context)
        });
        span.setStatus({ 
          code: SpanStatusCode.ERROR,
          message: error.message 
        });
        span.end();
      }
      
    } catch (telemetryError) {
      logger.warn('Failed to record error telemetry', telemetryError);
    }
  }

  /**
   * Check if telemetry is healthy
   */
  isHealthy(): boolean {
    return this.initialized;
  }

  /**
   * Get current metrics snapshot
   */
  getMetrics(): Record<string, any> {
    if (!this.initialized) {
      return { status: 'not_initialized' };
    }

    return {
      status: 'healthy',
      initialized: this.initialized,
      spans_created: this.spanCounter,
      config: {
        service: this.config.serviceName,
        version: this.config.serviceVersion,
        environment: this.config.environment
      }
    };
  }

  /**
   * Shutdown telemetry provider
   */
  async shutdown(): Promise<void> {
    if (!this.initialized) return;

    try {
      logger.info('🔍 Shutting down telemetry provider...');
      
      // Note: Actual OpenTelemetry shutdown would be implemented here
      // For now, we just mark as not initialized
      this.initialized = false;
      
      logger.info('✅ Telemetry provider shutdown complete');
      
    } catch (error) {
      logger.error('Error during telemetry shutdown', error);
    }
  }

  /**
   * Generate unique request ID
   */
  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Singleton instance
let globalTelemetryProvider: ITelemetryProvider | null = null;

/**
 * Get global telemetry provider instance
 */
export function getTelemetryProvider(): ITelemetryProvider {
  if (!globalTelemetryProvider) {
    globalTelemetryProvider = new TelemetryProvider();
  }
  return globalTelemetryProvider;
}

/**
 * Initialize telemetry with configuration
 */
export async function initializeTelemetry(config: TelemetryConfig): Promise<ITelemetryProvider> {
  const provider = getTelemetryProvider();
  await provider.initialize(config);
  return provider;
}

// Factory function
export function createTelemetryProvider(): ITelemetryProvider {
  return new TelemetryProvider();
}

// Default export
export default TelemetryProvider;