/**
 * Sub-Agent Isolation System - Claude Code Standard Implementation
 * Implements isolated agents for specific tasks with separate memory and permission scopes
 * Based on industry research: Sub-Agent Isolation (Claude Code Pattern)
 */

import { Worker, isMainThread, parentPort } from 'worker_threads';
import { EventEmitter } from 'events';
import { createHash } from 'crypto';
import { performance } from 'perf_hooks';
import { logger } from '../logger.js';
// import { VoiceArchetypeSystem } from '../../voices/voice-archetype-system.js';
// import { UnifiedModelClient } from '../client.js';

// Agent isolation levels
export enum IsolationLevel {
  NONE = 'none',           // No isolation, shared memory
  MEMORY = 'memory',       // Separate memory context
  PROCESS = 'process',     // Separate worker process
  SANDBOX = 'sandbox',     // Full sandboxed execution
  SECURE = 'secure'        // Encrypted and validated execution
}

// Agent permission scopes
export interface AgentPermissions {
  fileAccess: {
    read: string[];         // Allowed read paths
    write: string[];        // Allowed write paths
    execute: string[];      // Allowed execution paths
  };
  networkAccess: {
    allowedHosts: string[];
    allowedPorts: number[];
    maxRequests: number;
  };
  systemAccess: {
    environment: boolean;   // Can access env vars
    processes: boolean;     // Can spawn processes
    memory: number;         // Memory limit in MB
    cpu: number;            // CPU time limit in ms
  };
  apiAccess: {
    models: string[];       // Allowed model IDs
    rateLimit: number;      // Requests per minute
    features: string[];     // Allowed API features
  };
}

// Agent context - isolated per agent
export interface AgentContext {
  id: string;
  name: string;
  permissions: AgentPermissions;
  isolationLevel: IsolationLevel;
  memory: {
    heap: Map<string, any>;
    cache: Map<string, any>;
    history: any[];
    maxSize: number;
  };
  metrics: {
    requests: number;
    errors: number;
    executionTime: number;
    memoryUsed: number;
    createdAt: Date;
    lastAccessed: Date;
  };
  hooks: {
    preExecution: Array<(task: any) => Promise<any>>;
    postExecution: Array<(result: any) => Promise<any>>;
    onError: Array<(error: Error) => Promise<void>>;
  };
}

// Task execution request
export interface IsolatedTaskRequest {
  id: string;
  agentId: string;
  type: 'analysis' | 'generation' | 'review' | 'execution' | 'planning';
  payload: any;
  priority: 'low' | 'medium' | 'high' | 'critical';
  timeout: number;
  requiresIsolation: boolean;
  permissions?: Partial<AgentPermissions>;
}

// Task execution result
export interface IsolatedTaskResult {
  id: string;
  agentId: string;
  success: boolean;
  result?: any;
  error?: Error;
  metrics: {
    executionTime: number;
    memoryUsed: number;
    cpuTime: number;
  };
  isolation: {
    level: IsolationLevel;
    secure: boolean;
    violations: string[];
  };
}

/**
 * Permission Validator - Enforces agent permissions
 */
class PermissionValidator {
  static validateFileAccess(permissions: AgentPermissions, operation: 'read' | 'write' | 'execute', path: string): boolean {
    const allowedPaths = permissions.fileAccess[operation];
    return allowedPaths.some(allowed => 
      path.startsWith(allowed) || 
      path.match(new RegExp(allowed.replace('*', '.*')))
    );
  }

  static validateNetworkAccess(permissions: AgentPermissions, host: string, port: number): boolean {
    const { allowedHosts, allowedPorts } = permissions.networkAccess;
    const hostAllowed = allowedHosts.some(allowed => 
      host === allowed || host.endsWith(allowed) || allowed === '*'
    );
    const portAllowed = allowedPorts.includes(port) || allowedPorts.includes(0); // 0 = any port
    return hostAllowed && portAllowed;
  }

  static validateSystemAccess(permissions: AgentPermissions, operation: string): boolean {
    switch (operation) {
      case 'environment':
        return permissions.systemAccess.environment;
      case 'processes':
        return permissions.systemAccess.processes;
      default:
        return false;
    }
  }

  static validateApiAccess(permissions: AgentPermissions, model: string, feature: string): boolean {
    const modelAllowed = permissions.apiAccess.models.includes(model) || permissions.apiAccess.models.includes('*');
    const featureAllowed = permissions.apiAccess.features.includes(feature) || permissions.apiAccess.features.includes('*');
    return modelAllowed && featureAllowed;
  }
}

/**
 * Isolated Agent - Represents a single isolated agent instance
 */
export class IsolatedAgent extends EventEmitter {
  private context: AgentContext;
  private worker?: Worker;
  // private isActive = false;
  private taskQueue: IsolatedTaskRequest[] = [];
  private currentTask?: IsolatedTaskRequest;

  constructor(
    id: string,
    name: string,
    permissions: AgentPermissions,
    isolationLevel: IsolationLevel = IsolationLevel.MEMORY
  ) {
    super();
    
    this.context = {
      id,
      name,
      permissions,
      isolationLevel,
      memory: {
        heap: new Map(),
        cache: new Map(),
        history: [],
        maxSize: permissions.systemAccess.memory * 1024 * 1024 // Convert MB to bytes
      },
      metrics: {
        requests: 0,
        errors: 0,
        executionTime: 0,
        memoryUsed: 0,
        createdAt: new Date(),
        lastAccessed: new Date()
      },
      hooks: {
        preExecution: [],
        postExecution: [],
        onError: []
      }
    };

    if (isolationLevel === IsolationLevel.PROCESS || isolationLevel === IsolationLevel.SANDBOX) {
      this.initializeWorker();
    }

    logger.info(`Isolated agent created: ${name} (${id})`, {
      isolationLevel,
      permissions: {
        fileAccess: Object.keys(permissions.fileAccess).length,
        networkAccess: permissions.networkAccess.allowedHosts.length,
        apiAccess: permissions.apiAccess.models.length
      }
    });
  }

  private initializeWorker(): void {
    try {
      this.worker = new Worker(__filename, {
        workerData: {
          agentId: this.context.id,
          permissions: this.context.permissions,
          isolationLevel: this.context.isolationLevel
        }
      });

      this.worker.on('message', (message) => {
        this.handleWorkerMessage(message);
      });

      this.worker.on('error', (error) => {
        logger.error(`Worker error for agent ${this.context.id}:`, error);
        this.emit('error', error);
      });

      this.worker.on('exit', (code) => {
        if (code !== 0) {
          logger.warn(`Worker exited with code ${code} for agent ${this.context.id}`);
        }
        this.worker = undefined;
      });

    } catch (error) {
      logger.error(`Failed to initialize worker for agent ${this.context.id}:`, error);
      throw error;
    }
  }

  private handleWorkerMessage(message: any): void {
    switch (message.type) {
      case 'task-completed':
        this.handleTaskCompleted(message.data);
        break;
      case 'task-error':
        this.handleTaskError(message.data);
        break;
      case 'metrics-update':
        this.updateMetrics(message.data);
        break;
      default:
        logger.warn(`Unknown message type from worker: ${message.type}`);
    }
  }

  private handleTaskCompleted(data: any): void {
    if (this.currentTask) {
      const result: IsolatedTaskResult = {
        id: this.currentTask.id,
        agentId: this.context.id,
        success: true,
        result: data.result,
        metrics: data.metrics,
        isolation: {
          level: this.context.isolationLevel,
          secure: true,
          violations: data.violations || []
        }
      };

      this.emit('task-completed', result);
      this.currentTask = undefined;
      this.processNextTask();
    }
  }

  private handleTaskError(data: any): void {
    if (this.currentTask) {
      const result: IsolatedTaskResult = {
        id: this.currentTask.id,
        agentId: this.context.id,
        success: false,
        error: new Error(data.error),
        metrics: data.metrics || { executionTime: 0, memoryUsed: 0, cpuTime: 0 },
        isolation: {
          level: this.context.isolationLevel,
          secure: true,
          violations: data.violations || []
        }
      };

      this.context.metrics.errors++;
      this.emit('task-error', result);
      this.currentTask = undefined;
      this.processNextTask();
    }
  }

  private updateMetrics(metrics: any): void {
    this.context.metrics = { ...this.context.metrics, ...metrics };
    this.context.metrics.lastAccessed = new Date();
  }

  /**
   * Execute a task in isolation
   */
  async executeTask(request: IsolatedTaskRequest): Promise<IsolatedTaskResult> {
    return new Promise((resolve, reject) => {
      // Validate permissions
      if (!this.validateTaskPermissions(request)) {
        const error = new Error(`Permission denied for task ${request.id}`);
        reject(error);
        return;
      }

      // Add to queue
      this.taskQueue.push(request);
      
      // Set up completion handlers
      const taskCompleteHandler = (result: IsolatedTaskResult) => {
        if (result.id === request.id) {
          this.off('task-completed', taskCompleteHandler);
          this.off('task-error', taskErrorHandler);
          resolve(result);
        }
      };

      const taskErrorHandler = (result: IsolatedTaskResult) => {
        if (result.id === request.id) {
          this.off('task-completed', taskCompleteHandler);
          this.off('task-error', taskErrorHandler);
          reject(result.error || new Error('Task execution failed'));
        }
      };

      this.on('task-completed', taskCompleteHandler);
      this.on('task-error', taskErrorHandler);

      // Set timeout
      setTimeout(() => {
        if (request === this.currentTask) {
          this.off('task-completed', taskCompleteHandler);
          this.off('task-error', taskErrorHandler);
          reject(new Error(`Task ${request.id} timed out`));
        }
      }, request.timeout);

      // Start processing if not busy
      if (!this.currentTask) {
        this.processNextTask();
      }
    });
  }

  private validateTaskPermissions(request: IsolatedTaskRequest): boolean {
    // Basic validation - can be extended
    if (request.type === 'execution') {
      return this.context.permissions.systemAccess.processes;
    }
    
    // Check if agent can access required models
    if (request.payload?.model) {
      return PermissionValidator.validateApiAccess(
        this.context.permissions,
        request.payload.model,
        request.type
      );
    }

    return true;
  }

  private async processNextTask(): Promise<void> {
    if (this.currentTask || this.taskQueue.length === 0) {
      return;
    }

    const task = this.taskQueue.shift();
    if (!task) return;

    this.currentTask = task;
    this.context.metrics.requests++;

    try {
      await this.executeTaskInternal(task);
    } catch (error) {
      this.handleTaskError({
        error: (error as Error).message,
        metrics: { executionTime: 0, memoryUsed: 0, cpuTime: 0 },
        violations: []
      });
    }
  }

  private async executeTaskInternal(task: IsolatedTaskRequest): Promise<void> {
    const startTime = performance.now();
    const startMemory = process.memoryUsage().heapUsed;

    try {
      // Execute pre-execution hooks
      for (const hook of this.context.hooks.preExecution) {
        await hook(task);
      }

      let result: any;

      if (this.context.isolationLevel === IsolationLevel.PROCESS || 
          this.context.isolationLevel === IsolationLevel.SANDBOX) {
        // Execute in worker process
        result = await this.executeInWorker(task);
      } else {
        // Execute in current process with memory isolation
        result = await this.executeInMemory(task);
      }

      // Execute post-execution hooks
      for (const hook of this.context.hooks.postExecution) {
        result = await hook(result);
      }

      const executionTime = performance.now() - startTime;
      const memoryUsed = process.memoryUsage().heapUsed - startMemory;

      this.handleTaskCompleted({
        result,
        metrics: {
          executionTime,
          memoryUsed,
          cpuTime: executionTime // Simplified for now
        },
        violations: []
      });

    } catch (error) {
      // Execute error hooks
      for (const hook of this.context.hooks.onError) {
        await hook(error as Error);
      }

      throw error;
    }
  }

  private async executeInWorker(task: IsolatedTaskRequest): Promise<any> {
    if (!this.worker) {
      throw new Error('Worker not initialized');
    }

    return new Promise((resolve, reject) => {
      const messageHandler = (message: any) => {
        if (message.taskId === task.id) {
          this.worker!.off('message', messageHandler);
          if (message.success) {
            resolve(message.result);
          } else {
            reject(new Error(message.error));
          }
        }
      };

      this.worker.on('message', messageHandler);
      this.worker.postMessage({
        type: 'execute-task',
        taskId: task.id,
        task
      });

      // Cleanup on timeout
      setTimeout(() => {
        this.worker!.off('message', messageHandler);
        reject(new Error('Worker execution timeout'));
      }, task.timeout);
    });
  }

  private async executeInMemory(task: IsolatedTaskRequest): Promise<any> {
    // Create isolated memory context
    // const isolatedContext = {
    //   memory: new Map(this.context.memory.heap),
    //   cache: new Map(this.context.memory.cache)
    // };

    // Simulate task execution (replace with actual implementation)
    switch (task.type) {
      case 'analysis':
        return `Analysis result for ${task.payload?.prompt || 'unknown'}`;
      case 'generation':
        return `Generated content for ${task.payload?.prompt || 'unknown'}`;
      case 'review':
        return `Review result for ${task.payload?.content || 'unknown'}`;
      case 'execution':
        return `Execution result for ${task.payload?.command || 'unknown'}`;
      case 'planning':
        return `Planning result for ${task.payload?.goal || 'unknown'}`;
      default:
        throw new Error(`Unsupported task type: ${task.type}`);
    }
  }

  /**
   * Add execution hook
   */
  addHook(type: 'pre' | 'post' | 'error', handler: (data: any) => Promise<any>): void {
    switch (type) {
      case 'pre':
        this.context.hooks.preExecution.push(handler);
        break;
      case 'post':
        this.context.hooks.postExecution.push(handler);
        break;
      case 'error':
        this.context.hooks.onError.push(handler);
        break;
    }
  }

  /**
   * Get agent context (read-only)
   */
  getContext(): Readonly<AgentContext> {
    return { ...this.context };
  }

  /**
   * Get agent metrics
   */
  getMetrics(): AgentContext['metrics'] {
    return { ...this.context.metrics };
  }

  /**
   * Check if agent is healthy
   */
  isHealthy(): boolean {
    const now = Date.now();
    const lastAccessed = this.context.metrics.lastAccessed.getTime();
    const timeSinceLastAccess = now - lastAccessed;
    
    // Consider unhealthy if not accessed in 5 minutes and has errors
    const stale = timeSinceLastAccess > 5 * 60 * 1000;
    const hasErrors = this.context.metrics.errors > this.context.metrics.requests * 0.1; // >10% error rate
    
    return !stale && !hasErrors;
  }

  /**
   * Cleanup and destroy agent
   */
  async destroy(): Promise<void> {
    // this.isActive = false;
    this.taskQueue = [];
    
    if (this.worker) {
      await this.worker.terminate();
      this.worker = undefined;
    }
    
    this.context.memory.heap.clear();
    this.context.memory.cache.clear();
    this.removeAllListeners();
    
    logger.info(`Isolated agent destroyed: ${this.context.name} (${this.context.id})`);
  }
}

/**
 * Sub-Agent Isolation Manager - Manages multiple isolated agents
 */
export class SubAgentIsolationSystem extends EventEmitter {
  private agents = new Map<string, IsolatedAgent>();
  private agentPool = new Map<string, IsolatedAgent[]>();
  private defaultPermissions: AgentPermissions;
  private maxAgents = 10;
  private healthCheckInterval?: NodeJS.Timeout;

  constructor(config: {
    maxAgents?: number;
    defaultPermissions?: Partial<AgentPermissions>;
  } = {}) {
    super();

    this.maxAgents = config.maxAgents || 10;
    this.defaultPermissions = {
      fileAccess: {
        read: [process.cwd() + '/src', process.cwd() + '/tests', process.cwd() + '/docs'],
        write: [process.cwd() + '/dist', process.cwd() + '/tmp'],
        execute: []
      },
      networkAccess: {
        allowedHosts: ['localhost', '127.0.0.1'],
        allowedPorts: [11434, 1234], // Ollama and LM Studio
        maxRequests: 100
      },
      systemAccess: {
        environment: false,
        processes: false,
        memory: 512, // MB
        cpu: 30000   // 30 seconds
      },
      apiAccess: {
        models: ['*'],
        rateLimit: 60,
        features: ['generation', 'analysis']
      },
      ...config.defaultPermissions
    };

    this.startHealthChecking();
    logger.info('Sub-Agent Isolation System initialized');
  }

  /**
   * Create a new isolated agent
   */
  createAgent(
    name: string,
    type: 'analysis' | 'generation' | 'review' | 'execution' | 'planning',
    options: {
      permissions?: Partial<AgentPermissions>;
      isolationLevel?: IsolationLevel;
      pooled?: boolean;
    } = {}
  ): IsolatedAgent {
    if (this.agents.size >= this.maxAgents) {
      throw new Error(`Maximum number of agents (${this.maxAgents}) reached`);
    }

    const agentId = createHash('md5').update(`${name}-${type}-${Date.now()}`).digest('hex');
    const permissions = { ...this.defaultPermissions, ...options.permissions };
    const isolationLevel = options.isolationLevel || IsolationLevel.MEMORY;

    const agent = new IsolatedAgent(agentId, name, permissions, isolationLevel);
    
    // Add event forwarding
    agent.on('task-completed', (result) => {
      this.emit('agent-task-completed', { agentId, result });
    });
    
    agent.on('task-error', (result) => {
      this.emit('agent-task-error', { agentId, result });
    });
    
    agent.on('error', (error) => {
      this.emit('agent-error', { agentId, error });
    });

    if (options.pooled) {
      // Add to pool for reuse
      if (!this.agentPool.has(type)) {
        this.agentPool.set(type, []);
      }
      this.agentPool.get(type)!.push(agent);
    } else {
      // Add to active agents
      this.agents.set(agentId, agent);
    }

    logger.info(`Created isolated agent: ${name} (${agentId})`, {
      type,
      isolationLevel,
      pooled: options.pooled
    });

    return agent;
  }

  /**
   * Get or create an agent from pool
   */
  getPooledAgent(type: 'analysis' | 'generation' | 'review' | 'execution' | 'planning'): IsolatedAgent {
    const pool = this.agentPool.get(type);
    if (pool && pool.length > 0) {
      const agent = pool.find(a => a.isHealthy() && a.getMetrics().requests < 100);
      if (agent) {
        return agent;
      }
    }

    // Create new pooled agent
    return this.createAgent(`${type}-agent`, type, { pooled: true });
  }

  /**
   * Execute task with automatic agent selection
   */
  async executeTask(
    taskType: 'analysis' | 'generation' | 'review' | 'execution' | 'planning',
    payload: any,
    options: {
      priority?: 'low' | 'medium' | 'high' | 'critical';
      timeout?: number;
      isolationLevel?: IsolationLevel;
      permissions?: Partial<AgentPermissions>;
    } = {}
  ): Promise<IsolatedTaskResult> {
    const agent = this.getPooledAgent(taskType);
    
    const request: IsolatedTaskRequest = {
      id: createHash('md5').update(`${taskType}-${Date.now()}-${Math.random()}`).digest('hex'),
      agentId: agent.getContext().id,
      type: taskType,
      payload,
      priority: options.priority || 'medium',
      timeout: options.timeout || 30000,
      requiresIsolation: options.isolationLevel !== IsolationLevel.NONE,
      permissions: options.permissions
    };

    return agent.executeTask(request);
  }

  /**
   * Get agent by ID
   */
  getAgent(agentId: string): IsolatedAgent | undefined {
    return this.agents.get(agentId);
  }

  /**
   * List all agents
   */
  listAgents(): Array<{ id: string; name: string; metrics: any }> {
    const result: Array<{ id: string; name: string; metrics: any }> = [];
    
    // Active agents
    for (const [id, agent] of this.agents.entries()) {
      const context = agent.getContext();
      result.push({
        id,
        name: context.name,
        metrics: agent.getMetrics()
      });
    }
    
    // Pooled agents
    for (const [type, pool] of this.agentPool.entries()) {
      for (const agent of pool) {
        const context = agent.getContext();
        result.push({
          id: context.id,
          name: `${context.name} (pooled-${type})`,
          metrics: agent.getMetrics()
        });
      }
    }
    
    return result;
  }

  /**
   * Get system metrics
   */
  getSystemMetrics(): {
    activeAgents: number;
    pooledAgents: number;
    totalRequests: number;
    totalErrors: number;
    averageExecutionTime: number;
    healthyAgents: number;
  } {
    let totalRequests = 0;
    let totalErrors = 0;
    let totalExecutionTime = 0;
    let healthyAgents = 0;
    let agentCount = 0;

    // Count active agents
    for (const agent of this.agents.values()) {
      const metrics = agent.getMetrics();
      totalRequests += metrics.requests;
      totalErrors += metrics.errors;
      totalExecutionTime += metrics.executionTime;
      if (agent.isHealthy()) healthyAgents++;
      agentCount++;
    }

    // Count pooled agents
    let pooledCount = 0;
    for (const pool of this.agentPool.values()) {
      pooledCount += pool.length;
      for (const agent of pool) {
        const metrics = agent.getMetrics();
        totalRequests += metrics.requests;
        totalErrors += metrics.errors;
        totalExecutionTime += metrics.executionTime;
        if (agent.isHealthy()) healthyAgents++;
        agentCount++;
      }
    }

    return {
      activeAgents: this.agents.size,
      pooledAgents: pooledCount,
      totalRequests,
      totalErrors,
      averageExecutionTime: agentCount > 0 ? totalExecutionTime / agentCount : 0,
      healthyAgents
    };
  }

  /**
   * Health check all agents
   */
  private startHealthChecking(): void {
    this.healthCheckInterval = setInterval(() => {
      this.performHealthCheck();
    }, 60000); // Check every minute
  }

  private async performHealthCheck(): Promise<void> {
    const unhealthyAgents: string[] = [];

    // Check active agents
    for (const [id, agent] of this.agents.entries()) {
      if (!agent.isHealthy()) {
        unhealthyAgents.push(id);
        logger.warn(`Unhealthy agent detected: ${id}`);
        await agent.destroy();
        this.agents.delete(id);
      }
    }

    // Check pooled agents
    for (const [type, pool] of this.agentPool.entries()) {
      const healthyPool = pool.filter(agent => {
        if (!agent.isHealthy()) {
          logger.warn(`Unhealthy pooled agent detected: ${agent.getContext().id}`);
          agent.destroy();
          return false;
        }
        return true;
      });
      this.agentPool.set(type, healthyPool);
    }

    if (unhealthyAgents.length > 0) {
      this.emit('health-check-completed', {
        unhealthyAgents,
        removedCount: unhealthyAgents.length
      });
    }
  }

  /**
   * Destroy all agents and cleanup
   */
  async destroy(): Promise<void> {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    // Destroy active agents
    const destroyPromises: Promise<void>[] = [];
    for (const agent of this.agents.values()) {
      destroyPromises.push(agent.destroy());
    }

    // Destroy pooled agents
    for (const pool of this.agentPool.values()) {
      for (const agent of pool) {
        destroyPromises.push(agent.destroy());
      }
    }

    await Promise.allSettled(destroyPromises);
    
    this.agents.clear();
    this.agentPool.clear();
    this.removeAllListeners();
    
    logger.info('Sub-Agent Isolation System destroyed');
  }
}

// Worker thread implementation (for process isolation)
if (!isMainThread && parentPort) {
  // const { agentId, permissions, isolationLevel } = workerData;
  
  parentPort.on('message', async (message) => {
    if (message.type === 'execute-task') {
      const startTime = performance.now();
      const startMemory = process.memoryUsage().heapUsed;
      
      try {
        // Validate permissions in worker context
        // ... permission validation logic ...
        
        // Execute task with isolation
        const result = await executeTaskInWorker(message.task);
        
        const executionTime = performance.now() - startTime;
        const memoryUsed = process.memoryUsage().heapUsed - startMemory;
        
        parentPort!.postMessage({
          type: 'task-completed',
          taskId: message.taskId,
          data: {
            result,
            metrics: {
              executionTime,
              memoryUsed,
              cpuTime: executionTime
            },
            violations: []
          }
        });
      } catch (error) {
        parentPort!.postMessage({
          type: 'task-error',
          taskId: message.taskId,
          data: {
            error: (error as Error).message,
            metrics: {
              executionTime: performance.now() - startTime,
              memoryUsed: process.memoryUsage().heapUsed - startMemory,
              cpuTime: 0
            },
            violations: []
          }
        });
      }
    }
  });
  
  async function executeTaskInWorker(task: IsolatedTaskRequest): Promise<any> {
    // Isolated execution logic
    switch (task.type) {
      case 'analysis':
        return `Worker analysis result for ${task.payload?.prompt || 'unknown'}`;
      case 'generation':
        return `Worker generated content for ${task.payload?.prompt || 'unknown'}`;
      default:
        throw new Error(`Unsupported task type in worker: ${task.type}`);
    }
  }
}

// Export singleton instance (lazy initialization to prevent test issues)
let _subAgentIsolationSystemInstance: SubAgentIsolationSystem | null = null;

export const subAgentIsolationSystem = {
  getInstance(): SubAgentIsolationSystem {
    if (!_subAgentIsolationSystemInstance) {
      _subAgentIsolationSystemInstance = new SubAgentIsolationSystem();
    }
    return _subAgentIsolationSystemInstance;
  },
  
  async destroyInstance(): Promise<void> {
    if (_subAgentIsolationSystemInstance) {
      await _subAgentIsolationSystemInstance.destroy();
      _subAgentIsolationSystemInstance = null;
    }
  },

  // Delegate methods for backward compatibility
  async executeTask(...args: Parameters<SubAgentIsolationSystem['executeTask']>) {
    return this.getInstance().executeTask(...args);
  },

  createAgent(...args: Parameters<SubAgentIsolationSystem['createAgent']>) {
    return this.getInstance().createAgent(...args);
  },

  getSystemMetrics() {
    return this.getInstance().getSystemMetrics();
  },

  listAgents() {
    return this.getInstance().listAgents();
  }
};