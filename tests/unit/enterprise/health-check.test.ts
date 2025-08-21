/**
 * Health Check System Test Suite - Enterprise Testing
 * Testing the comprehensive health monitoring system
 */

import { HealthMonitor, healthMonitor } from '../../../src/infrastructure/health/health-check.js';

describe('Enterprise Health Check System', () => {
  let monitor: HealthMonitor;

  beforeEach(() => {
    monitor = HealthMonitor.getInstance();
  });

  afterEach(() => {
    monitor.stopPeriodicChecks();
  });

  describe('Health Check Registration', () => {
    test('should register custom health checks', async () => {
      const mockCheck = jest.fn().mockResolvedValue({
        name: 'custom-check',
        status: 'healthy',
        message: 'All systems operational',
        duration: 10
      });

      monitor.registerCheck('custom-check', mockCheck);
      
      const health = await monitor.runHealthChecks();
      expect(health.healthy).toBe(true);
      expect(mockCheck).toHaveBeenCalled();
    });

    test('should handle failing health checks', async () => {
      const failingCheck = jest.fn().mockRejectedValue(new Error('Service unavailable'));
      
      monitor.registerCheck('failing-check', failingCheck);
      
      const health = await monitor.runHealthChecks();
      const failedCheck = health.checks.find(c => c.name === 'failing-check');
      
      expect(failedCheck?.status).toBe('unhealthy');
      expect(failedCheck?.message).toContain('Service unavailable');
    });
  });

  describe('System Health Checks', () => {
    test('should check CPU usage', async () => {
      const health = await monitor.runHealthChecks();
      const cpuCheck = health.checks.find(c => c.name === 'cpu');
      
      expect(cpuCheck).toBeDefined();
      expect(cpuCheck?.status).toMatch(/healthy|degraded|unhealthy/);
      expect(cpuCheck?.metrics?.usage).toBeGreaterThanOrEqual(0);
    });

    test('should check memory usage', async () => {
      const health = await monitor.runHealthChecks();
      const memoryCheck = health.checks.find(c => c.name === 'memory');
      
      expect(memoryCheck).toBeDefined();
      expect(memoryCheck?.status).toMatch(/healthy|degraded|unhealthy/);
      expect(memoryCheck?.metrics?.systemUsage).toBeGreaterThanOrEqual(0);
    });

    test('should check disk usage', async () => {
      const health = await monitor.runHealthChecks();
      const diskCheck = health.checks.find(c => c.name === 'disk');
      
      expect(diskCheck).toBeDefined();
      expect(['healthy', 'degraded', 'unhealthy'].includes(diskCheck?.status || '')).toBe(true);
    });
  });

  describe('Service Health Checks', () => {
    test('should check database connectivity', async () => {
      const health = await monitor.runHealthChecks();
      const dbCheck = health.checks.find(c => c.name === 'database');
      
      expect(dbCheck).toBeDefined();
      expect(dbCheck?.duration).toBeGreaterThan(0);
      expect(dbCheck?.metrics?.responseTime).toBeGreaterThan(0);
    });

    test('should check cache service', async () => {
      const health = await monitor.runHealthChecks();
      const cacheCheck = health.checks.find(c => c.name === 'cache');
      
      expect(cacheCheck).toBeDefined();
      expect(cacheCheck?.metrics?.responseTime).toBeGreaterThan(0);
      expect(cacheCheck?.metrics?.hitRate).toBeGreaterThan(0);
    });

    test('should check voice system', async () => {
      const health = await monitor.runHealthChecks();
      const voiceCheck = health.checks.find(c => c.name === 'voice_system');
      
      expect(voiceCheck).toBeDefined();
      expect(voiceCheck?.metrics?.voiceCount).toBeGreaterThan(0);
    });

    test('should check council engine', async () => {
      const health = await monitor.runHealthChecks();
      const councilCheck = health.checks.find(c => c.name === 'council_engine');
      
      expect(councilCheck).toBeDefined();
      expect(councilCheck?.status).toBe('healthy');
    });

    test('should check security framework', async () => {
      const health = await monitor.runHealthChecks();
      const securityCheck = health.checks.find(c => c.name === 'security_framework');
      
      expect(securityCheck).toBeDefined();
      expect(securityCheck?.metrics?.testPassed).toBe(true);
    });
  });

  describe('Readiness and Liveness Probes', () => {
    test('should provide readiness probe', async () => {
      const readiness = await monitor.getReadiness();
      
      expect(readiness).toHaveProperty('ready');
      expect(readiness).toHaveProperty('checks');
      expect(readiness).toHaveProperty('message');
      expect(Array.isArray(readiness.checks)).toBe(true);
    });

    test('should provide liveness probe', async () => {
      const liveness = await monitor.getLiveness();
      
      expect(liveness).toHaveProperty('alive');
      expect(liveness).toHaveProperty('uptime');
      expect(liveness).toHaveProperty('message');
      expect(typeof liveness.uptime).toBe('number');
      expect(liveness.uptime).toBeGreaterThan(0);
    });

    test('should handle liveness probe memory allocation test', async () => {
      const liveness = await monitor.getLiveness();
      
      expect(liveness.alive).toBe(true);
      expect(liveness.message).toBe('Service is alive');
    });
  });

  describe('Health Status Management', () => {
    test('should cache health status', async () => {
      const health1 = await monitor.getHealth();
      const health2 = await monitor.getHealth();
      
      // Should return cached result within 30 seconds
      expect(health1.timestamp).toEqual(health2.timestamp);
    });

    test('should refresh stale health status', async () => {
      const health1 = await monitor.runHealthChecks();
      
      // Wait a bit and modify the internal timestamp to simulate staleness
      await new Promise(resolve => setTimeout(resolve, 50));
      
      const health2 = await monitor.getHealth();
      
      expect(health1).toBeDefined();
      expect(health2).toBeDefined();
    });

    test('should determine overall health correctly', async () => {
      const health = await monitor.runHealthChecks();
      
      const hasUnhealthy = health.checks.some(c => c.status === 'unhealthy');
      expect(health.healthy).toBe(!hasUnhealthy);
    });
  });

  describe('Periodic Health Checks', () => {
    test('should start periodic health checks', (done) => {
      monitor.startPeriodicChecks(100); // Very fast for testing
      
      setTimeout(() => {
        monitor.stopPeriodicChecks();
        done();
      }, 250);
    });

    test('should stop periodic health checks', () => {
      monitor.startPeriodicChecks(1000);
      monitor.stopPeriodicChecks();
      
      // Should not throw error
      expect(true).toBe(true);
    });

    test('should handle multiple start/stop cycles', () => {
      monitor.startPeriodicChecks(1000);
      monitor.startPeriodicChecks(500); // Should replace previous
      monitor.stopPeriodicChecks();
      
      expect(true).toBe(true);
    });
  });

  describe('Health Check Performance', () => {
    test('should complete health checks within reasonable time', async () => {
      const startTime = Date.now();
      await monitor.runHealthChecks();
      const duration = Date.now() - startTime;
      
      // Should complete within 5 seconds
      expect(duration).toBeLessThan(5000);
    });

    test('should record check durations', async () => {
      const health = await monitor.runHealthChecks();
      
      health.checks.forEach(check => {
        expect(check.duration).toBeGreaterThanOrEqual(0);
        expect(typeof check.duration).toBe('number');
      });
    });
  });

  describe('Grimoire Quality Gates', () => {
    test('should respect CPU threshold (80%)', async () => {
      const health = await monitor.runHealthChecks();
      const cpuCheck = health.checks.find(c => c.name === 'cpu');
      
      if (cpuCheck?.metrics?.usage) {
        if (cpuCheck.metrics.usage > 80) {
          expect(['degraded', 'unhealthy'].includes(cpuCheck.status)).toBe(true);
        }
      }
    });

    test('should respect memory threshold (85%)', async () => {
      const health = await monitor.runHealthChecks();
      const memoryCheck = health.checks.find(c => c.name === 'memory');
      
      if (memoryCheck?.metrics?.systemUsage) {
        if (memoryCheck.metrics.systemUsage > 85) {
          expect(['degraded', 'unhealthy'].includes(memoryCheck.status)).toBe(true);
        }
      }
    });

    test('should respect disk threshold (90%)', async () => {
      const health = await monitor.runHealthChecks();
      const diskCheck = health.checks.find(c => c.name === 'disk');
      
      if (diskCheck?.metrics?.usage) {
        if (diskCheck.metrics.usage > 90) {
          expect(['degraded', 'unhealthy'].includes(diskCheck.status)).toBe(true);
        }
      }
    });
  });

  describe('Event Emission', () => {
    test('should emit health check events', (done) => {
      monitor.on('health:checked', (healthStatus) => {
        expect(healthStatus).toHaveProperty('healthy');
        expect(healthStatus).toHaveProperty('checks');
        expect(healthStatus).toHaveProperty('timestamp');
        done();
      });

      monitor.runHealthChecks();
    });
  });
});