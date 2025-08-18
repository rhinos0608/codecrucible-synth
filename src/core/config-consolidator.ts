#!/usr/bin/env node

/**
 * Configuration Consolidation System
 * Resolves conflicts between multiple configuration files and creates a unified config
 */

import { promises as fs } from 'fs';
import { resolve, join } from 'path';
import { load as loadYaml } from 'js-yaml';
import { logger } from './logger.js';

interface ConfigSource {
  file: string;
  type: 'yaml' | 'json' | 'env';
  priority: number;
  data: any;
}

interface ConfigConflict {
  key: string;
  sources: Array<{
    file: string;
    value: any;
    priority: number;
  }>;
  resolution: 'highest_priority' | 'merge' | 'manual_required';
  resolvedValue: any;
}

export class ConfigurationConsolidator {
  private sources: ConfigSource[] = [];
  private conflicts: ConfigConflict[] = [];
  private consolidatedConfig: any = {};

  /**
   * Load and consolidate all configuration files
   */
  async consolidateConfigurations(): Promise<{
    config: any;
    conflicts: ConfigConflict[];
    summary: {
      filesProcessed: number;
      conflictsFound: number;
      conflictsResolved: number;
    };
  }> {
    logger.info('🔧 Starting configuration consolidation...');

    // Load all configuration sources
    await this.loadConfigurationSources();

    // Detect conflicts
    this.detectConflicts();

    // Resolve conflicts
    this.resolveConflicts();

    // Generate consolidated configuration
    this.generateConsolidatedConfig();

    const summary = {
      filesProcessed: this.sources.length,
      conflictsFound: this.conflicts.length,
      conflictsResolved: this.conflicts.filter(c => c.resolution !== 'manual_required').length
    };

    return {
      config: this.consolidatedConfig,
      conflicts: this.conflicts,
      summary
    };
  }

  /**
   * Load all configuration sources with their priorities
   */
  private async loadConfigurationSources(): Promise<void> {
    const configFiles = [
      // Priority 1: Default configurations
      { file: 'config/default.yaml', type: 'yaml' as const, priority: 1 },
      { file: 'config/voices.yaml', type: 'yaml' as const, priority: 1 },
      
      // Priority 2: Hybrid/specific configurations
      { file: 'config/hybrid.yaml', type: 'yaml' as const, priority: 2 },
      { file: 'config/hybrid-config.json', type: 'json' as const, priority: 2 },
      { file: 'config/optimized-model-config.json', type: 'json' as const, priority: 2 },
      
      // Priority 3: Main configuration
      { file: 'codecrucible.config.json', type: 'json' as const, priority: 3 },
      
      // Priority 4: Environment variables (highest priority)
      { file: '.env', type: 'env' as const, priority: 4 },
      { file: '.env.local', type: 'env' as const, priority: 4 },
      { file: '.env.production', type: 'env' as const, priority: 4 }
    ];

    for (const configFile of configFiles) {
      try {
        const filePath = resolve(configFile.file);
        const exists = await fs.access(filePath).then(() => true).catch(() => false);
        
        if (exists) {
          const content = await fs.readFile(filePath, 'utf-8');
          let data: any;

          switch (configFile.type) {
            case 'yaml':
              data = loadYaml(content);
              break;
            case 'json':
              data = JSON.parse(content);
              break;
            case 'env':
              data = this.parseEnvFile(content);
              break;
          }

          this.sources.push({
            file: configFile.file,
            type: configFile.type,
            priority: configFile.priority,
            data
          });

          logger.info(`📄 Loaded config: ${configFile.file}`);
        }
      } catch (error) {
        logger.warn(`⚠️  Failed to load ${configFile.file}:`, error);
      }
    }
  }

  /**
   * Parse environment file into key-value pairs
   */
  private parseEnvFile(content: string): Record<string, string> {
    const env: Record<string, string> = {};
    const lines = content.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const [key, ...valueParts] = trimmed.split('=');
        if (key && valueParts.length > 0) {
          env[key.trim()] = valueParts.join('=').trim().replace(/^["']|["']$/g, '');
        }
      }
    }

    return env;
  }

  /**
   * Detect conflicts between configuration sources
   */
  private detectConflicts(): void {
    const keyMap = new Map<string, Array<{ source: ConfigSource; value: any; path: string }>>();

    // Flatten all configurations and track their sources
    for (const source of this.sources) {
      this.flattenConfig(source.data, '', source, keyMap);
    }

    // Find conflicts (same key with different values from different sources)
    for (const [key, entries] of keyMap) {
      if (entries.length > 1) {
        const uniqueValues = new Set(entries.map(e => JSON.stringify(e.value)));
        
        if (uniqueValues.size > 1) {
          const conflict: ConfigConflict = {
            key,
            sources: entries.map(e => ({
              file: e.source.file,
              value: e.value,
              priority: e.source.priority
            })),
            resolution: 'highest_priority',
            resolvedValue: null
          };

          // Determine resolution strategy
          const hasComplexValues = entries.some(e => 
            typeof e.value === 'object' && e.value !== null
          );

          if (hasComplexValues) {
            const canMerge = entries.every(e => 
              typeof e.value === 'object' && 
              e.value !== null && 
              !Array.isArray(e.value)
            );
            
            if (canMerge) {
              conflict.resolution = 'merge';
            } else {
              conflict.resolution = 'manual_required';
            }
          }

          this.conflicts.push(conflict);
        }
      }
    }
  }

  /**
   * Flatten nested configuration objects for conflict detection
   */
  private flattenConfig(
    obj: any, 
    prefix: string, 
    source: ConfigSource,
    keyMap: Map<string, Array<{ source: ConfigSource; value: any; path: string }>>
  ): void {
    for (const [key, value] of Object.entries(obj)) {
      const fullKey = prefix ? `${prefix}.${key}` : key;
      
      if (!keyMap.has(fullKey)) {
        keyMap.set(fullKey, []);
      }
      
      keyMap.get(fullKey)!.push({ source, value, path: fullKey });

      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        this.flattenConfig(value, fullKey, source, keyMap);
      }
    }
  }

  /**
   * Resolve detected conflicts
   */
  private resolveConflicts(): void {
    for (const conflict of this.conflicts) {
      switch (conflict.resolution) {
        case 'highest_priority':
          // Use value from highest priority source
          const highestPriority = Math.max(...conflict.sources.map(s => s.priority));
          const winningSource = conflict.sources.find(s => s.priority === highestPriority);
          conflict.resolvedValue = winningSource?.value;
          break;

        case 'merge':
          // Merge object values
          conflict.resolvedValue = {};
          for (const source of conflict.sources.sort((a, b) => a.priority - b.priority)) {
            if (typeof source.value === 'object' && source.value !== null) {
              conflict.resolvedValue = { ...conflict.resolvedValue, ...source.value };
            }
          }
          break;

        case 'manual_required':
          // Log conflict that requires manual resolution
          logger.warn(`⚠️  Manual resolution required for: ${conflict.key}`);
          // Use highest priority as fallback
          const fallbackPriority = Math.max(...conflict.sources.map(s => s.priority));
          const fallbackSource = conflict.sources.find(s => s.priority === fallbackPriority);
          conflict.resolvedValue = fallbackSource?.value;
          break;
      }
    }
  }

  /**
   * Generate the final consolidated configuration
   */
  private generateConsolidatedConfig(): void {
    // Start with empty config
    this.consolidatedConfig = {};

    // Apply configurations in priority order (lowest to highest)
    const sortedSources = [...this.sources].sort((a, b) => a.priority - b.priority);
    
    for (const source of sortedSources) {
      this.mergeDeep(this.consolidatedConfig, source.data);
    }

    // Apply conflict resolutions
    for (const conflict of this.conflicts) {
      if (conflict.resolvedValue !== null) {
        this.setNestedValue(this.consolidatedConfig, conflict.key, conflict.resolvedValue);
      }
    }

    // Add metadata
    this.consolidatedConfig._metadata = {
      consolidatedAt: new Date().toISOString(),
      sources: this.sources.map(s => ({ file: s.file, priority: s.priority })),
      conflictsResolved: this.conflicts.length
    };
  }

  /**
   * Deep merge two objects
   */
  private mergeDeep(target: any, source: any): any {
    for (const key in source) {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        if (!target[key]) target[key] = {};
        this.mergeDeep(target[key], source[key]);
      } else {
        target[key] = source[key];
      }
    }
    return target;
  }

  /**
   * Set value in nested object using dot notation
   */
  private setNestedValue(obj: any, path: string, value: any): void {
    const keys = path.split('.');
    let current = obj;

    for (let i = 0; i < keys.length - 1; i++) {
      if (!current[keys[i]]) {
        current[keys[i]] = {};
      }
      current = current[keys[i]];
    }

    current[keys[keys.length - 1]] = value;
  }

  /**
   * Save consolidated configuration
   */
  async saveConsolidatedConfig(outputPath: string = 'config/consolidated.json'): Promise<void> {
    const configJson = JSON.stringify(this.consolidatedConfig, null, 2);
    await fs.writeFile(outputPath, configJson);
    logger.info(`💾 Saved consolidated config to: ${outputPath}`);
  }

  /**
   * Generate configuration report
   */
  generateReport(): string {
    let report = `
🔧 CONFIGURATION CONSOLIDATION REPORT
====================================

SOURCES PROCESSED:
`;

    for (const source of this.sources) {
      report += `📄 ${source.file} (priority: ${source.priority}, type: ${source.type})\n`;
    }

    if (this.conflicts.length > 0) {
      report += `\n⚠️  CONFLICTS DETECTED (${this.conflicts.length}):\n`;
      report += '─'.repeat(50) + '\n';

      for (const conflict of this.conflicts) {
        const icon = conflict.resolution === 'manual_required' ? '🚨' : 
                    conflict.resolution === 'merge' ? '🔀' : '⬆️';
        report += `${icon} ${conflict.key}\n`;
        report += `   Resolution: ${conflict.resolution}\n`;
        
        for (const source of conflict.sources) {
          report += `   • ${source.file}: ${JSON.stringify(source.value)}\n`;
        }
        
        if (conflict.resolvedValue !== null) {
          report += `   ✅ Resolved: ${JSON.stringify(conflict.resolvedValue)}\n`;
        }
        report += '\n';
      }
    } else {
      report += '\n✅ No conflicts detected!\n';
    }

    // Configuration recommendations
    report += '\n📋 RECOMMENDATIONS:\n';
    report += '─'.repeat(50) + '\n';

    if (this.conflicts.some(c => c.resolution === 'manual_required')) {
      report += '🚨 Some conflicts require manual resolution\n';
    }

    if (this.sources.length > 5) {
      report += '📝 Consider consolidating configuration files to reduce complexity\n';
    }

    if (this.sources.some(s => s.file.includes('.env'))) {
      report += '🔐 Environment variables take highest priority - ensure they are secure\n';
    }

    return report;
  }

  /**
   * Validate consolidated configuration
   */
  validateConfiguration(): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check for required fields
    const requiredFields = [
      'model.endpoint',
      'model.name',
      'security.enableSandbox',
      'performance.responseCache.enabled'
    ];

    for (const field of requiredFields) {
      if (!this.getNestedValue(this.consolidatedConfig, field)) {
        errors.push(`Missing required field: ${field}`);
      }
    }

    // Check for security issues
    if (this.consolidatedConfig.security?.enableSandbox === false) {
      errors.push('Security sandbox should not be disabled');
    }

    // Check for performance issues
    if (this.consolidatedConfig.model?.timeout > 120000) {
      errors.push('Model timeout exceeds recommended 120 seconds');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Get value from nested object using dot notation
   */
  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }
}

// CLI usage
if (import.meta.url === `file://${process.argv[1]}`) {
  const consolidator = new ConfigurationConsolidator();
  
  consolidator.consolidateConfigurations()
    .then(result => {
      console.log(consolidator.generateReport());
      
      const validation = consolidator.validateConfiguration();
      if (!validation.isValid) {
        console.log('\n❌ Configuration validation failed:');
        for (const error of validation.errors) {
          console.log(`  • ${error}`);
        }
      } else {
        console.log('\n✅ Configuration validation passed!');
      }
      
      return consolidator.saveConsolidatedConfig();
    })
    .then(() => {
      console.log('\n🎉 Configuration consolidation completed successfully!');
    })
    .catch(error => {
      console.error('Configuration consolidation failed:', error);
      process.exit(1);
    });
}