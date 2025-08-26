/**
 * Resource Coordination Manager
 * 
 * ADDRESSES CRITICAL ARCHITECTURE ISSUES:
 * - Issue #11: Resource Contention (centralized resource coordination)
 * - Issue #6: Cache System Conflicts (unified cache access coordination)
 * - Issue #8: Resource Contention (memory, compute, and network resource management)
 * 
 * PURPOSE: Coordinate access to shared resources across all systems
 * to prevent conflicts and ensure optimal resource utilization
 */

import { EventEmitter } from 'events';
import { logger } from '../logger.js';

export interface ResourceDefinition {
  id: string;
  type: ResourceType;
  category: ResourceCategory;
  maxConcurrentAccess: number;
  priority: ResourcePriority;
  metadata: ResourceMetadata;
}

export type ResourceType = 
  | 'cache_layer'           // Cache storage access
  | 'memory_pool'           // Memory allocation
  | 'compute_thread'        // CPU computation
  | 'network_connection'    // Network I/O
  | 'file_handle'          // File system access  
  | 'model_instance'       // AI model instance
  | 'voice_processor'      // Voice processing unit
  | 'database_connection'  // Database access
  | 'external_api'         // External API calls
  | 'temporary_storage';   // Temporary file/data storage

export type ResourceCategory = 'critical' | 'important' | 'normal' | 'low_priority';
export type ResourcePriority = 'system' | 'user' | 'background' | 'cleanup';

export interface ResourceMetadata {
  description: string;
  owner: string;
  created: Date;
  estimatedLatency?: number;
  estimatedCost?: number;
  dependencies?: string[];
  conflictsWith?: string[];
}

export interface ResourceAccessRequest {
  id: string;
  requesterId: string;
  resourceId: string;
  accessType: 'read' | 'write' | 'exclusive';
  priority: ResourcePriority;
  timeoutMs?: number;
  metadata?: Record<string, any>;
}

export interface ResourceLock {
  id: string;
  resourceId: string;
  requesterId: string;
  accessType: 'read' | 'write' | 'exclusive';
  acquiredAt: Date;
  expiresAt: Date;
  metadata?: Record<string, any>;
}

export interface ResourceUsageMetrics {
  resourceId: string;
  totalRequests: number;
  currentlyHeld: number;
  averageHoldTime: number;
  contentionRate: number; // Percentage of requests that had to wait
  lastAccessed: Date;
  topUsers: Array<{ requesterId: string; requestCount: number }>;
}

interface ResourceState {
  definition: ResourceDefinition;
  activeLocks: Map<string, ResourceLock>;
  waitQueue: Array<{
    request: ResourceAccessRequest;
    resolve: (lock: ResourceLock) => void;
    reject: (error: Error) => void;
    queuedAt: Date;
  }>;
  metrics: ResourceUsageMetrics;
}

/**
 * Resource Coordination Manager
 * 
 * Features:
 * - Centralized resource access coordination
 * - Priority-based resource allocation
 * - Conflict detection and resolution
 * - Resource usage monitoring and optimization
 * - Deadlock detection and prevention
 * - Fair resource allocation algorithms
 */
export class ResourceCoordinationManager extends EventEmitter {
  private static instance: ResourceCoordinationManager | null = null;
  
  private resources = new Map<string, ResourceState>();
  private locksByRequester = new Map<string, Set<string>>();
  private deadlockDetectionEnabled = true;
  private metricsCollectionEnabled = true;
  private cleanupInterval: NodeJS.Timeout;
  private monitoringInterval: NodeJS.Timeout;
  
  // Configuration
  private config = {
    defaultTimeoutMs: 30000,
    maxQueueSize: 100,
    cleanupIntervalMs: 60000,
    monitoringIntervalMs: 10000,
    enableFairness: true,
    enablePriorityBoosting: true,
    maxHoldTimeMs: 300000, // 5 minutes max hold time
  };
  
  private constructor() {
    super();
    this.setupDefaultResources();
    this.startBackgroundTasks();
  }
  
  static getInstance(): ResourceCoordinationManager {
    if (!ResourceCoordinationManager.instance) {
      ResourceCoordinationManager.instance = new ResourceCoordinationManager();
    }
    return ResourceCoordinationManager.instance;
  }
  
  /**
   * Register a new resource for coordination
   */
  registerResource(definition: ResourceDefinition): void {
    if (this.resources.has(definition.id)) {
      logger.warn(`⚠️ Resource already registered: ${definition.id}`);
      return;
    }
    
    const state: ResourceState = {
      definition,
      activeLocks: new Map(),
      waitQueue: [],
      metrics: {
        resourceId: definition.id,
        totalRequests: 0,
        currentlyHeld: 0,
        averageHoldTime: 0,
        contentionRate: 0,
        lastAccessed: new Date(),
        topUsers: []
      }
    };
    
    this.resources.set(definition.id, state);
    
    logger.info(`📦 Registered resource: ${definition.id} (${definition.type}, max: ${definition.maxConcurrentAccess})`);
    this.emit('resource-registered', definition);
  }
  
  /**
   * Request access to a resource
   */
  async requestResource(request: ResourceAccessRequest): Promise<ResourceLock> {
    const resourceState = this.resources.get(request.resourceId);
    
    if (!resourceState) {
      throw new Error(`Resource not found: ${request.resourceId}`);
    }
    
    // Update metrics
    resourceState.metrics.totalRequests++;
    resourceState.metrics.lastAccessed = new Date();
    
    // Check for deadlock potential
    if (this.deadlockDetectionEnabled) {
      this.checkForPotentialDeadlock(request);
    }
    
    // Try immediate allocation
    const immediateLock = this.tryImmediateAllocation(resourceState, request);
    if (immediateLock) {
      this.recordLockAcquisition(immediateLock);
      logger.debug(`🔓 Immediate resource access: ${request.resourceId} by ${request.requesterId}`);
      return immediateLock;
    }
    
    // Queue the request
    return this.queueResourceRequest(resourceState, request);
  }
  
  /**
   * Release a resource lock
   */
  async releaseResource(lock: ResourceLock): Promise<void> {
    const resourceState = this.resources.get(lock.resourceId);
    
    if (!resourceState) {
      throw new Error(`Resource not found for lock: ${lock.resourceId}`);
    }
    
    // Remove the lock
    const removed = resourceState.activeLocks.delete(lock.id);
    if (!removed) {
      logger.warn(`⚠️ Lock not found for release: ${lock.id}`);
      return;
    }
    
    // Update requester tracking
    const requesterLocks = this.locksByRequester.get(lock.requesterId);
    if (requesterLocks) {
      requesterLocks.delete(lock.id);
      if (requesterLocks.size === 0) {
        this.locksByRequester.delete(lock.requesterId);
      }
    }
    
    // Update metrics
    const holdTime = Date.now() - lock.acquiredAt.getTime();
    this.updateHoldTimeMetrics(resourceState.metrics, holdTime);
    resourceState.metrics.currentlyHeld = resourceState.activeLocks.size;
    
    logger.debug(`🔒 Resource released: ${lock.resourceId} by ${lock.requesterId} (held ${holdTime}ms)`);
    this.emit('resource-released', lock);
    
    // Process wait queue
    this.processWaitQueue(resourceState);
  }
  
  /**
   * Get resource usage statistics
   */
  getResourceMetrics(resourceId?: string): ResourceUsageMetrics[] {
    if (resourceId) {
      const state = this.resources.get(resourceId);
      return state ? [state.metrics] : [];
    }
    
    return Array.from(this.resources.values()).map(state => state.metrics);
  }
  
  /**
   * Get system-wide resource coordination status
   */
  getCoordinationStatus(): {
    totalResources: number;
    totalActiveLocks: number;
    totalQueuedRequests: number;
    contentionHotspots: Array<{ resourceId: string; contention: number }>;
    deadlockRisk: 'low' | 'medium' | 'high';
    recommendations: string[];
  } {
    let totalActiveLocks = 0;
    let totalQueuedRequests = 0;
    const contentionHotspots: Array<{ resourceId: string; contention: number }> = [];
    
    for (const [resourceId, state] of this.resources) {
      totalActiveLocks += state.activeLocks.size;
      totalQueuedRequests += state.waitQueue.length;
      
      if (state.metrics.contentionRate > 0.3) { // 30% contention threshold
        contentionHotspots.push({
          resourceId,
          contention: state.metrics.contentionRate
        });
      }
    }
    
    // Sort contention hotspots by severity
    contentionHotspots.sort((a, b) => b.contention - a.contention);
    
    const deadlockRisk = this.assessDeadlockRisk();
    const recommendations = this.generateOptimizationRecommendations();
    
    return {
      totalResources: this.resources.size,
      totalActiveLocks,
      totalQueuedRequests,
      contentionHotspots,
      deadlockRisk,
      recommendations
    };
  }
  
  /**
   * Force release resources held by a specific requester (emergency cleanup)
   */
  async forceReleaseByRequester(requesterId: string): Promise<number> {
    const requesterLocks = this.locksByRequester.get(requesterId);
    if (!requesterLocks) return 0;
    
    let releasedCount = 0;
    
    for (const lockId of requesterLocks) {
      // Find the lock across all resources
      for (const [resourceId, state] of this.resources) {
        const lock = state.activeLocks.get(lockId);
        if (lock && lock.requesterId === requesterId) {
          await this.releaseResource(lock);
          releasedCount++;
          break;
        }
      }
    }
    
    logger.warn(`⚠️ Force-released ${releasedCount} resources for requester: ${requesterId}`);
    this.emit('force-release', { requesterId, releasedCount });
    
    return releasedCount;
  }
  
  // Private Methods
  
  private setupDefaultResources(): void {
    // Define standard system resources
    const defaultResources: ResourceDefinition[] = [
      {
        id: 'unified_cache_memory',
        type: 'cache_layer',
        category: 'critical',
        maxConcurrentAccess: 10,
        priority: 'system',
        metadata: {
          description: 'Unified cache service memory layer access',
          owner: 'UnifiedCacheService',
          created: new Date()
        }
      },
      {
        id: 'voice_processing_pool',
        type: 'voice_processor',
        category: 'important',
        maxConcurrentAccess: 3,
        priority: 'user',
        metadata: {
          description: 'Voice archetype processing units',
          owner: 'VoiceSystemIntegration2025',
          created: new Date()
        }
      },
      {
        id: 'model_inference_pool',
        type: 'model_instance',
        category: 'critical',
        maxConcurrentAccess: 5,
        priority: 'user',
        metadata: {
          description: 'AI model inference instances',
          owner: 'IntelligentRoutingCoordinator',
          created: new Date()
        }
      },
      {
        id: 'mcp_connection_pool',
        type: 'network_connection',
        category: 'important',
        maxConcurrentAccess: 20,
        priority: 'user',
        metadata: {
          description: 'MCP server connection pool',
          owner: 'UnifiedMCPConnectionService',
          created: new Date()
        }
      },
      {
        id: 'configuration_storage',
        type: 'file_handle',
        category: 'critical',
        maxConcurrentAccess: 1,
        priority: 'system',
        metadata: {
          description: 'Configuration file access coordination',
          owner: 'UnifiedConfigService',
          created: new Date()
        }
      }
    ];
    
    for (const resource of defaultResources) {
      this.registerResource(resource);
    }
    
    logger.info(`🎯 Registered ${defaultResources.length} default system resources`);
  }
  
  private tryImmediateAllocation(
    resourceState: ResourceState, 
    request: ResourceAccessRequest
  ): ResourceLock | null {
    const { definition, activeLocks } = resourceState;
    
    // Check if resource is available
    if (request.accessType === 'exclusive') {
      // Exclusive access requires no other locks
      if (activeLocks.size > 0) return null;
    } else if (request.accessType === 'write') {
      // Write access requires no other locks
      if (activeLocks.size > 0) return null;
    } else {
      // Read access can coexist with other reads but not writes
      const hasWriteLocks = Array.from(activeLocks.values())
        .some(lock => lock.accessType === 'write' || lock.accessType === 'exclusive');
      
      if (hasWriteLocks || activeLocks.size >= definition.maxConcurrentAccess) {
        return null;
      }
    }
    
    // Create lock
    const lock: ResourceLock = {
      id: `lock_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      resourceId: request.resourceId,
      requesterId: request.requesterId,
      accessType: request.accessType,
      acquiredAt: new Date(),
      expiresAt: new Date(Date.now() + (request.timeoutMs || this.config.defaultTimeoutMs)),
      metadata: request.metadata
    };
    
    return lock;
  }
  
  private async queueResourceRequest(
    resourceState: ResourceState,
    request: ResourceAccessRequest
  ): Promise<ResourceLock> {
    if (resourceState.waitQueue.length >= this.config.maxQueueSize) {
      throw new Error(`Resource queue full for: ${request.resourceId}`);
    }
    
    return new Promise((resolve, reject) => {
      const queueEntry = {
        request,
        resolve,
        reject,
        queuedAt: new Date()
      };
      
      // Insert based on priority (higher priority first)
      const priorityOrder = { 'system': 0, 'user': 1, 'background': 2, 'cleanup': 3 };
      let insertIndex = resourceState.waitQueue.length;
      
      if (this.config.enableFairness) {
        // Find insertion point based on priority
        for (let i = 0; i < resourceState.waitQueue.length; i++) {
          const existingPriority = priorityOrder[resourceState.waitQueue[i].request.priority];
          const newPriority = priorityOrder[request.priority];
          
          if (newPriority < existingPriority) {
            insertIndex = i;
            break;
          }
        }
      }
      
      resourceState.waitQueue.splice(insertIndex, 0, queueEntry);
      
      // Set timeout
      const timeoutMs = request.timeoutMs || this.config.defaultTimeoutMs;
      setTimeout(() => {
        const index = resourceState.waitQueue.findIndex(entry => entry === queueEntry);
        if (index >= 0) {
          resourceState.waitQueue.splice(index, 1);
          reject(new Error(`Resource request timeout: ${request.resourceId}`));
        }
      }, timeoutMs);
      
      logger.debug(`⏳ Queued resource request: ${request.resourceId} by ${request.requesterId} (queue size: ${resourceState.waitQueue.length})`);
      this.emit('resource-queued', { request, queueSize: resourceState.waitQueue.length });
    });
  }
  
  private processWaitQueue(resourceState: ResourceState): void {
    while (resourceState.waitQueue.length > 0) {
      const nextEntry = resourceState.waitQueue[0];
      const lock = this.tryImmediateAllocation(resourceState, nextEntry.request);
      
      if (lock) {
        resourceState.waitQueue.shift();
        this.recordLockAcquisition(lock);
        nextEntry.resolve(lock);
        
        logger.debug(`✅ Queue processed: ${lock.resourceId} for ${lock.requesterId}`);
        this.emit('resource-allocated-from-queue', lock);
      } else {
        break; // Can't allocate next request, stop processing
      }
    }
    
    // Update contention metrics
    const totalRequests = resourceState.metrics.totalRequests;
    const queuedRequests = resourceState.waitQueue.length;
    
    if (totalRequests > 0) {
      resourceState.metrics.contentionRate = queuedRequests / totalRequests;
    }
  }
  
  private recordLockAcquisition(lock: ResourceLock): void {
    const resourceState = this.resources.get(lock.resourceId);
    if (!resourceState) return;
    
    resourceState.activeLocks.set(lock.id, lock);
    resourceState.metrics.currentlyHeld = resourceState.activeLocks.size;
    
    // Track locks by requester
    let requesterLocks = this.locksByRequester.get(lock.requesterId);
    if (!requesterLocks) {
      requesterLocks = new Set();
      this.locksByRequester.set(lock.requesterId, requesterLocks);
    }
    requesterLocks.add(lock.id);
  }
  
  private updateHoldTimeMetrics(metrics: ResourceUsageMetrics, holdTime: number): void {
    // Update average hold time using exponential moving average
    if (metrics.averageHoldTime === 0) {
      metrics.averageHoldTime = holdTime;
    } else {
      metrics.averageHoldTime = (metrics.averageHoldTime * 0.8) + (holdTime * 0.2);
    }
  }
  
  private checkForPotentialDeadlock(request: ResourceAccessRequest): void {
    const requesterLocks = this.locksByRequester.get(request.requesterId);
    if (!requesterLocks || requesterLocks.size === 0) return;
    
    // Simple deadlock detection: check if requesters are waiting for each other
    const resourceState = this.resources.get(request.resourceId);
    if (!resourceState) return;
    
    for (const [lockId, lock] of resourceState.activeLocks) {
      const otherRequesterLocks = this.locksByRequester.get(lock.requesterId);
      if (!otherRequesterLocks) continue;
      
      // Check if other requester has resources that this requester holds
      for (const otherLockId of otherRequesterLocks) {
        if (requesterLocks.has(otherLockId)) {
          logger.warn(`⚠️ Potential deadlock detected between ${request.requesterId} and ${lock.requesterId}`);
          this.emit('potential-deadlock', {
            requester1: request.requesterId,
            requester2: lock.requesterId,
            resource: request.resourceId
          });
          break;
        }
      }
    }
  }
  
  private assessDeadlockRisk(): 'low' | 'medium' | 'high' {
    let riskScore = 0;
    
    // Risk factors:
    // 1. Multiple locks per requester
    // 2. Long wait queues
    // 3. High resource utilization
    
    for (const [requesterId, locks] of this.locksByRequester) {
      if (locks.size > 2) riskScore += locks.size * 0.1;
    }
    
    for (const state of this.resources.values()) {
      if (state.waitQueue.length > 5) riskScore += state.waitQueue.length * 0.05;
      if (state.activeLocks.size / state.definition.maxConcurrentAccess > 0.8) riskScore += 0.2;
    }
    
    if (riskScore < 0.3) return 'low';
    if (riskScore < 0.7) return 'medium';
    return 'high';
  }
  
  private generateOptimizationRecommendations(): string[] {
    const recommendations: string[] = [];
    
    for (const [resourceId, state] of this.resources) {
      if (state.metrics.contentionRate > 0.5) {
        recommendations.push(`High contention on ${resourceId}: consider increasing maxConcurrentAccess`);
      }
      
      if (state.metrics.averageHoldTime > 60000) { // 1 minute
        recommendations.push(`Long hold times on ${resourceId}: review resource usage patterns`);
      }
      
      if (state.waitQueue.length > state.definition.maxConcurrentAccess * 2) {
        recommendations.push(`Large queue for ${resourceId}: consider resource pooling or caching`);
      }
    }
    
    return recommendations;
  }
  
  private startBackgroundTasks(): void {
    // Cleanup expired locks
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredLocks();
    }, this.config.cleanupIntervalMs);
    
    // Monitoring and metrics
    this.monitoringInterval = setInterval(() => {
      this.performHealthCheck();
    }, this.config.monitoringIntervalMs);
    
    logger.info('🔄 Resource coordination background tasks started');
  }
  
  private cleanupExpiredLocks(): void {
    let cleanedCount = 0;
    const now = new Date();
    
    for (const [resourceId, state] of this.resources) {
      for (const [lockId, lock] of state.activeLocks) {
        if (lock.expiresAt < now) {
          this.releaseResource(lock);
          cleanedCount++;
          logger.debug(`🧹 Cleaned up expired lock: ${lockId} for resource ${resourceId}`);
        }
      }
    }
    
    if (cleanedCount > 0) {
      logger.info(`🧹 Cleaned up ${cleanedCount} expired resource locks`);
    }
  }
  
  private performHealthCheck(): void {
    const status = this.getCoordinationStatus();
    
    if (status.deadlockRisk === 'high') {
      logger.warn('⚠️ High deadlock risk detected in resource coordination');
      this.emit('high-deadlock-risk', status);
    }
    
    if (status.contentionHotspots.length > 0) {
      logger.debug(`📊 Resource contention hotspots: ${status.contentionHotspots.length}`);
    }
    
    this.emit('health-check', status);
  }
}

// Export singleton instance
export const resourceCoordinator = ResourceCoordinationManager.getInstance();

// Convenience functions
export async function requestResource(request: ResourceAccessRequest): Promise<ResourceLock> {
  return resourceCoordinator.requestResource(request);
}

export async function releaseResource(lock: ResourceLock): Promise<void> {
  return resourceCoordinator.releaseResource(lock);
}

export function getResourceMetrics(resourceId?: string): ResourceUsageMetrics[] {
  return resourceCoordinator.getResourceMetrics(resourceId);
}