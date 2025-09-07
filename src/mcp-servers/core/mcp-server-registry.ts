/**
 * MCP Server Registry - Core Module
 *
 * Lightweight registry for MCP servers with lazy initialization
 * Handles server discovery and basic lifecycle WITHOUT eager loading
 *
 * Memory-conscious design following Coding Grimoire principles
 */

import { logger } from '../../infrastructure/logging/unified-logger.js';
import { EventEmitter } from 'events';

export interface MCPServerDefinition {
  id: string;
  name: string;
  description: string;
  type: 'filesystem' | 'git' | 'terminal' | 'package' | 'smithery' | 'external';
  config: Record<string, unknown>;
  enabled: boolean;
  priority: number; // 1-10, higher = higher priority
  lazyLoad: boolean; // If true, only initialize when needed
  dependencies: string[]; // Other server IDs this depends on
}

export interface ServerRegistration {
  definition: MCPServerDefinition;
  instance?: unknown; // Lazy-loaded server instance
  status: 'uninitialized' | 'initializing' | 'ready' | 'error' | 'disabled';
  lastError?: Error;
  initializationTime?: number;
  memoryUsage?: number;
}

/**
 * Lightweight server registry with dependency injection support
 */
export class MCPServerRegistry extends EventEmitter {
  private readonly registrations: Map<string, ServerRegistration> = new Map();
  private readonly initializationQueue: Set<string> = new Set();
  private readonly dependencyGraph: Map<string, Set<string>> = new Map(); // serverId -> dependents

  // Memory management
  private readonly maxConcurrentInit = 3; // Limit concurrent initializations
  private currentInitializations = 0;

  public constructor() {
    super();

    // Configure event emitter for memory efficiency
    this.setMaxListeners(50); // Reasonable limit

    // Clean up listeners on process exit
    process.on('beforeExit', () => { this.cleanup(); });
  }

  /**
   * Register a server definition (no initialization)
   */
  public register(definition: Readonly<MCPServerDefinition>): void {
    if (this.registrations.has(definition.id)) {
      logger.warn(`Server ${definition.id} already registered, updating definition`);
    }

    const registration: ServerRegistration = {
      definition,
      status: definition.enabled ? 'uninitialized' : 'disabled',
    };

    this.registrations.set(definition.id, registration);
    this.updateDependencyGraph(definition);

    logger.info(
      `📋 Registered server: ${definition.id} (${definition.type}, lazy: ${definition.lazyLoad})`
    );
    this.emit('serverRegistered', definition.id);
  }

  /**
   * Get server instance with lazy initialization
   */
  public async getServer(serverId: string): Promise<unknown> {
    const registration = this.registrations.get(serverId);
    if (!registration) {
      throw new Error(`Server ${serverId} not registered`);
    }

    if (registration.status === 'disabled') {
      throw new Error(`Server ${serverId} is disabled`);
    }

    if (registration.status === 'error') {
      throw new Error(
        `Server ${serverId} failed to initialize: ${registration.lastError?.message}`
      );
    }

    // Return existing instance if ready
    if (registration.status === 'ready' && registration.instance) {
      return registration.instance;
    }

    // Initialize if needed
    if (registration.status === 'uninitialized') {
      await this.initializeServer(serverId);
    }

    // Wait for initialization to complete if in progress
    if (registration.status === 'initializing') {
      await this.waitForInitialization(serverId);
    }

    if (registration.status !== 'ready' || !registration.instance) {
      throw new Error(`Failed to initialize server ${serverId}`);
    }

    return registration.instance;
  }

  /**
   * Initialize server with dependency resolution and memory tracking
   */
  private async initializeServer(serverId: string): Promise<void> {
    const registration = this.registrations.get(serverId);
    if (!registration) {
      throw new Error(`Server ${serverId} not registered`);
    }

    // Check if already in initialization queue
    if (this.initializationQueue.has(serverId)) {
      return;
    }

    // Memory protection - limit concurrent initializations
    if (this.currentInitializations >= this.maxConcurrentInit) {
      logger.info(`🔄 Server ${serverId} queued - max concurrent init reached`);
      await this.waitForInitializationSlot();
    }

    this.initializationQueue.add(serverId);
    this.currentInitializations++;
    registration.status = 'initializing';

    const startTime = Date.now();
    const initialMemory = process.memoryUsage().heapUsed;

    try {
      logger.info(`🔄 Initializing server: ${serverId} (${registration.definition.type})`);

      // Initialize dependencies first
      await this.initializeDependencies(serverId);

      // Create server instance based on type
      registration.instance = await this.createServerInstance(registration.definition);

      // Track initialization metrics with NaN protection
      const initTime = Date.now() - startTime;
      const currentMemory = process.memoryUsage().heapUsed;
      const memoryUsed =
        isNaN(currentMemory) || isNaN(initialMemory) ? 0 : currentMemory - initialMemory;

      registration.initializationTime = initTime;
      registration.memoryUsage = memoryUsed;
      registration.status = 'ready';
      registration.lastError = undefined;

      logger.info(
        `✅ Server ${serverId} initialized (${initTime}ms, ${this.formatBytes(memoryUsed)})`
      );
      this.emit('serverInitialized', serverId, { initTime, memoryUsed });
    } catch (error) {
      registration.status = 'error';
      registration.lastError = error instanceof Error ? error : new Error(String(error));

      logger.error(`❌ Server ${serverId} initialization failed:`, error);
      this.emit('serverError', serverId, error);

      throw error;
    } finally {
      this.initializationQueue.delete(serverId);
      this.currentInitializations--;
    }
  }

  /**
   * Create server instance based on type (factory pattern)
   */
  private async createServerInstance(definition: MCPServerDefinition): Promise<unknown> {
    // Dynamic imports to prevent eager loading
    switch (definition.type) {
      case 'filesystem': {
        const { FilesystemMCPServer } = await import('../filesystem-server.js');
        return new FilesystemMCPServer(definition.config);
      }

      case 'git': {
        const { GitMCPServer } = await import('../git-server.js');
        return new GitMCPServer(definition.config);
      }

      case 'terminal': {
        const { TerminalMCPServer } = await import('../terminal-server.js');
        return new TerminalMCPServer(definition.config);
      }

      case 'package': {
        const { PackageManagerMCPServer } = await import('../package-manager-server.js');
        return new PackageManagerMCPServer(definition.config);
      }

      case 'smithery': {
        const { SmitheryMCPServer } = await import('../smithery-mcp-server.js');
        // Validate config for SmitheryMCPConfig
        const config = definition.config as Partial<import('../smithery-mcp-server.js').SmitheryMCPConfig>;
        if (typeof config.apiKey !== 'string') {
          throw new Error(`SmitheryMCPServer requires a valid 'apiKey' in config`);
        }
        return new SmitheryMCPServer(config as import('../smithery-mcp-server.js').SmitheryMCPConfig);
      }

      default:
        throw new Error(`Unknown server type: ${definition.type}`);
    }
  }

  /**
   * Initialize dependencies for a server before initializing the server itself
   */
  private async initializeDependencies(serverId: string): Promise<void> {
    const registration = this.registrations.get(serverId);
    if (!registration) {
      throw new Error(`Server ${serverId} not registered`);
    }

    for (const depId of registration.definition.dependencies) {
      const depRegistration = this.registrations.get(depId);
      if (!depRegistration) {
        throw new Error(`Dependency ${depId} not registered for server ${serverId}`);
      }

      if (depRegistration.status === 'uninitialized') {
        await this.initializeServer(depId);
      } else if (depRegistration.status === 'initializing') {
        await this.waitForInitialization(depId);
      }
    }
  }

  /**
   * Wait for a server to complete initialization
   */
  private async waitForInitialization(serverId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const checkStatus = () => {
        const registration = this.registrations.get(serverId);
        if (!registration) {
          reject(new Error(`Server ${serverId} not found`));
          return;
        }

        if (registration.status === 'ready') {
          resolve();
        } else if (registration.status === 'error') {
          reject(registration.lastError || new Error(`Server ${serverId} failed`));
        } else {
          // Still initializing, check again shortly
          setTimeout(checkStatus, 100);
        }
      };

      checkStatus();
    });
  }

  /**
   * Wait for an initialization slot to become available
   */
  private async waitForInitializationSlot(): Promise<void> {
    return new Promise(resolve => {
      const checkSlot = () => {
        if (this.currentInitializations < this.maxConcurrentInit) {
          resolve();
        } else {
          setTimeout(checkSlot, 50);
        }
      };
      checkSlot();
    });
  }

  /**
   * Update dependency graph for efficient resolution
   */
  private updateDependencyGraph(definition: MCPServerDefinition): void {
    // Remove old dependencies
    this.dependencyGraph.delete(definition.id);

    // Add new dependencies
    for (const depId of definition.dependencies) {
      if (!this.dependencyGraph.has(depId)) {
        this.dependencyGraph.set(depId, new Set());
      }
      const dependents = this.dependencyGraph.get(depId);
      if (dependents) {
        dependents.add(definition.id);
      }
    }
  }

  /**
   * Get registration status for monitoring
   */
  public getRegistrationStatus(): {
    total: number;
    ready: number;
    initializing: number;
    failed: number;
    disabled: number;
    memoryUsage: number;
  } {
    const stats = {
      total: this.registrations.size,
      ready: 0,
      initializing: 0,
      failed: 0,
      disabled: 0,
      memoryUsage: 0,
    };

    for (const reg of this.registrations.values()) {
      switch (reg.status) {
        case 'ready':
          stats.ready++;
          break;
        case 'initializing':
          stats.initializing++;
          break;
        case 'error':
          stats.failed++;
          break;
        case 'disabled':
          stats.disabled++;
          break;
        default:
          // Handles 'uninitialized' and any unexpected status
          break;
      }

      if (reg.memoryUsage) {
        stats.memoryUsage += reg.memoryUsage;
      }
    }

    return stats;
  }

  /**
   * Get list of registered server IDs
   */
  public getRegisteredServerIds(): string[] {
    return Array.from(this.registrations.keys());
  }

  /**
   * Check if server is available (registered and not disabled)
   */
  public isServerAvailable(serverId: string): boolean {
    const registration = this.registrations.get(serverId);
    return registration ? registration.status !== 'disabled' : false;
  }

  /**
   * Disable a server (prevents initialization)
   */
  public disableServer(serverId: string): void {
    const registration = this.registrations.get(serverId);
    if (registration) {
      registration.status = 'disabled';
      logger.info(`🚫 Server ${serverId} disabled`);
      this.emit('serverDisabled', serverId);
    }
  }

  /**
   * Enable a disabled server
   */
  public enableServer(serverId: string): void {
    const registration = this.registrations.get(serverId);
    if (registration && registration.status === 'disabled') {
      registration.status = 'uninitialized';
      logger.info(`✅ Server ${serverId} enabled`);
      this.emit('serverEnabled', serverId);
    }
  }

  /**
   * Cleanup resources
   */
  private cleanup(): void {
    this.removeAllListeners();
    this.registrations.clear();
    this.initializationQueue.clear();
    this.dependencyGraph.clear();
  }

  private formatBytes(bytes: number): string {
    // FIXED: Handle NaN, negative, and invalid values
    if (isNaN(bytes) || bytes < 0 || !isFinite(bytes)) {
      return '0 B';
    }
    if (bytes === 0) return '0 B';

    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    // Ensure index is within bounds
    const sizeIndex = Math.min(Math.max(i, 0), sizes.length - 1);
    const value = bytes / Math.pow(k, sizeIndex);

    return `${parseFloat(value.toFixed(2))} ${sizes[sizeIndex]}`;
  }
}

// Export singleton instance
export const mcpServerRegistry = new MCPServerRegistry();
