/**
 * Service Tokens for Dependency Injection
 * Type-safe service registration and resolution
 *
 * Living Spiral Council Applied:
 * - Architect: Type-safe dependency contracts
 * - Maintainer: Clear service boundaries and naming
 * - Security Guardian: Controlled service access
 * - Performance Engineer: Compile-time optimization opportunities
 */

import { createServiceToken } from './dependency-container.js';
import {
  IModelClient,
  IVoiceSystem,
  IIntegratedSystem,
  IPerformanceMonitor,
} from '../interfaces/client-interfaces.js';
import {
  IProviderRepository,
  IModelProvider,
  IProviderFactory,
} from '../interfaces/provider-interfaces.js';
import {
  IModelRouter,
  IRoutingStrategy,
  ITaskAnalyzer,
  ILoadBalancer,
} from '../interfaces/routing-interfaces.js';

// =============================================================================
// CORE SERVICE TOKENS
// =============================================================================

// Client services
export const CLIENT_TOKEN = createServiceToken<IModelClient>('client');
export const CLIENT_CONFIG_TOKEN = createServiceToken<any>('client-config');

// Provider services
export const PROVIDER_REPOSITORY_TOKEN =
  createServiceToken<IProviderRepository>('provider-repository');
export const PROVIDER_FACTORY_TOKEN = createServiceToken<IProviderFactory>('provider-factory');
export const OLLAMA_PROVIDER_TOKEN = createServiceToken<IModelProvider>('ollama-provider');
export const LM_STUDIO_PROVIDER_TOKEN = createServiceToken<IModelProvider>('lm-studio-provider');
export const HUGGINGFACE_PROVIDER_TOKEN =
  createServiceToken<IModelProvider>('huggingface-provider');

// Routing services - using concrete types for DI compatibility
export const HYBRID_ROUTER_TOKEN = createServiceToken<any>('hybrid-router');
export const ROUTING_STRATEGY_TOKEN = createServiceToken<IRoutingStrategy>('routing-strategy');
export const TASK_ANALYZER_TOKEN = createServiceToken<ITaskAnalyzer>('task-analyzer');
export const LOAD_BALANCER_TOKEN = createServiceToken<ILoadBalancer>('load-balancer');

// Cache services
export const CACHE_COORDINATOR_TOKEN = createServiceToken<any>('cache-coordinator');
export const UNIFIED_CACHE_TOKEN = createServiceToken<any>('unified-cache');

// Security services
export const SECURITY_VALIDATOR_TOKEN = createServiceToken<any>('security-validator');
export const SECURITY_UTILS_TOKEN = createServiceToken<any>('security-utils');

// Streaming services
export const STREAMING_MANAGER_TOKEN = createServiceToken<any>('streaming-manager');

// Performance monitoring - using concrete type for DI compatibility
export const PERFORMANCE_MONITOR_TOKEN =
  createServiceToken<any>('performance-monitor');

// =============================================================================
// ADVANCED SERVICE TOKENS
// =============================================================================

// Application layer services
export const SYNTHESIS_COORDINATOR_TOKEN = createServiceToken<any>('synthesis-coordinator');

// Voice system services
export const VOICE_SYSTEM_TOKEN = createServiceToken<IVoiceSystem>('voice-system');
export const VOICE_ARCHETYPE_TOKEN = createServiceToken<any>('voice-archetype');

// Integration services
export const INTEGRATED_SYSTEM_TOKEN = createServiceToken<IIntegratedSystem>('integrated-system');
export const TOOL_INTEGRATION_TOKEN = createServiceToken<any>('tool-integration');

// Hardware management
export const HARDWARE_SELECTOR_TOKEN = createServiceToken<any>('hardware-selector');
export const PROCESS_MANAGER_TOKEN = createServiceToken<any>('process-manager');

// =============================================================================
// INFRASTRUCTURE SERVICE TOKENS
// =============================================================================

// Logging and utilities
export const LOGGER_TOKEN = createServiceToken<any>('logger');
export const ERROR_UTILS_TOKEN = createServiceToken<any>('error-utils');

// Configuration management
export const CONFIG_MANAGER_TOKEN = createServiceToken<any>('config-manager');
export const ENVIRONMENT_TOKEN = createServiceToken<any>('environment');

// Event system
export const EVENT_BUS_TOKEN = createServiceToken<any>('event-bus');

// =============================================================================
// FACTORY SERVICE TOKENS
// =============================================================================

// Factories for complex object creation
export const CLIENT_FACTORY_TOKEN = createServiceToken<any>('client-factory');
export const ROUTER_FACTORY_TOKEN = createServiceToken<any>('router-factory');

// =============================================================================
// SERVICE TOKEN REGISTRY
// =============================================================================

/**
 * Registry of all service tokens for validation and introspection
 */
export const SERVICE_TOKEN_REGISTRY = {
  // Core services
  CLIENT: CLIENT_TOKEN,
  CLIENT_CONFIG: CLIENT_CONFIG_TOKEN,

  // Provider services
  PROVIDER_REPOSITORY: PROVIDER_REPOSITORY_TOKEN,
  PROVIDER_FACTORY: PROVIDER_FACTORY_TOKEN,
  OLLAMA_PROVIDER: OLLAMA_PROVIDER_TOKEN,
  LM_STUDIO_PROVIDER: LM_STUDIO_PROVIDER_TOKEN,
  HUGGINGFACE_PROVIDER: HUGGINGFACE_PROVIDER_TOKEN,

  // Routing services
  HYBRID_ROUTER: HYBRID_ROUTER_TOKEN,
  ROUTING_STRATEGY: ROUTING_STRATEGY_TOKEN,
  TASK_ANALYZER: TASK_ANALYZER_TOKEN,
  LOAD_BALANCER: LOAD_BALANCER_TOKEN,

  // Cache services
  CACHE_COORDINATOR: CACHE_COORDINATOR_TOKEN,
  UNIFIED_CACHE: UNIFIED_CACHE_TOKEN,

  // Security services
  SECURITY_VALIDATOR: SECURITY_VALIDATOR_TOKEN,
  SECURITY_UTILS: SECURITY_UTILS_TOKEN,

  // Streaming services
  STREAMING_MANAGER: STREAMING_MANAGER_TOKEN,

  // Performance monitoring
  PERFORMANCE_MONITOR: PERFORMANCE_MONITOR_TOKEN,

  // Application layer
  SYNTHESIS_COORDINATOR: SYNTHESIS_COORDINATOR_TOKEN,

  // Voice system
  VOICE_SYSTEM: VOICE_SYSTEM_TOKEN,
  VOICE_ARCHETYPE: VOICE_ARCHETYPE_TOKEN,

  // Integration services
  INTEGRATED_SYSTEM: INTEGRATED_SYSTEM_TOKEN,
  TOOL_INTEGRATION: TOOL_INTEGRATION_TOKEN,

  // Hardware management
  HARDWARE_SELECTOR: HARDWARE_SELECTOR_TOKEN,
  PROCESS_MANAGER: PROCESS_MANAGER_TOKEN,

  // Infrastructure
  LOGGER: LOGGER_TOKEN,
  ERROR_UTILS: ERROR_UTILS_TOKEN,
  CONFIG_MANAGER: CONFIG_MANAGER_TOKEN,
  ENVIRONMENT: ENVIRONMENT_TOKEN,
  EVENT_BUS: EVENT_BUS_TOKEN,

  // Factories
  CLIENT_FACTORY: CLIENT_FACTORY_TOKEN,
  ROUTER_FACTORY: ROUTER_FACTORY_TOKEN,
} as const;

/**
 * Get all registered service token names
 */
export function getAllServiceTokens(): string[] {
  return Object.values(SERVICE_TOKEN_REGISTRY).map(token => token.name);
}

/**
 * Validate service token exists in registry
 */
export function isValidServiceToken(tokenName: string): boolean {
  return getAllServiceTokens().includes(tokenName);
}

/**
 * Get service token by name (type-safe)
 */
export function getServiceToken(tokenName: keyof typeof SERVICE_TOKEN_REGISTRY) {
  return SERVICE_TOKEN_REGISTRY[tokenName];
}
