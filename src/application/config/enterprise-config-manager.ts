/**
 * Enterprise Configuration Manager
 * Provides centralized configuration management for enterprise features
 */

import { logger } from '../../infrastructure/logging/logger.js';
import * as fs from 'fs/promises';
import * as path from 'path';

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
  private readonly configPath: string;
  private initialized: boolean = false;

  public constructor(configPath: string = './config/enterprise.json') {
    this.configPath = configPath;
    this.config = this.getDefaultConfig();
    // Don't load async in constructor - require explicit initialization
  }

  /**
   * Initialize the configuration manager by loading config from disk
   * This must be called before using the manager
   */
  public async initialize(): Promise<void> {
    if (this.initialized) {
      logger.debug('EnterpriseConfigManager already initialized');
      return;
    }
    
    await this.loadConfig();
    this.initialized = true;
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
      logger.debug(`Loading enterprise config from: ${this.configPath}`);
      
      // Resolve the config path relative to the project root
      const resolvedPath = path.resolve(process.cwd(), this.configPath);
      
      // Check if file exists
      try {
        await fs.access(resolvedPath);
      } catch {
        // File doesn't exist, create it with defaults
        logger.info('Config file not found, creating with defaults');
        await this.saveConfig();
        return;
      }
      
      // Read and parse the config file
      const configData = await fs.readFile(resolvedPath, 'utf-8');
      const loadedConfig = JSON.parse(configData) as Partial<EnterpriseConfig>;
      
      // Merge loaded config with defaults to ensure all fields exist
      this.config = {
        ...this.getDefaultConfig(),
        ...loadedConfig,
        security: { ...this.getDefaultConfig().security, ...loadedConfig.security },
        monitoring: { ...this.getDefaultConfig().monitoring, ...loadedConfig.monitoring },
        backup: { ...this.getDefaultConfig().backup, ...loadedConfig.backup },
        compliance: { ...this.getDefaultConfig().compliance, ...loadedConfig.compliance },
      };
      
      logger.info('Enterprise configuration loaded successfully');
    } catch (error) {
      logger.warn('Failed to load enterprise config, using defaults:', error);
    }
  }

  public getConfig(): EnterpriseConfig {
    if (!this.initialized) {
      logger.warn('EnterpriseConfigManager used before initialization, returning defaults');
    }
    return { ...this.config };
  }

  public isInitialized(): boolean {
    return this.initialized;
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
      const resolvedPath = path.resolve(process.cwd(), this.configPath);
      
      // Ensure the directory exists
      const dir = path.dirname(resolvedPath);
      await fs.mkdir(dir, { recursive: true });
      
      // Write the config file
      await fs.writeFile(
        resolvedPath,
        JSON.stringify(this.config, null, 2),
        'utf-8'
      );
      
      logger.info('Enterprise configuration saved successfully');
    } catch (error) {
      logger.error('Failed to save enterprise config:', error);
      throw error;
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
