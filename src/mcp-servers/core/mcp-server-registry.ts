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
  config: any;
  enabled: boolean;
  priority: number; // 1-10, higher = higher priority
  lazyLoad: boolean; // If true, only initialize when needed
  dependencies: string[]; // Other server IDs this depends on
}

export interface ServerRegistration {
  definition: MCPServerDefinition;
  instance?: any; // Lazy-loaded server instance
  status: 'uninitialized' | 'initializing' | 'ready' | 'error' | 'disabled';
  lastError?: Error;
  initializationTime?: number;
  memoryUsage?: number;
}

/**
 * Lightweight server registry with dependency injection support
 */
export class MCPServerRegistry extends EventEmitter {
  private registrations: Map<string, ServerRegistration> = new Map();
  private initializationQueue: Set<string> = new Set();
  private dependencyGraph: Map<string, Set<string>> = new Map(); // serverId -> dependents

  // Memory management
  private maxConcurrentInit = 3; // Limit concurrent initializations
  private currentInitializations = 0;
  private _initialized = false;

  constructor() {
    super();

    // Configure event emitter for memory efficiency
    this.setMaxListeners(50); // Reasonable limit

    // Clean up listeners on process exit
    process.on('beforeExit', () => this.cleanup());
  }

  /**
   * Register a server definition (no initialization)
   */
  register(definition: MCPServerDefinition): void {
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
  async getServer(serverId: string): Promise<any> {
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
    const registration = this.registrations.get(serverId)!;

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

      // Track initialization metrics
      const initTime = Date.now() - startTime;
      const memoryUsed = process.memoryUsage().heapUsed - initialMemory;

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
  private async createServerInstance(definition: MCPServerDefinition): Promise<any> {
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
        return new SmitheryMCPServer(definition.config);
      }

      default:
        throw new Error(`Unknown server type: ${definition.type}`);
    }
  }

  /**
   * Initialize all dependencies for a server
   */
  private async initializeDependencies(serverId: string): Promise<void> {
    const registration = this.registrations.get(serverId)!;

    for (const depId of registration.definition.dependencies) {
      if (!this.registrations.has(depId)) {
        throw new Error(`Dependency ${depId} not registered for server ${serverId}`);
      }

      const depRegistration = this.registrations.get(depId)!;
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
      this.dependencyGraph.get(depId)!.add(definition.id);
    }
  }

  /**
   * Get registration status for monitoring
   */
  getRegistrationStatus(): {
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
  getRegisteredServerIds(): string[] {
    return Array.from(this.registrations.keys());
  }

  /**
   * Check if server is available (registered and not disabled)
   */
  isServerAvailable(serverId: string): boolean {
    const registration = this.registrations.get(serverId);
    return registration ? registration.status !== 'disabled' : false;
  }

  /**
   * Disable a server (prevents initialization)
   */
  disableServer(serverId: string): void {
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
  enableServer(serverId: string): void {
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
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}

// Export singleton instance
export const mcpServerRegistry = new MCPServerRegistry();
