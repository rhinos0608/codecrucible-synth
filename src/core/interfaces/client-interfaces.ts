/**
 * Client Interface Abstractions
 * Breaking circular dependencies through interface segregation
 *
 * Living Spiral Council Applied:
 * - Architect: Clear separation between interface and implementation
 * - Maintainer: Stable contracts for loose coupling
 * - Security Guardian: Controlled access through well-defined interfaces
 * - Performance Engineer: Minimal interface surface area for efficiency
 */

// Import and re-export types from the existing types module to ensure compatibility
import { ProjectContext, ModelRequest, ModelResponse } from '../types.js';

export { ProjectContext, ModelRequest, ModelResponse };

// Streaming interfaces
export interface StreamToken {
  content: string;
  finished?: boolean;
  index: number;
  timestamp: number;
  metadata?: Record<string, any>;
}

// Main client interface - simplified to match existing implementation
export interface IModelClient {
  // Core processing
  processRequest(request: ModelRequest, context?: ProjectContext): Promise<ModelResponse>;
  streamRequest(
    request: ModelRequest,
    onToken: (token: StreamToken) => void,
    context?: ProjectContext
  ): Promise<ModelResponse>;
  generateText(prompt: string, options?: any): Promise<string>;
  synthesize(request: ModelRequest): Promise<ModelResponse>;

  // Management
  healthCheck(): Promise<Record<string, boolean>>;
  getProviders(): Map<string, any>;

  // Lifecycle
  initialize(): Promise<void>;
  shutdown(): Promise<void>;
  destroy(): Promise<void>;
}

// Voice system interfaces (breaking voice archetype dependencies)
export interface IVoiceSystem {
  generateVoiceResponse(prompt: string, voiceId: string, options?: any): Promise<any>;
  synthesizeMultiVoice(request: any): Promise<any>;
  getAvailableVoices(): string[];
}

// Integration interfaces (breaking tool dependencies)
export interface IIntegratedSystem {
  synthesize(request: any): Promise<any>;
  getSystemStatus(): Promise<any>;
  enableIntegration(): Promise<void>;
  disableIntegration(): Promise<void>;
}

// Performance monitoring interfaces - matching actual PerformanceMonitor implementation
export interface IPerformanceMonitor {
  // Core tracking methods
  track?: () => void;
  getMetrics?: () => { avgLatency: number; errorRate: number };
  
  // Extended methods (optional for backwards compatibility)
  recordRequest?: (provider: string, metrics: any) => void;
  getProviderMetrics?: (provider?: string) => Record<string, any>;
  getSummary?: () => any;
  getAlerts?: (limit?: number) => any[];
  getSystemMetrics?: () => any;
  getRequestHistory?: (provider?: string, limit?: number) => any[];
  resetProviderMetrics?: (provider: string) => void;
  clearAllMetrics?: () => void;
  startOperation?: (operationId: string, component?: string) => void;
  endOperation?: (operationId: string) => void;
  start?: () => void;
  stop?: () => void;
  destroy?: () => void;
  
  // Allow additional methods for flexibility
  [key: string]: any;
}

// Client configuration interface
export interface IClientConfig {
  providers: any[];
  executionMode: string;
  fallbackChain: string[];
  performanceThresholds: any;
  security: any;
  streaming?: any;
}

// Event interfaces for decoupled communication
export interface ClientEvents {
  requestStarted: { requestId: string; request: ModelRequest };
  requestCompleted: { requestId: string; response: ModelResponse };
  requestFailed: { requestId: string; error: Error };
  providersReady: void;
  providersPartial: { error: Error };
  shutdown: void;
}

// Client factory interface for DI
export interface IClientFactory {
  createClient(config: IClientConfig): Promise<IModelClient>;
  createClientWithDependencies(
    providers: any,
    cache: any,
    security: any,
    streaming: any,
    config: IClientConfig
  ): Promise<IModelClient>;
}
