export enum ResourceType {
  MEMORY = 'memory',
  CPU = 'cpu',
  CONCURRENCY = 'concurrency',
  NETWORK = 'network',
  FILESYSTEM = 'filesystem',
}

export enum EnforcementAction {
  WARN = 'warn',
  THROTTLE = 'throttle',
  QUEUE = 'queue',
  REJECT = 'reject',
  CLEANUP = 'cleanup',
  EMERGENCY_CLEANUP = 'emergency_cleanup',
  KILL_OPERATION = 'kill_operation',
}

export interface ResourceLimits {
  memory: {
    hardLimit: number;
    softLimit: number;
    emergencyLimit: number;
    gcThreshold: number;
    leakDetectionEnabled: boolean;
    maxAllocationSize: number;
  };

  cpu: {
    maxUsagePercent: number;
    throttleThreshold: number;
    measurementWindow: number;
    throttleDelay: number;
    maxConcurrentCpuOps: number;
  };

  concurrency: {
    maxConcurrentOperations: number;
    maxQueueSize: number;
    operationTimeout: number;
    priorityLevels: number;
    fairnessEnabled: boolean;
    starvationPrevention: boolean;
  };

  network: {
    maxConnections: number;
    maxBandwidthMbps: number;
    connectionTimeout: number;
    idleTimeout: number;
    maxConcurrentRequests: number;
  };

  filesystem: {
    maxOpenFiles: number;
    maxDiskUsageMB: number;
    tempFileQuotaMB: number;
    maxFileSize: number;
    ioThrottleThreshold: number;
  };
}

export interface ResourceSnapshot {
  timestamp: number;
  memory: {
    heapUsed: number;
    heapTotal: number;
    external: number;
    rss: number;
    utilizationPercent: number;
    leaksDetected: number;
  };
  cpu: {
    usagePercent: number;
    loadAverage: number[];
    activeOperations: number;
    throttledOperations: number;
  };
  concurrency: {
    activeOperations: number;
    queuedOperations: number;
    rejectedOperations: number;
    avgWaitTime: number;
  };
  network: {
    activeConnections: number;
    bandwidthUsageMbps: number;
    pendingRequests: number;
    connectionErrors: number;
  };
  filesystem: {
    openFiles: number;
    diskUsageMB: number;
    tempFilesCount: number;
    ioOperationsPerSec: number;
  };
}

export interface ResourceViolation {
  id: string;
  timestamp: number;
  resourceType: ResourceType;
  violationType: 'soft_limit' | 'hard_limit' | 'emergency';
  currentValue: number;
  limitValue: number;
  operation?: string;
  context?: any;
  action: EnforcementAction;
  resolved?: boolean;
  resolvedAt?: number;
}

export interface OperationResourceContext {
  operationId: string;
  resourceRequirements: {
    memory?: number;
    cpu?: number;
    concurrency?: number;
    network?: number;
    filesystem?: number;
  };
  priority: number;
  startTime: number;
  timeout: number;
  resourcesAllocated: Map<ResourceType, number>;
  state: 'pending' | 'running' | 'completed' | 'failed' | 'timeout';
}
