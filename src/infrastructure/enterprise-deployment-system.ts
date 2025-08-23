/**
 * Enterprise Deployment and Scaling System
 * Provides enterprise-grade deployment, scaling, and infrastructure management
 */

import { EventEmitter } from 'events';
import { logger } from '../core/logger.js';
import {
  SecurityAuditLogger,
  AuditEventType,
  AuditSeverity,
  AuditOutcome,
} from '../core/security/security-audit-logger.js';
import { PerformanceMonitor } from '../core/performance/performance-monitor.js';
import { AWSProvider } from './cloud-providers/aws-provider.js';
import { AzureProvider } from './cloud-providers/azure-provider.js';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface DeploymentConfig {
  environment: 'development' | 'staging' | 'production';
  cloudProvider?: 'aws' | 'azure' | 'gcp' | 'local';
  awsConfig?: {
    region: string;
    accountId: string;
    vpcId?: string;
    subnetIds?: string[];
  };
  azureConfig?: {
    subscriptionId: string;
    resourceGroupName: string;
    location: string;
  };
  scaling: {
    enabled: boolean;
    minInstances: number;
    maxInstances: number;
    targetCPUUtilization: number;
    targetMemoryUtilization: number;
    scaleUpCooldown: number;
    scaleDownCooldown: number;
  };
  healthCheck: {
    enabled: boolean;
    endpoint: string;
    interval: number;
    timeout: number;
    retries: number;
  };
  loadBalancing: {
    strategy: 'round-robin' | 'least-connections' | 'weighted' | 'ip-hash';
    healthCheckPath: string;
    sessionAffinity: boolean;
  };
  security: {
    enforceHTTPS: boolean;
    corsEnabled: boolean;
    allowedOrigins: string[];
    rateLimiting: {
      enabled: boolean;
      windowMs: number;
      maxRequests: number;
    };
  };
  monitoring: {
    enabled: boolean;
    metricsEndpoint: string;
    alerting: {
      enabled: boolean;
      webhookUrl?: string;
      channels: string[];
    };
  };
  backup: {
    enabled: boolean;
    schedule: string;
    retention: number;
    storage: 'local' | 's3' | 'azure' | 'gcp';
  };
}

export interface DeploymentInstance {
  id: string;
  status: 'starting' | 'running' | 'stopping' | 'stopped' | 'error';
  host: string;
  port: number;
  healthStatus: 'healthy' | 'unhealthy' | 'unknown';
  startTime: number;
  lastHealthCheck?: number;
  metrics: {
    cpuUsage: number;
    memoryUsage: number;
    activeConnections: number;
    requestsPerSecond: number;
  };
  version: string;
  environment: string;
}

export interface ScalingEvent {
  type: 'scale-up' | 'scale-down';
  reason: string;
  timestamp: number;
  triggerMetric: string;
  triggerValue: number;
  targetInstances: number;
  currentInstances: number;
}

export interface DeploymentPlan {
  version: string;
  environment: string;
  strategy: 'blue-green' | 'rolling' | 'canary' | 'recreate';
  steps: DeploymentStep[];
  rollbackPlan: DeploymentStep[];
  estimatedDuration: number;
  prerequisites: string[];
  postDeploymentTasks: string[];
}

export interface DeploymentStep {
  id: string;
  name: string;
  type: 'provision' | 'configure' | 'deploy' | 'test' | 'verify' | 'cleanup';
  command: string;
  timeout: number;
  retries: number;
  rollbackCommand?: string;
  dependencies: string[];
}

export interface LoadBalancerConfig {
  instances: DeploymentInstance[];
  strategy: DeploymentConfig['loadBalancing']['strategy'];
  healthCheckPath: string;
  sessionAffinity: boolean;
}

export class EnterpriseDeploymentSystem extends EventEmitter {
  private config: DeploymentConfig;
  private auditLogger?: SecurityAuditLogger;
  private performanceMonitor?: PerformanceMonitor;
  private awsProvider?: AWSProvider;
  private azureProvider?: AzureProvider;

  private instances = new Map<string, DeploymentInstance>();
  private scalingEvents: ScalingEvent[] = [];
  private deploymentHistory: Array<{
    version: string;
    environment: string;
    timestamp: number;
    success: boolean;
    duration: number;
  }> = [];

  private healthCheckInterval?: NodeJS.Timeout;
  private scalingMonitorInterval?: NodeJS.Timeout;
  private loadBalancer?: LoadBalancer;

  constructor(
    config: Partial<DeploymentConfig> = {},
    auditLogger?: SecurityAuditLogger,
    performanceMonitor?: PerformanceMonitor
  ) {
    super();

    this.auditLogger = auditLogger;
    this.performanceMonitor = performanceMonitor;

    this.config = {
      environment: 'development',
      cloudProvider: 'local',
      scaling: {
        enabled: true,
        minInstances: 1,
        maxInstances: 10,
        targetCPUUtilization: 70,
        targetMemoryUtilization: 80,
        scaleUpCooldown: 300000, // 5 minutes
        scaleDownCooldown: 600000, // 10 minutes
      },
      healthCheck: {
        enabled: true,
        endpoint: '/health',
        interval: 30000, // 30 seconds
        timeout: 5000,
        retries: 3,
      },
      loadBalancing: {
        strategy: 'round-robin',
        healthCheckPath: '/health',
        sessionAffinity: false,
      },
      security: {
        enforceHTTPS: true,
        corsEnabled: true,
        allowedOrigins: ['https://localhost:3000'],
        rateLimiting: {
          enabled: true,
          windowMs: 900000, // 15 minutes
          maxRequests: 100,
        },
      },
      monitoring: {
        enabled: true,
        metricsEndpoint: '/metrics',
        alerting: {
          enabled: true,
          channels: ['log', 'console'],
        },
      },
      backup: {
        enabled: true,
        schedule: '0 2 * * *', // Daily at 2 AM
        retention: 30, // 30 days
        storage: 'local',
      },
      ...config,
    };

    this.initialize();
  }

  /**
   * Initialize deployment system
   */
  private initialize(): void {
    // Initialize cloud providers if configured
    if (this.config.cloudProvider === 'aws' && this.config.awsConfig) {
      this.awsProvider = new AWSProvider({
        region: this.config.awsConfig.region,
        accountId: this.config.awsConfig.accountId,
        vpcId: this.config.awsConfig.vpcId,
        subnetIds: this.config.awsConfig.subnetIds,
      });
    }
    
    if (this.config.cloudProvider === 'azure' && this.config.azureConfig) {
      this.azureProvider = new AzureProvider({
        subscriptionId: this.config.azureConfig.subscriptionId,
        resourceGroupName: this.config.azureConfig.resourceGroupName,
        location: this.config.azureConfig.location,
      });
    }
    
    // Initialize load balancer
    this.loadBalancer = new LoadBalancer({
      instances: Array.from(this.instances.values()),
      strategy: this.config.loadBalancing.strategy,
      healthCheckPath: this.config.loadBalancing.healthCheckPath,
      sessionAffinity: this.config.loadBalancing.sessionAffinity,
    });

    // Start health checks
    if (this.config.healthCheck.enabled) {
      this.startHealthChecks();
    }

    // Start scaling monitor
    if (this.config.scaling.enabled) {
      this.startScalingMonitor();
    }

    // Listen to performance monitor events for scaling decisions
    if (this.performanceMonitor) {
      this.performanceMonitor.on('threshold-critical', event => {
        this.handlePerformanceThreshold(event);
      });
    }

    logger.info('Enterprise Deployment System initialized', {
      environment: this.config.environment,
      scaling: this.config.scaling.enabled,
      healthCheck: this.config.healthCheck.enabled,
      loadBalancing: this.config.loadBalancing.strategy,
    });
  }

  /**
   * Deploy application version
   */
  async deploy(
    plan: DeploymentPlan
  ): Promise<{ success: boolean; duration: number; error?: string }> {
    const startTime = Date.now();

    logger.info('Starting deployment', {
      version: plan.version,
      environment: plan.environment,
      strategy: plan.strategy,
    });

    // Audit log
    if (this.auditLogger) {
      this.auditLogger.logEvent(
        AuditEventType.SYSTEM_EVENT,
        AuditSeverity.MEDIUM,
        AuditOutcome.SUCCESS,
        'enterprise-deployment-system',
        'deployment_start',
        plan.version,
        `Starting deployment of version ${plan.version} to ${plan.environment}`,
        {},
        { plan }
      );
    }

    try {
      // Execute deployment steps
      for (const step of plan.steps) {
        await this.executeDeploymentStep(step, plan);
      }

      // Execute post-deployment tasks
      for (const task of plan.postDeploymentTasks) {
        await this.executePostDeploymentTask(task, plan);
      }

      const duration = Date.now() - startTime;

      // Record successful deployment
      this.deploymentHistory.push({
        version: plan.version,
        environment: plan.environment,
        timestamp: startTime,
        success: true,
        duration,
      });

      logger.info('Deployment completed successfully', {
        version: plan.version,
        duration,
      });

      this.emit('deployment-success', { plan, duration });

      return { success: true, duration };
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      logger.error('Deployment failed', {
        version: plan.version,
        error: errorMessage,
        duration,
      });

      // Record failed deployment
      this.deploymentHistory.push({
        version: plan.version,
        environment: plan.environment,
        timestamp: startTime,
        success: false,
        duration,
      });

      // Execute rollback if needed
      await this.executeRollback(plan);

      this.emit('deployment-failure', { plan, error, duration });

      return { success: false, duration, error: errorMessage };
    }
  }

  /**
   * Execute deployment step
   */
  private async executeDeploymentStep(step: DeploymentStep, plan: DeploymentPlan): Promise<void> {
    logger.info(`Executing deployment step: ${step.name}`, { step: step.id });

    const startTime = Date.now();
    let attempt = 0;

    while (attempt <= step.retries) {
      try {
        // Execute real command based on cloud provider
        await this.executeRealCommand(step, plan);

        logger.info(`Deployment step completed: ${step.name}`, {
          step: step.id,
          duration: Date.now() - startTime,
        });

        return;
      } catch (error) {
        attempt++;

        if (attempt > step.retries) {
          throw new Error(`Deployment step failed after ${step.retries} retries: ${step.name}`);
        }

        logger.warn(`Deployment step failed, retrying (${attempt}/${step.retries})`, {
          step: step.id,
          error: error instanceof Error ? error.message : 'Unknown error',
        });

        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, 2000 * attempt));
      }
    }
  }

  /**
   * Execute post-deployment task
   */
  private async executePostDeploymentTask(task: string, plan: DeploymentPlan): Promise<void> {
    logger.info(`Executing post-deployment task: ${task}`);

    try {
      // Execute real post-deployment task
      await this.executeLocalCommand(task, 30000);

      logger.info(`Post-deployment task completed: ${task}`);
    } catch (error) {
      logger.warn(`Post-deployment task failed: ${task}`, {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      // Continue with other tasks even if one fails
    }
  }

  /**
   * Execute rollback plan
   */
  private async executeRollback(plan: DeploymentPlan): Promise<void> {
    logger.info('Executing rollback plan', { version: plan.version });

    try {
      for (const step of plan.rollbackPlan) {
        await this.executeDeploymentStep(step, plan);
      }

      logger.info('Rollback completed successfully');
      this.emit('rollback-success', { plan });
    } catch (error) {
      logger.error('Rollback failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      this.emit('rollback-failure', { plan, error });
    }
  }

  /**
   * Execute real deployment command
   */
  private async executeRealCommand(step: DeploymentStep, plan: DeploymentPlan): Promise<void> {
    const { cloudProvider } = this.config;
    
    if (cloudProvider === 'aws' && this.awsProvider) {
      return this.executeAWSCommand(step, plan);
    } else if (cloudProvider === 'azure' && this.azureProvider) {
      return this.executeAzureCommand(step, plan);
    } else {
      // Execute local command for development/testing
      return this.executeLocalCommand(step.command, step.timeout);
    }
  }

  /**
   * Execute AWS-specific deployment command
   */
  private async executeAWSCommand(step: DeploymentStep, plan: DeploymentPlan): Promise<void> {
    if (!this.awsProvider) throw new Error('AWS provider not initialized');
    
    switch (step.type) {
      case 'provision':
        await this.awsProvider.launchInstances('t3.medium', 2);
        break;
      case 'deploy':
        await this.awsProvider.deployToECS(
          `codecrucible-${plan.environment}`,
          'codecrucible-task',
          3
        );
        break;
      case 'configure':
        await this.awsProvider.createAutoScalingGroup(
          `codecrucible-asg-${plan.environment}`,
          1, 10, 2
        );
        break;
      default:
        await this.executeLocalCommand(step.command, step.timeout);
    }
  }

  /**
   * Execute Azure-specific deployment command  
   */
  private async executeAzureCommand(step: DeploymentStep, plan: DeploymentPlan): Promise<void> {
    if (!this.azureProvider) throw new Error('Azure provider not initialized');
    
    switch (step.type) {
      case 'provision':
        await this.azureProvider.createVirtualMachine(
          `codecrucible-vm-${plan.environment}`
        );
        break;
      case 'deploy':
        await this.azureProvider.deployContainerInstance(
          `codecrucible-${plan.environment}`,
          'codecrucible/synth:latest'
        );
        break;
      case 'configure':
        await this.azureProvider.createVMScaleSet(
          `codecrucible-vmss-${plan.environment}`,
          3
        );
        break;
      default:
        await this.executeLocalCommand(step.command, step.timeout);
    }
  }

  /**
   * Execute local command using shell
   */
  private async executeLocalCommand(command: string, timeout: number): Promise<void> {
    try {
      const { stdout, stderr } = await execAsync(command, {
        timeout: timeout,
        env: { ...process.env, NODE_ENV: this.config.environment },
      });
      
      if (stdout) logger.debug(`Command output: ${stdout}`);
      if (stderr) logger.warn(`Command stderr: ${stderr}`);
    } catch (error: any) {
      if (error.killed && error.signal === 'SIGTERM') {
        throw new Error(`Command timed out after ${timeout}ms: ${command}`);
      }
      throw new Error(`Command failed: ${error.message}`);
    }
  }

  /**
   * Register deployment instance
   */
  registerInstance(instance: Omit<DeploymentInstance, 'id' | 'startTime'>): string {
    const id = this.generateInstanceId();

    const fullInstance: DeploymentInstance = {
      id,
      startTime: Date.now(),
      ...instance,
    };

    this.instances.set(id, fullInstance);
    this.loadBalancer?.addInstance(fullInstance);

    logger.info('Instance registered', {
      instanceId: id,
      host: instance.host,
      port: instance.port,
    });
    this.emit('instance-registered', fullInstance);

    return id;
  }

  /**
   * Unregister deployment instance
   */
  unregisterInstance(instanceId: string): boolean {
    const instance = this.instances.get(instanceId);
    if (!instance) return false;

    this.instances.delete(instanceId);
    this.loadBalancer?.removeInstance(instance);

    logger.info('Instance unregistered', { instanceId });
    this.emit('instance-unregistered', instance);

    return true;
  }

  /**
   * Start health checks
   */
  private startHealthChecks(): void {
    this.healthCheckInterval = setInterval(() => {
      this.performHealthChecks();
    }, this.config.healthCheck.interval);
  }

  /**
   * Perform health checks on all instances
   */
  private async performHealthChecks(): Promise<void> {
    const promises = Array.from(this.instances.values()).map(instance =>
      this.checkInstanceHealth(instance)
    );

    await Promise.allSettled(promises);
  }

  /**
   * Check health of a specific instance
   */
  private async checkInstanceHealth(instance: DeploymentInstance): Promise<void> {
    try {
      // Simulate health check (in real implementation, this would make HTTP request)
      const isHealthy = await this.simulateHealthCheck(instance);

      const previousStatus = instance.healthStatus;
      instance.healthStatus = isHealthy ? 'healthy' : 'unhealthy';
      instance.lastHealthCheck = Date.now();

      if (previousStatus !== instance.healthStatus) {
        logger.info('Instance health status changed', {
          instanceId: instance.id,
          status: instance.healthStatus,
        });

        this.emit('instance-health-changed', instance);

        // Update load balancer
        if (instance.healthStatus === 'healthy') {
          this.loadBalancer?.enableInstance(instance);
        } else {
          this.loadBalancer?.disableInstance(instance);
        }
      }
    } catch (error) {
      instance.healthStatus = 'unhealthy';
      instance.lastHealthCheck = Date.now();

      logger.warn('Health check failed for instance', {
        instanceId: instance.id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Simulate health check
   */
  private async simulateHealthCheck(instance: DeploymentInstance): Promise<boolean> {
    // Simulate network request with 95% success rate
    return new Promise(resolve => {
      setTimeout(() => {
        resolve(Math.random() > 0.05);
      }, 100);
    });
  }

  /**
   * Start scaling monitor
   */
  private startScalingMonitor(): void {
    this.scalingMonitorInterval = setInterval(() => {
      this.evaluateScaling();
    }, 30000); // Check every 30 seconds
  }

  /**
   * Evaluate scaling decisions
   */
  private evaluateScaling(): void {
    const instances = Array.from(this.instances.values());
    const healthyInstances = instances.filter(i => i.healthStatus === 'healthy');

    if (healthyInstances.length === 0) return;

    // Calculate average metrics
    const avgCPU =
      healthyInstances.reduce((sum, i) => sum + i.metrics.cpuUsage, 0) / healthyInstances.length;
    const avgMemory =
      healthyInstances.reduce((sum, i) => sum + i.metrics.memoryUsage, 0) / healthyInstances.length;

    // Check if scaling is needed
    const shouldScaleUp =
      (avgCPU > this.config.scaling.targetCPUUtilization ||
        avgMemory > this.config.scaling.targetMemoryUtilization) &&
      healthyInstances.length < this.config.scaling.maxInstances;

    const shouldScaleDown =
      avgCPU < this.config.scaling.targetCPUUtilization * 0.5 &&
      avgMemory < this.config.scaling.targetMemoryUtilization * 0.5 &&
      healthyInstances.length > this.config.scaling.minInstances;

    if (shouldScaleUp) {
      this.scaleUp(
        avgCPU > this.config.scaling.targetCPUUtilization ? 'cpu' : 'memory',
        avgCPU,
        avgMemory
      );
    } else if (shouldScaleDown) {
      this.scaleDown('low-utilization', avgCPU, avgMemory);
    }
  }

  /**
   * Scale up instances
   */
  private scaleUp(reason: string, cpuUsage: number, memoryUsage: number): void {
    const currentInstances = Array.from(this.instances.values()).filter(
      i => i.healthStatus === 'healthy'
    ).length;
    const targetInstances = Math.min(currentInstances + 1, this.config.scaling.maxInstances);

    if (targetInstances === currentInstances) return;

    const scalingEvent: ScalingEvent = {
      type: 'scale-up',
      reason: `High ${reason} utilization`,
      timestamp: Date.now(),
      triggerMetric: reason,
      triggerValue: reason === 'cpu' ? cpuUsage : memoryUsage,
      targetInstances,
      currentInstances,
    };

    this.scalingEvents.push(scalingEvent);

    logger.info('Scaling up', scalingEvent);
    this.emit('scaling-event', scalingEvent);

    // In real implementation, this would provision new instances
    this.simulateInstanceProvisioning('scale-up');
  }

  /**
   * Scale down instances
   */
  private scaleDown(reason: string, cpuUsage: number, memoryUsage: number): void {
    const currentInstances = Array.from(this.instances.values()).filter(
      i => i.healthStatus === 'healthy'
    ).length;
    const targetInstances = Math.max(currentInstances - 1, this.config.scaling.minInstances);

    if (targetInstances === currentInstances) return;

    const scalingEvent: ScalingEvent = {
      type: 'scale-down',
      reason,
      timestamp: Date.now(),
      triggerMetric: 'utilization',
      triggerValue: Math.max(cpuUsage, memoryUsage),
      targetInstances,
      currentInstances,
    };

    this.scalingEvents.push(scalingEvent);

    logger.info('Scaling down', scalingEvent);
    this.emit('scaling-event', scalingEvent);

    // In real implementation, this would terminate instances
    this.simulateInstanceTermination('scale-down');
  }

  /**
   * Simulate instance provisioning
   */
  private simulateInstanceProvisioning(reason: string): void {
    // Simulate provisioning delay
    setTimeout(() => {
      const instanceId = this.registerInstance({
        status: 'running',
        host: `app-${Math.random().toString(36).substring(7)}`,
        port: 3000 + Math.floor(Math.random() * 1000),
        healthStatus: 'healthy',
        metrics: {
          cpuUsage: 30 + Math.random() * 40,
          memoryUsage: 40 + Math.random() * 30,
          activeConnections: Math.floor(Math.random() * 100),
          requestsPerSecond: Math.floor(Math.random() * 50),
        },
        version: '1.0.0',
        environment: this.config.environment,
      });

      logger.info('New instance provisioned', { instanceId, reason });
    }, 30000); // 30 seconds provisioning delay
  }

  /**
   * Simulate instance termination
   */
  private simulateInstanceTermination(reason: string): void {
    const instances = Array.from(this.instances.values()).filter(i => i.healthStatus === 'healthy');

    if (instances.length <= this.config.scaling.minInstances) return;

    // Terminate the instance with lowest utilization
    const instanceToTerminate = instances.reduce((lowest, current) =>
      current.metrics.cpuUsage + current.metrics.memoryUsage <
      lowest.metrics.cpuUsage + lowest.metrics.memoryUsage
        ? current
        : lowest
    );

    // Simulate graceful shutdown delay
    setTimeout(() => {
      this.unregisterInstance(instanceToTerminate.id);
      logger.info('Instance terminated', { instanceId: instanceToTerminate.id, reason });
    }, 10000); // 10 seconds shutdown delay
  }

  /**
   * Handle performance threshold events
   */
  private handlePerformanceThreshold(event: any): void {
    if (event.metric === 'cpu_usage' || event.metric === 'memory_usage') {
      logger.info('Performance threshold triggered scaling evaluation', event);
      this.evaluateScaling();
    }
  }

  /**
   * Generate unique instance ID
   */
  private generateInstanceId(): string {
    return `inst-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
  }

  /**
   * Get deployment status
   */
  getDeploymentStatus(): {
    instances: DeploymentInstance[];
    scaling: {
      enabled: boolean;
      currentInstances: number;
      targetRange: { min: number; max: number };
      recentEvents: ScalingEvent[];
    };
    health: {
      healthy: number;
      unhealthy: number;
      unknown: number;
    };
    loadBalancer: {
      strategy: string;
      activeInstances: number;
    };
    deploymentHistory: Array<{
      version: string;
      environment: string;
      timestamp: number;
      success: boolean;
      duration: number;
    }>;
  } {
    const instances = Array.from(this.instances.values());
    const health = instances.reduce(
      (acc, instance) => {
        acc[instance.healthStatus]++;
        return acc;
      },
      { healthy: 0, unhealthy: 0, unknown: 0 }
    );

    return {
      instances,
      scaling: {
        enabled: this.config.scaling.enabled,
        currentInstances: instances.length,
        targetRange: {
          min: this.config.scaling.minInstances,
          max: this.config.scaling.maxInstances,
        },
        recentEvents: this.scalingEvents.slice(-10),
      },
      health,
      loadBalancer: {
        strategy: this.config.loadBalancing.strategy,
        activeInstances: instances.filter(i => i.healthStatus === 'healthy').length,
      },
      deploymentHistory: this.deploymentHistory.slice(-20), // Last 20 deployments
    };
  }

  /**
   * Stop deployment system
   */
  stop(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    if (this.scalingMonitorInterval) {
      clearInterval(this.scalingMonitorInterval);
    }

    logger.info('Enterprise Deployment System stopped');
    this.emit('deployment-system-stop');
  }
}

/**
 * Load Balancer implementation
 */
class LoadBalancer {
  private config: LoadBalancerConfig;
  private enabledInstances: DeploymentInstance[] = [];
  private currentIndex = 0;
  private connectionCounts = new Map<string, number>();

  constructor(config: LoadBalancerConfig) {
    this.config = config;
    this.enabledInstances = config.instances.filter(i => i.healthStatus === 'healthy');
  }

  /**
   * Get next instance based on load balancing strategy
   */
  getNextInstance(): DeploymentInstance | null {
    if (this.enabledInstances.length === 0) return null;

    switch (this.config.strategy) {
      case 'round-robin':
        return this.getRoundRobinInstance();
      case 'least-connections':
        return this.getLeastConnectionsInstance();
      case 'weighted':
        return this.getWeightedInstance();
      case 'ip-hash':
        return this.getIPHashInstance();
      default:
        return this.getRoundRobinInstance();
    }
  }

  private getRoundRobinInstance(): DeploymentInstance {
    const instance = this.enabledInstances[this.currentIndex];
    this.currentIndex = (this.currentIndex + 1) % this.enabledInstances.length;
    return instance;
  }

  private getLeastConnectionsInstance(): DeploymentInstance {
    return this.enabledInstances.reduce((least, current) => {
      const leastConnections = this.connectionCounts.get(least.id) || 0;
      const currentConnections = this.connectionCounts.get(current.id) || 0;
      return currentConnections < leastConnections ? current : least;
    });
  }

  private getWeightedInstance(): DeploymentInstance {
    // Simple weighted implementation based on CPU usage (lower = higher weight)
    const weights = this.enabledInstances.map(i => 100 - i.metrics.cpuUsage);
    const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
    const random = Math.random() * totalWeight;

    let currentWeight = 0;
    for (let i = 0; i < this.enabledInstances.length; i++) {
      currentWeight += weights[i];
      if (random <= currentWeight) {
        return this.enabledInstances[i];
      }
    }

    return this.enabledInstances[0];
  }

  private getIPHashInstance(): DeploymentInstance {
    // Simplified IP hash implementation
    const hash = Math.floor(Math.random() * this.enabledInstances.length);
    return this.enabledInstances[hash];
  }

  addInstance(instance: DeploymentInstance): void {
    if (instance.healthStatus === 'healthy') {
      this.enabledInstances.push(instance);
    }
  }

  removeInstance(instance: DeploymentInstance): void {
    this.enabledInstances = this.enabledInstances.filter(i => i.id !== instance.id);
    this.connectionCounts.delete(instance.id);
  }

  enableInstance(instance: DeploymentInstance): void {
    if (!this.enabledInstances.find(i => i.id === instance.id)) {
      this.enabledInstances.push(instance);
    }
  }

  disableInstance(instance: DeploymentInstance): void {
    this.enabledInstances = this.enabledInstances.filter(i => i.id !== instance.id);
  }

  incrementConnections(instanceId: string): void {
    const current = this.connectionCounts.get(instanceId) || 0;
    this.connectionCounts.set(instanceId, current + 1);
  }

  decrementConnections(instanceId: string): void {
    const current = this.connectionCounts.get(instanceId) || 0;
    this.connectionCounts.set(instanceId, Math.max(0, current - 1));
  }
}

export default EnterpriseDeploymentSystem;
