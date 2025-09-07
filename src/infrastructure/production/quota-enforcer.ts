import {
  EnforcementAction,
  ResourceLimits,
  ResourceViolation,
  ResourceType,
} from './resource-types.js';

/**
 * QuotaEnforcer
 *
 * Applies resource limits and returns structured violations when limits are
 * exceeded. The enforcer does not attempt to resolve violations; the caller is
 * responsible for taking the appropriate action.
 */
export class QuotaEnforcer {
  private violations: ResourceViolation[] = [];

  constructor(private limits: ResourceLimits) {}

  enforce(
    type: ResourceType,
    value: number,
    metric?: string,
    operation?: string
  ): ResourceViolation | null {
    const now = Date.now();
    let violation: ResourceViolation | null = null;

    switch (type) {
      case ResourceType.MEMORY: {
        const { softLimit, hardLimit, emergencyLimit } = this.limits.memory;
        if (value > emergencyLimit) {
          violation = {
            id: `mem-${now}`,
            timestamp: now,
            resourceType: type,
            violationType: 'emergency',
            currentValue: value,
            limitValue: emergencyLimit,
            operation,
            action: EnforcementAction.EMERGENCY_CLEANUP,
          };
        } else if (value > hardLimit) {
          violation = {
            id: `mem-${now}`,
            timestamp: now,
            resourceType: type,
            violationType: 'hard_limit',
            currentValue: value,
            limitValue: hardLimit,
            operation,
            action: EnforcementAction.CLEANUP,
          };
        } else if (value > softLimit) {
          violation = {
            id: `mem-${now}`,
            timestamp: now,
            resourceType: type,
            violationType: 'soft_limit',
            currentValue: value,
            limitValue: softLimit,
            operation,
            action: EnforcementAction.WARN,
          };
        }
        break;
      }

      case ResourceType.CPU: {
        const { maxUsagePercent, throttleThreshold } = this.limits.cpu;
        if (value > maxUsagePercent) {
          violation = {
            id: `cpu-${now}`,
            timestamp: now,
            resourceType: type,
            violationType: 'hard_limit',
            currentValue: value,
            limitValue: maxUsagePercent,
            operation,
            action: EnforcementAction.REJECT,
          };
        } else if (value > throttleThreshold) {
          violation = {
            id: `cpu-${now}`,
            timestamp: now,
            resourceType: type,
            violationType: 'soft_limit',
            currentValue: value,
            limitValue: throttleThreshold,
            operation,
            action: EnforcementAction.THROTTLE,
          };
        }
        break;
      }

      case ResourceType.CONCURRENCY: {
        const { maxConcurrentOperations, maxQueueSize } = this.limits.concurrency;
        if (metric === 'queued') {
          if (value > maxQueueSize) {
            violation = {
              id: `concq-${now}`,
              timestamp: now,
              resourceType: type,
              violationType: 'hard_limit',
              currentValue: value,
              limitValue: maxQueueSize,
              operation,
              action: EnforcementAction.REJECT,
            };
          }
        } else if (value > maxConcurrentOperations) {
          violation = {
            id: `conc-${now}`,
            timestamp: now,
            resourceType: type,
            violationType: 'hard_limit',
            currentValue: value,
            limitValue: maxConcurrentOperations,
            operation,
            action: EnforcementAction.QUEUE,
          };
        }
        break;
      }

      case ResourceType.NETWORK: {
        const { maxConnections, maxBandwidthMbps } = this.limits.network;
        if (metric === 'bandwidth') {
          if (value > maxBandwidthMbps) {
            violation = {
              id: `netb-${now}`,
              timestamp: now,
              resourceType: type,
              violationType: 'hard_limit',
              currentValue: value,
              limitValue: maxBandwidthMbps,
              operation,
              action: EnforcementAction.THROTTLE,
            };
          }
        } else if (value > maxConnections) {
          violation = {
            id: `net-${now}`,
            timestamp: now,
            resourceType: type,
            violationType: 'hard_limit',
            currentValue: value,
            limitValue: maxConnections,
            operation,
            action: EnforcementAction.REJECT,
          };
        }
        break;
      }

      case ResourceType.FILESYSTEM: {
        const { maxOpenFiles, maxDiskUsageMB } = this.limits.filesystem;
        if (metric === 'disk') {
          if (value > maxDiskUsageMB) {
            violation = {
              id: `fsd-${now}`,
              timestamp: now,
              resourceType: type,
              violationType: 'hard_limit',
              currentValue: value,
              limitValue: maxDiskUsageMB,
              operation,
              action: EnforcementAction.CLEANUP,
            };
          }
        } else if (value > maxOpenFiles) {
          violation = {
            id: `fs-${now}`,
            timestamp: now,
            resourceType: type,
            violationType: 'hard_limit',
            currentValue: value,
            limitValue: maxOpenFiles,
            operation,
            action: EnforcementAction.REJECT,
          };
        }
        break;
      }
    }

    if (violation) {
      this.violations.push(violation);
    }

    return violation;
  }

  getViolations(): ResourceViolation[] {
    return this.violations;
  }

  resolveViolation(id: string): void {
    const violation = this.violations.find(v => v.id === id);
    if (violation) {
      violation.resolved = true;
      violation.resolvedAt = Date.now();
    }
  }
}
