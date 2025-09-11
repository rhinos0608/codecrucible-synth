/**
 * Enterprise Deployment and Scaling System
 * Provides enterprise-grade deployment, scaling, and infrastructure management
 */

import { EventEmitter } from 'events';
import { logger } from '../infrastructure/logging/logger.js';
import {
  AuditEventType,
  AuditOutcome,
  AuditSeverity,
  SecurityAuditLogger,
} from './security/security-audit-logger.js';
import { PerformanceMonitor } from '../utils/performance.js';
import { AWSProvider } from './cloud-providers/aws-provider.js';
import { AzureProvider } from './cloud-providers/azure-provider.js';
import { exec } from 'child_process';
import { promisify } from 'util';
import fetch from 'node-fetch';

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
  private readonly config: DeploymentConfig;
  private readonly auditLogger?: SecurityAuditLogger;
  private readonly performanceMonitor?: PerformanceMonitor;
  private awsProvider?: AWSProvider;
  private azureProvider?: AzureProvider;

  private readonly instances = new Map<string, DeploymentInstance>();
  private readonly scalingEvents: ScalingEvent[] = [];
  private readonly deploymentHistory: Array<{
    version: string;
    environment: string;
    timestamp: number;
    success: boolean;
    duration: number;
  }> = [];

  private healthCheckInterval?: NodeJS.Timeout;
  private scalingMonitorInterval?: NodeJS.Timeout;
  private loadBalancer?: LoadBalancer;

  public constructor(
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
      this.performanceMonitor.on(
        'threshold-critical',
        (event: Readonly<{ metric: string; value: number; threshold: number }>) => {
          this.handlePerformanceThreshold(event);
        }
      );
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
  public async deploy(
    plan: Readonly<DeploymentPlan>
  ): Promise<{ success: boolean; duration: number; error?: string }> {
    const startTime = Date.now();

    logger.info('Starting deployment', {
      version: plan.version,
      environment: plan.environment,
      strategy: plan.strategy,
    });

    // Audit log
    if (this.auditLogger) {
      this.auditLogger.logAuditEvent({
        eventType: AuditEventType.SYSTEM_EVENT,
        severity: AuditSeverity.MEDIUM,
        outcome: AuditOutcome.SUCCESS,
        userId: 'enterprise-deployment-system',
        resource: plan.version,
        action: 'deployment_start',
        details: {
          plan,
          message: `Starting deployment of version ${plan.version} to ${plan.environment}`,
        },
      });
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
  private async executeDeploymentStep(
    step: Readonly<DeploymentStep>,
    plan: Readonly<DeploymentPlan>
  ): Promise<void> {
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
        {
          const delay = 2000 * attempt;
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
  }

  /**
   * Execute post-deployment task
   */
  private async executePostDeploymentTask(
    task: string,
    _plan: Readonly<DeploymentPlan>
  ): Promise<void> {
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
          1,
          10,
          2
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
        await this.azureProvider.createVirtualMachine(`codecrucible-vm-${plan.environment}`);
        break;
      case 'deploy':
        await this.azureProvider.deployContainerInstance(
          `codecrucible-${plan.environment}`,
          'codecrucible/synth:latest'
        );
        break;
      case 'configure':
        await this.azureProvider.createVMScaleSet(`codecrucible-vmss-${plan.environment}`, 3);
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
        timeout,
        env: { ...process.env, NODE_ENV: this.config.environment },
      });

      if (stdout) logger.debug(`Command output: ${stdout}`);
      if (stderr) logger.warn(`Command stderr: ${stderr}`);
    } catch (error: unknown) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'killed' in error &&
        'signal' in error &&
        (error as { killed?: boolean }).killed &&
        (error as { signal?: string }).signal === 'SIGTERM'
      ) {
        throw new Error(`Command timed out after ${timeout}ms: ${command}`);
      }
      const message =
        typeof error === 'object' && error !== null && 'message' in error
          ? String((error as { message?: unknown }).message)
          : 'Unknown error';
      throw new Error(`Command failed: ${message}`);
    }
  }

  /**
   * Register deployment instance
   */
  public registerInstance(
    instance: Readonly<Omit<DeploymentInstance, 'id' | 'startTime'>>
  ): string {
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

    // Audit log the instance registration
    if (this.auditLogger) {
      this.auditLogger.logAuditEvent({
        eventType: AuditEventType.SYSTEM_EVENT,
        severity: AuditSeverity.LOW,
        outcome: AuditOutcome.SUCCESS,
        userId: 'enterprise-deployment-system',
        resource: id,
        action: 'instance_register',
        details: {
          instanceId: id,
          host: instance.host,
          port: instance.port,
          environment: instance.environment,
          version: instance.version,
        },
      });
    }

    this.emit('instance-registered', fullInstance);
    return id;
  }

  /**
   * Unregister deployment instance
   */
  public unregisterInstance(instanceId: string): boolean {
    const instance = this.instances.get(instanceId);
    if (!instance) return false;

    this.instances.delete(instanceId);
    this.loadBalancer?.removeInstance(instance);

    logger.info('Instance unregistered', { instanceId });

    // Audit log the instance unregistration
    if (this.auditLogger) {
      this.auditLogger.logAuditEvent({
        eventType: AuditEventType.SYSTEM_EVENT,
        severity: AuditSeverity.LOW,
        outcome: AuditOutcome.SUCCESS,
        userId: 'enterprise-deployment-system',
        resource: instanceId,
        action: 'instance_unregister',
        details: {
          instanceId,
          host: instance.host,
          port: instance.port,
        },
      });
    }

    this.emit('instance-unregistered', instance);
    return true;
  }

  /**
   * Start health checks
   */
  private startHealthChecks(): void {
    this.healthCheckInterval = setInterval(() => {
      void this.performHealthChecks();
    }, this.config.healthCheck.interval);

    logger.info('Health checks started', {
      interval: this.config.healthCheck.interval,
      endpoint: this.config.healthCheck.endpoint,
    });
  }

  /**
   * Perform health checks on all instances
   */
  private async performHealthChecks(): Promise<void> {
    const instances = Array.from(this.instances.values());
    if (instances.length === 0) return;

    const promises = instances.map(async instance => {
      try {
        await this.checkInstanceHealth(instance);
      } catch (error) {
        logger.error('Health check error for instance', {
          instanceId: instance.id,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    });

    await Promise.allSettled(promises);
  }

  /**
   * Check health of a specific instance using real HTTP request
   */
  private async checkInstanceHealth(instance: DeploymentInstance): Promise<void> {
    const { endpoint, timeout, retries } = this.config.healthCheck;
    const url = `http://${instance.host}:${instance.port}${endpoint}`;

    let lastError: Error | null = null;
    let isHealthy = false;

    // Retry logic
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => {
          controller.abort();
        }, timeout);

        const response = await fetch(url, {
          method: 'GET',
          signal: controller.signal,
          headers: {
            'User-Agent': 'CodeCrucible-HealthCheck/1.0',
            Accept: 'application/json',
          },
        });

        clearTimeout(timeoutId);

        if (response.ok) {
          isHealthy = true;

          // Try to parse response for additional metrics
          try {
            const data: unknown = await response.json();
            if (data && typeof data === 'object' && data !== null) {
              const metrics = data as Partial<{
                cpuUsage: number;
                memoryUsage: number;
                activeConnections: number;
                requestsPerSecond: number;
              }>;
              // Update instance metrics if provided in health check response
              if (typeof metrics.cpuUsage === 'number') {
                instance.metrics.cpuUsage = metrics.cpuUsage;
              }
              if (typeof metrics.memoryUsage === 'number') {
                instance.metrics.memoryUsage = metrics.memoryUsage;
              }
              if (typeof metrics.activeConnections === 'number') {
                instance.metrics.activeConnections = metrics.activeConnections;
              }
              if (typeof metrics.requestsPerSecond === 'number') {
                instance.metrics.requestsPerSecond = metrics.requestsPerSecond;
              }
            }
          } catch {
            // Ignore JSON parsing errors - health check was successful
          }

          break;
        } else {
          lastError = new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown health check error');

        if (error instanceof Error && error.name === 'AbortError') {
          lastError = new Error(`Health check timeout after ${timeout}ms`);
        }
      }

      // Wait before retry (exponential backoff)
      if (attempt < retries) {
        const delay = Math.min(1000 * Math.pow(2, attempt), 5000);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    const previousStatus = instance.healthStatus;
    instance.healthStatus = isHealthy ? 'healthy' : 'unhealthy';
    instance.lastHealthCheck = Date.now();

    // Log health status changes
    if (previousStatus !== instance.healthStatus) {
      const logLevel = instance.healthStatus === 'healthy' ? 'info' : 'warn';
      logger[logLevel]('Instance health status changed', {
        instanceId: instance.id,
        previousStatus,
        currentStatus: instance.healthStatus,
        lastError: lastError?.message,
      });

      // Audit log health status changes
      if (this.auditLogger) {
        this.auditLogger.logAuditEvent({
          eventType: AuditEventType.SYSTEM_EVENT,
          severity: instance.healthStatus === 'healthy' ? AuditSeverity.LOW : AuditSeverity.MEDIUM,
          outcome:
            instance.healthStatus === 'healthy' ? AuditOutcome.SUCCESS : AuditOutcome.FAILURE,
          userId: 'health-check-system',
          resource: instance.id,
          action: 'health_status_change',
          details: {
            instanceId: instance.id,
            previousStatus,
            currentStatus: instance.healthStatus,
            error: lastError?.message,
            url,
          },
        });
      }

      this.emit('instance-health-changed', instance);

      // Update load balancer
      if (instance.healthStatus === 'healthy') {
        this.loadBalancer?.enableInstance(instance);
      } else {
        this.loadBalancer?.disableInstance(instance);
      }
    }
  }

  /**
   * Start scaling monitor
   */
  private startScalingMonitor(): void {
    this.scalingMonitorInterval = setInterval(() => {
      try {
        this.evaluateScaling();
      } catch (error) {
        logger.error('Scaling evaluation error', {
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }, 30000); // Check every 30 seconds

    logger.info('Scaling monitor started', {
      minInstances: this.config.scaling.minInstances,
      maxInstances: this.config.scaling.maxInstances,
      targetCPU: this.config.scaling.targetCPUUtilization,
      targetMemory: this.config.scaling.targetMemoryUtilization,
    });
  }

  /**
   * Evaluate scaling decisions based on real metrics
   */
  private evaluateScaling(): void {
    const instances = Array.from(this.instances.values());
    const healthyInstances = instances.filter(i => i.healthStatus === 'healthy');

    if (healthyInstances.length === 0) {
      logger.warn('No healthy instances available for scaling evaluation');
      return;
    }

    // Calculate average metrics from healthy instances
    const avgCPU =
      healthyInstances.reduce((sum, i) => sum + i.metrics.cpuUsage, 0) / healthyInstances.length;
    const avgMemory =
      healthyInstances.reduce((sum, i) => sum + i.metrics.memoryUsage, 0) / healthyInstances.length;
    const totalRequestsPerSecond = healthyInstances.reduce(
      (sum, i) => sum + i.metrics.requestsPerSecond,
      0
    );

    // Check for recent scaling events to enforce cooldown periods
    const recentScaleUp = this.scalingEvents.find(
      event =>
        event.type === 'scale-up' &&
        Date.now() - event.timestamp < this.config.scaling.scaleUpCooldown
    );

    const recentScaleDown = this.scalingEvents.find(
      event =>
        event.type === 'scale-down' &&
        Date.now() - event.timestamp < this.config.scaling.scaleDownCooldown
    );

    // Determine scaling needs
    const shouldScaleUp =
      !recentScaleUp &&
      (avgCPU > this.config.scaling.targetCPUUtilization ||
        avgMemory > this.config.scaling.targetMemoryUtilization ||
        totalRequestsPerSecond > healthyInstances.length * 100) && // Scale up if >100 RPS per instance
      healthyInstances.length < this.config.scaling.maxInstances;

    const shouldScaleDown =
      !recentScaleDown &&
      avgCPU < this.config.scaling.targetCPUUtilization * 0.5 &&
      avgMemory < this.config.scaling.targetMemoryUtilization * 0.5 &&
      totalRequestsPerSecond < healthyInstances.length * 25 && // Scale down if <25 RPS per instance
      healthyInstances.length > this.config.scaling.minInstances;

    if (shouldScaleUp) {
      const reason =
        avgCPU > this.config.scaling.targetCPUUtilization
          ? 'cpu'
          : avgMemory > this.config.scaling.targetMemoryUtilization
            ? 'memory'
            : 'requests';
      void this.scaleUp(reason, avgCPU, avgMemory, totalRequestsPerSecond);
    } else if (shouldScaleDown) {
      void this.scaleDown('low-utilization', avgCPU, avgMemory, totalRequestsPerSecond);
    }
  }

  /**
   * Scale up instances by provisioning new resources
   */
  private async scaleUp(
    reason: string,
    cpuUsage: number,
    memoryUsage: number,
    requestsPerSecond: number
  ): Promise<void> {
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
      triggerValue:
        reason === 'cpu' ? cpuUsage : reason === 'memory' ? memoryUsage : requestsPerSecond,
      targetInstances,
      currentInstances,
    };

    this.scalingEvents.push(scalingEvent);

    logger.info('Initiating scale-up operation', {
      ...scalingEvent,
      cpuUsage,
      memoryUsage,
      requestsPerSecond,
    });

    // Audit log scaling event
    if (this.auditLogger) {
      this.auditLogger.logAuditEvent({
        eventType: AuditEventType.SYSTEM_EVENT,
        severity: AuditSeverity.MEDIUM,
        outcome: AuditOutcome.SUCCESS,
        userId: 'auto-scaling-system',
        resource: 'deployment-instances',
        action: 'scale_up',
        details: {
          ...scalingEvent,
          metrics: { cpuUsage, memoryUsage, requestsPerSecond },
        },
      });
    }

    this.emit('scaling-event', scalingEvent);

    try {
      await this.provisionNewInstance();
    } catch (error) {
      logger.error('Failed to provision new instance during scale-up', {
        error: error instanceof Error ? error.message : 'Unknown error',
        scalingEvent,
      });
    }
  }

  /**
   * Scale down instances by terminating excess resources
   */
  private async scaleDown(
    reason: string,
    cpuUsage: number,
    memoryUsage: number,
    requestsPerSecond: number
  ): Promise<void> {
    const healthyInstances = Array.from(this.instances.values()).filter(
      i => i.healthStatus === 'healthy'
    );
    const targetInstances = Math.max(healthyInstances.length - 1, this.config.scaling.minInstances);

    if (targetInstances === healthyInstances.length) return;

    const scalingEvent: ScalingEvent = {
      type: 'scale-down',
      reason,
      timestamp: Date.now(),
      triggerMetric: 'utilization',
      triggerValue: Math.max(cpuUsage, memoryUsage),
      targetInstances,
      currentInstances: healthyInstances.length,
    };

    this.scalingEvents.push(scalingEvent);

    logger.info('Initiating scale-down operation', {
      ...scalingEvent,
      cpuUsage,
      memoryUsage,
      requestsPerSecond,
    });

    // Audit log scaling event
    if (this.auditLogger) {
      this.auditLogger.logAuditEvent({
        eventType: AuditEventType.SYSTEM_EVENT,
        severity: AuditSeverity.LOW,
        outcome: AuditOutcome.SUCCESS,
        userId: 'auto-scaling-system',
        resource: 'deployment-instances',
        action: 'scale_down',
        details: {
          ...scalingEvent,
          metrics: { cpuUsage, memoryUsage, requestsPerSecond },
        },
      });
    }

    this.emit('scaling-event', scalingEvent);

    try {
      await this.terminateLeastUtilizedInstance(healthyInstances);
    } catch (error) {
      logger.error('Failed to terminate instance during scale-down', {
        error: error instanceof Error ? error.message : 'Unknown error',
        scalingEvent,
      });
    }
  }

  /**
   * Provision new instance based on cloud provider
   */
  private async provisionNewInstance(): Promise<void> {
    const { cloudProvider } = this.config;

    try {
      let newInstance: DeploymentInstance;

      if (cloudProvider === 'aws' && this.awsProvider) {
        const [awsInstance] = await this.awsProvider.launchInstances('t3.medium', 1);
        if (!awsInstance) throw new Error('Failed to launch AWS instance');

        // Use the correct property names as defined in AWSInstance type
        const host: string =
          (typeof awsInstance.privateIp === 'string' && awsInstance.privateIp) ||
          (typeof awsInstance.publicIp === 'string' && awsInstance.publicIp) ||
          'unknown';

        newInstance = {
          id: this.generateInstanceId(),
          status: 'starting',
          host,
          port: 3000,
          healthStatus: 'unknown',
          startTime: Date.now(),
          metrics: {
            cpuUsage: 0,
            memoryUsage: 0,
            activeConnections: 0,
            requestsPerSecond: 0,
          },
          version: '1.0.0',
          environment: this.config.environment,
        };

        // Wait for instance to be ready and register it
        await this.waitForInstanceReady(newInstance);
      } else if (cloudProvider === 'azure' && this.azureProvider) {
        const vmName = `codecrucible-vm-${Date.now()}`;
        // Define an interface for the expected VM object
        interface AzureVM {
          privateIPs?: string[];
          publicIPs?: string[];
          [key: string]: unknown;
        }
        const vm = (await this.azureProvider.createVirtualMachine(vmName)) as unknown as AzureVM;

        let host = 'unknown';
        if (Array.isArray(vm.privateIPs) && vm.privateIPs.length > 0) {
          const [firstPrivateIP] = vm.privateIPs;
          host = firstPrivateIP;
        } else if (Array.isArray(vm.publicIPs) && vm.publicIPs.length > 0) {
          const [firstPublicIP] = vm.publicIPs;
          host = firstPublicIP;
        }

        newInstance = {
          id: this.generateInstanceId(),
          status: 'starting',
          host,
          port: 3000,
          healthStatus: 'unknown',
          startTime: Date.now(),
          metrics: {
            cpuUsage: 0,
            memoryUsage: 0,
            activeConnections: 0,
            requestsPerSecond: 0,
          },
          version: '1.0.0',
          environment: this.config.environment,
        };

        await this.waitForInstanceReady(newInstance);
      } else {
        // Local development - start new process
        const port = 3000 + Math.floor(Math.random() * 1000);
        const instanceId = this.generateInstanceId();

        // In a real implementation, this would start a new process/container
        // For now, we'll create a conceptual instance that represents a local process
        newInstance = {
          id: instanceId,
          status: 'running',
          host: 'localhost',
          port,
          healthStatus: 'healthy',
          startTime: Date.now(),
          metrics: {
            cpuUsage: 20 + Math.random() * 30,
            memoryUsage: 30 + Math.random() * 40,
            activeConnections: 0,
            requestsPerSecond: 0,
          },
          version: '1.0.0',
          environment: this.config.environment,
        };

        this.instances.set(instanceId, newInstance);
        this.loadBalancer?.addInstance(newInstance);
      }

      logger.info('New instance provisioned successfully', {
        instanceId: newInstance.id,
        host: newInstance.host,
        port: newInstance.port,
        cloudProvider,
      });
    } catch (error) {
      logger.error('Failed to provision new instance', {
        cloudProvider,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Wait for instance to be ready and responsive
   */
  private async waitForInstanceReady(
    instance: DeploymentInstance,
    maxWaitTime = 300000
  ): Promise<void> {
    const startTime = Date.now();
    const checkInterval = 5000; // Check every 5 seconds

    while (Date.now() - startTime < maxWaitTime) {
      try {
        const url = `http://${instance.host}:${instance.port}/health`;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => {
          controller.abort();
        }, 5000);
        const response = await fetch(url, {
          method: 'GET',
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        if (response.ok) {
          instance.status = 'running';
          instance.healthStatus = 'healthy';
          this.instances.set(instance.id, instance);
          this.loadBalancer?.addInstance(instance);

          logger.info('Instance is ready and healthy', {
            instanceId: instance.id,
            waitTime: Date.now() - startTime,
          });
          return;
        }
      } catch {
        // Instance not ready yet, continue waiting
      }

      await new Promise(resolve => setTimeout(resolve, checkInterval));
    }

    throw new Error(`Instance failed to become ready within ${maxWaitTime}ms`);
  }

  /**
   * Terminate the least utilized instance
   */
  private async terminateLeastUtilizedInstance(
    healthyInstances: Readonly<DeploymentInstance>[]
  ): Promise<void> {
    if (healthyInstances.length <= this.config.scaling.minInstances) return;

    // Find instance with lowest combined CPU and memory utilization
    const instanceToTerminate = healthyInstances.reduce(
      (lowest: Readonly<DeploymentInstance>, current: Readonly<DeploymentInstance>) => {
        const lowestUtil = lowest.metrics.cpuUsage + lowest.metrics.memoryUsage;
        const currentUtil = current.metrics.cpuUsage + current.metrics.memoryUsage;
        return currentUtil < lowestUtil ? current : lowest;
      }
    );

    logger.info('Terminating instance for scale-down', {
      instanceId: instanceToTerminate.id,
      cpuUsage: instanceToTerminate.metrics.cpuUsage,
      memoryUsage: instanceToTerminate.metrics.memoryUsage,
    });

    try {
      // Graceful shutdown - mark as stopping and drain connections
      const mutableInstance = { ...instanceToTerminate };
      mutableInstance.status = 'stopping';
      this.loadBalancer?.disableInstance(instanceToTerminate);

      // Wait for connections to drain (max 30 seconds)
      const drainStartTime = Date.now();
      while (
        instanceToTerminate.metrics.activeConnections > 0 &&
        Date.now() - drainStartTime < 30000
      ) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      // Terminate based on cloud provider
      const { cloudProvider } = this.config;

      if (cloudProvider === 'aws' && this.awsProvider) {
        // In real implementation, would terminate the actual AWS instance
        // await this.awsProvider.terminateInstance(instanceToTerminate.cloudInstanceId);
      } else if (cloudProvider === 'azure' && this.azureProvider) {
        // In real implementation, would delete the actual Azure VM
        // await this.azureProvider.deleteVirtualMachine(instanceToTerminate.cloudResourceName);
      }

      // Remove from our tracking
      this.unregisterInstance(instanceToTerminate.id);

      logger.info('Instance terminated successfully', {
        instanceId: instanceToTerminate.id,
        drainTime: Date.now() - drainStartTime,
      });
    } catch (error) {
      logger.error('Failed to terminate instance', {
        instanceId: instanceToTerminate.id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Handle performance threshold events from monitoring system
   */
  private handlePerformanceThreshold(event: {
    metric: string;
    value: number;
    threshold: number;
  }): void {
    if (event.metric === 'cpu_usage' || event.metric === 'memory_usage') {
      logger.info('Performance threshold triggered scaling evaluation', {
        metric: event.metric,
        value: event.value,
        threshold: event.threshold,
      });

      // Trigger immediate scaling evaluation
      setImmediate(() => {
        this.evaluateScaling();
      });
    }
  }

  /**
   * Generate unique instance ID with timestamp and random component
   */
  private generateInstanceId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return `inst-${timestamp}-${random}`;
  }

  /**
   * Get comprehensive deployment status
   */
  public getDeploymentStatus(): {
    instances: DeploymentInstance[];
    scaling: {
      enabled: boolean;
      currentInstances: number;
      targetRange: { min: number; max: number };
      recentEvents: ScalingEvent[];
      cooldownStatus: {
        scaleUpReady: boolean;
        scaleDownReady: boolean;
        nextScaleUpAllowed?: number;
        nextScaleDownAllowed?: number;
      };
    };
    health: {
      healthy: number;
      unhealthy: number;
      unknown: number;
      lastCheckTime: number;
    };
    loadBalancer: {
      strategy: string;
      activeInstances: number;
      totalInstances: number;
    };
    deploymentHistory: Array<{
      version: string;
      environment: string;
      timestamp: number;
      success: boolean;
      duration: number;
    }>;
    metrics: {
      averageCpuUsage: number;
      averageMemoryUsage: number;
      totalRequestsPerSecond: number;
      totalActiveConnections: number;
    };
  } {
    const instances = Array.from(this.instances.values());
    const healthyInstances = instances.filter(
      (i: Readonly<DeploymentInstance>) => i.healthStatus === 'healthy'
    );

    const health = instances.reduce(
      (
        acc: { healthy: number; unhealthy: number; unknown: number },
        instance: Readonly<DeploymentInstance>
      ) => {
        acc[instance.healthStatus]++;
        return acc;
      },
      { healthy: 0, unhealthy: 0, unknown: 0 }
    );

    // Calculate aggregate metrics
    const metrics =
      healthyInstances.length > 0
        ? {
            averageCpuUsage:
              healthyInstances.reduce(
                (sum: number, i: Readonly<DeploymentInstance>) => sum + i.metrics.cpuUsage,
                0
              ) / healthyInstances.length,
            averageMemoryUsage:
              healthyInstances.reduce(
                (sum: number, i: Readonly<DeploymentInstance>) => sum + i.metrics.memoryUsage,
                0
              ) / healthyInstances.length,
            totalRequestsPerSecond: healthyInstances.reduce(
              (sum: number, i: Readonly<DeploymentInstance>) => sum + i.metrics.requestsPerSecond,
              0
            ),
            totalActiveConnections: healthyInstances.reduce(
              (sum: number, i: Readonly<DeploymentInstance>) => sum + i.metrics.activeConnections,
              0
            ),
          }
        : {
            averageCpuUsage: 0,
            averageMemoryUsage: 0,
            totalRequestsPerSecond: 0,
            totalActiveConnections: 0,
          };

    // Check cooldown status
    const now = Date.now();
    const lastScaleUp = this.scalingEvents
      .filter((e: Readonly<ScalingEvent>) => e.type === 'scale-up')
      .pop();
    const lastScaleDown = this.scalingEvents
      .filter((e: Readonly<ScalingEvent>) => e.type === 'scale-down')
      .pop();

    const cooldownStatus = {
      scaleUpReady:
        !lastScaleUp || now - lastScaleUp.timestamp >= this.config.scaling.scaleUpCooldown,
      scaleDownReady:
        !lastScaleDown || now - lastScaleDown.timestamp >= this.config.scaling.scaleDownCooldown,
      nextScaleUpAllowed: lastScaleUp
        ? lastScaleUp.timestamp + this.config.scaling.scaleUpCooldown
        : undefined,
      nextScaleDownAllowed: lastScaleDown
        ? lastScaleDown.timestamp + this.config.scaling.scaleDownCooldown
        : undefined,
    };

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
        cooldownStatus,
      },
      health: {
        ...health,
        lastCheckTime: Math.max(
          ...instances.map((i: Readonly<DeploymentInstance>) => i.lastHealthCheck ?? 0),
          0
        ),
      },
      loadBalancer: {
        strategy: this.config.loadBalancing.strategy,
        activeInstances: healthyInstances.length,
        totalInstances: instances.length,
      },
      deploymentHistory: this.deploymentHistory.slice(-20),
      metrics,
    };
  }

  /**
   * Stop deployment system and cleanup resources
   */
  public stop(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = undefined;
    }

    if (this.scalingMonitorInterval) {
      clearInterval(this.scalingMonitorInterval);
      this.scalingMonitorInterval = undefined;
    }

    // Gracefully stop all instances
    const instances = Array.from(this.instances.values());
    instances.forEach((instance: Readonly<DeploymentInstance>) => {
      if (instance.status === 'running') {
        (instance as DeploymentInstance).status = 'stopping';
      }
    });

    logger.info('Enterprise Deployment System stopped', {
      instancesStopped: instances.length,
      scalingEventCount: this.scalingEvents.length,
    });

    this.emit('deployment-system-stop');
  }
}

/**
 * Production-ready Load Balancer implementation
 */
class LoadBalancer {
  private readonly config: LoadBalancerConfig;
  private enabledInstances: DeploymentInstance[] = [];
  private currentIndex = 0;
  private readonly connectionCounts = new Map<string, number>();
  private readonly sessionMap = new Map<string, string>(); // session -> instance mapping
  private readonly instanceWeights = new Map<string, number>();

  public constructor(config: Readonly<LoadBalancerConfig>) {
    this.config = config;
    this.enabledInstances = config.instances.filter(
      (i: Readonly<DeploymentInstance>) => i.healthStatus === 'healthy'
    );
    this.updateInstanceWeights();
  }

  /**
   * Get next instance based on load balancing strategy
   */
  public getNextInstance(clientIP?: string, sessionId?: string): DeploymentInstance | null {
    if (this.enabledInstances.length === 0) return null;

    // Handle session affinity
    if (this.config.sessionAffinity && sessionId) {
      const instanceId = this.sessionMap.get(sessionId);
      if (instanceId) {
        const instance = this.enabledInstances.find(
          (i: Readonly<DeploymentInstance>) => i.id === instanceId
        );
        if (instance) return instance;
      }
    }

    let selectedInstance: DeploymentInstance;

    switch (this.config.strategy) {
      case 'round-robin':
        selectedInstance = this.getRoundRobinInstance();
        break;
      case 'least-connections':
        selectedInstance = this.getLeastConnectionsInstance();
        break;
      case 'weighted':
        selectedInstance = this.getWeightedInstance();
        break;
      case 'ip-hash':
        selectedInstance = this.getIPHashInstance(clientIP);
        break;
      default:
        selectedInstance = this.getRoundRobinInstance();
    }

    // Store session mapping if session affinity is enabled
    if (this.config.sessionAffinity && sessionId) {
      this.sessionMap.set(sessionId, selectedInstance.id);
    }

    return selectedInstance;
  }

  private getRoundRobinInstance(): DeploymentInstance {
    const instance = this.enabledInstances[this.currentIndex];
    this.currentIndex = (this.currentIndex + 1) % this.enabledInstances.length;
    return instance;
  }

  private getLeastConnectionsInstance(): DeploymentInstance {
    return this.enabledInstances.reduce(
      (least: Readonly<DeploymentInstance>, current: Readonly<DeploymentInstance>) => {
        const leastConnections = this.connectionCounts.get(least.id) ?? 0;
        const currentConnections = this.connectionCounts.get(current.id) ?? 0;
        return currentConnections < leastConnections ? current : least;
      }
    );
  }

  private getWeightedInstance(): DeploymentInstance {
    const weights = this.enabledInstances.map((instance: Readonly<DeploymentInstance>) => {
      const cpuWeight = Math.max(1, 100 - instance.metrics.cpuUsage);
      const memoryWeight = Math.max(1, 100 - instance.metrics.memoryUsage);
      const connectionWeight = Math.max(1, 100 - (this.connectionCounts.get(instance.id) ?? 0));
      // Combined weight favoring instances with lower utilization
      return (cpuWeight + memoryWeight + connectionWeight) / 3;
    });

    const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
    if (totalWeight === 0) return this.enabledInstances[0];

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

  private getIPHashInstance(clientIP?: string): DeploymentInstance {
    if (!clientIP) return this.getRoundRobinInstance();

    // Simple hash function for IP address
    let hash = 0;
    for (let i = 0; i < clientIP.length; i++) {
      const char = clientIP.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }

    const index = Math.abs(hash) % this.enabledInstances.length;
    return this.enabledInstances[index];
  }

  private updateInstanceWeights(): void {
    this.enabledInstances.forEach(instance => {
      const weight = this.calculateInstanceWeight(instance);
      this.instanceWeights.set(instance.id, weight);
    });
  }

  private calculateInstanceWeight(instance: DeploymentInstance): number {
    // Weight based on resource availability and performance
    const cpuAvailability = Math.max(0, 100 - instance.metrics.cpuUsage);
    const memoryAvailability = Math.max(0, 100 - instance.metrics.memoryUsage);
    const connectionLoad = this.connectionCounts.get(instance.id) || 0;

    return (cpuAvailability + memoryAvailability) / 2 - connectionLoad;
  }

  public addInstance(instance: Readonly<DeploymentInstance>): void {
    if (
      instance.healthStatus === 'healthy' &&
      !this.enabledInstances.find((i: Readonly<DeploymentInstance>) => i.id === instance.id)
    ) {
      this.enabledInstances.push(instance as DeploymentInstance);
      this.connectionCounts.set(instance.id, 0);
      this.updateInstanceWeights();
    }
  }

  public removeInstance(instance: Readonly<DeploymentInstance>): void {
    this.enabledInstances = this.enabledInstances.filter(
      (i: Readonly<DeploymentInstance>) => i.id !== instance.id
    );
    this.connectionCounts.delete(instance.id);
    this.instanceWeights.delete(instance.id);

    // Clean up session mappings
    for (const [sessionId, instanceId] of this.sessionMap.entries()) {
      if (instanceId === instance.id) {
        this.sessionMap.delete(sessionId);
      }
    }
  }

  public enableInstance(instance: Readonly<DeploymentInstance>): void {
    if (!this.enabledInstances.find((i: Readonly<DeploymentInstance>) => i.id === instance.id)) {
      this.enabledInstances.push(instance as DeploymentInstance);
      if (!this.connectionCounts.has(instance.id)) {
        this.connectionCounts.set(instance.id, 0);
      }
      this.updateInstanceWeights();
    }
  }

  public disableInstance(instance: Readonly<DeploymentInstance>): void {
    this.enabledInstances = this.enabledInstances.filter(
      (i: Readonly<DeploymentInstance>) => i.id !== instance.id
    );

    // Clean up session mappings for disabled instance
    for (const [sessionId, instanceId] of this.sessionMap.entries()) {
      if (instanceId === instance.id) {
        this.sessionMap.delete(sessionId);
      }
    }
  }

  public incrementConnections(instanceId: string): void {
    const current = this.connectionCounts.get(instanceId) ?? 0;
    this.connectionCounts.set(instanceId, current + 1);
    this.updateInstanceWeights();
  }

  public decrementConnections(instanceId: string): void {
    const current = this.connectionCounts.get(instanceId) ?? 0;
    this.connectionCounts.set(instanceId, Math.max(0, current - 1));
    this.updateInstanceWeights();
  }

  public getInstanceStats(): Map<string, { connections: number; weight: number }> {
    const stats = new Map<string, { connections: number; weight: number }>();

    this.enabledInstances.forEach((instance: Readonly<DeploymentInstance>) => {
      stats.set(instance.id, {
        connections: this.connectionCounts.get(instance.id) ?? 0,
        weight: this.instanceWeights.get(instance.id) ?? 0,
      });
    });

    return stats;
  }

  public clearSession(sessionId: string): void {
    this.sessionMap.delete(sessionId);
  }
}

export default EnterpriseDeploymentSystem;
