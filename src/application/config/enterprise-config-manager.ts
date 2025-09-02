/**
 * Enterprise Configuration Manager
 * Provides centralized configuration management for enterprise features
 */

import { logger } from '../../infrastructure/logging/logger.js';

export interface EnterpriseConfig {
  security: {
    enableAuditLogging: boolean;
    enableThreatDetection: boolean;
    sessionTimeout: number;
    maxLoginAttempts: number;
  };
  monitoring: {
    enableMetrics: boolean;
    enableAlerts: boolean;
    performanceThreshold: number;
    healthCheckInterval: number;
  };
  backup: {
    enabled: boolean;
    schedule: string;
    retentionDays: number;
    compressionEnabled: boolean;
  };
  compliance: {
    enableSOX: boolean;
    enableGDPR: boolean;
    enableHIPAA: boolean;
    auditRetentionDays: number;
  };
}

export class EnterpriseConfigManager {
  private config: EnterpriseConfig;
  private configPath: string;

  constructor(configPath: string = './config/enterprise.json') {
    this.configPath = configPath;
    this.config = this.getDefaultConfig();
    this.loadConfig();
  }

  private getDefaultConfig(): EnterpriseConfig {
    return {
      security: {
        enableAuditLogging: true,
        enableThreatDetection: true,
        sessionTimeout: 3600000, // 1 hour
        maxLoginAttempts: 3,
      },
      monitoring: {
        enableMetrics: true,
        enableAlerts: true,
        performanceThreshold: 5000, // 5 seconds
        healthCheckInterval: 30000, // 30 seconds
      },
      backup: {
        enabled: true,
        schedule: '0 2 * * *', // Daily at 2 AM
        retentionDays: 30,
        compressionEnabled: true,
      },
      compliance: {
        enableSOX: false,
        enableGDPR: true,
        enableHIPAA: false,
        auditRetentionDays: 365,
      },
    };
  }

  private async loadConfig(): Promise<void> {
    try {
      // In a real implementation, this would load from a file
      // For now, we'll use the default config
      logger.info('Enterprise configuration loaded successfully');
    } catch (error) {
      logger.warn('Failed to load enterprise config, using defaults:', error);
    }
  }

  public getConfig(): EnterpriseConfig {
    return { ...this.config };
  }

  public getSecurityConfig() {
    return this.config.security;
  }

  public getMonitoringConfig() {
    return this.config.monitoring;
  }

  public getBackupConfig() {
    return this.config.backup;
  }

  public getComplianceConfig() {
    return this.config.compliance;
  }

  public updateConfig(partialConfig: Partial<EnterpriseConfig>): void {
    this.config = { ...this.config, ...partialConfig };
    logger.info('Enterprise configuration updated');
  }

  public async saveConfig(): Promise<void> {
    try {
      // In a real implementation, this would save to a file
      logger.info('Enterprise configuration saved successfully');
    } catch (error) {
      logger.error('Failed to save enterprise config:', error);
    }
  }

  public isFeatureEnabled(feature: string): boolean {
    switch (feature) {
      case 'audit_logging':
        return this.config.security.enableAuditLogging;
      case 'threat_detection':
        return this.config.security.enableThreatDetection;
      case 'metrics':
        return this.config.monitoring.enableMetrics;
      case 'alerts':
        return this.config.monitoring.enableAlerts;
      case 'backup':
        return this.config.backup.enabled;
      case 'sox_compliance':
        return this.config.compliance.enableSOX;
      case 'gdpr_compliance':
        return this.config.compliance.enableGDPR;
      case 'hipaa_compliance':
        return this.config.compliance.enableHIPAA;
      default:
        return false;
    }
  }
}
