/**
 * Configuration CLI Commands
 * 
 * Command-line interface for configuration management and migration.
 */

import { UnifiedConfigurationManager } from '../../domain/services/unified-configuration-manager.js';
import { ConfigurationMigrator } from '../../domain/services/configuration-migrator.js';
import { createLogger } from '../../infrastructure/logging/logger-adapter.js';
import { join } from 'path';

export interface ConfigCommandOptions {
  verbose?: boolean;
  dryRun?: boolean;
  backup?: boolean;
  format?: 'json' | 'yaml' | 'table';
}

export class ConfigCommands {
  private logger = createLogger('ConfigCommands');
  private configManager: UnifiedConfigurationManager;
  private migrator: ConfigurationMigrator;

  constructor(private projectRoot: string = process.cwd()) {
    this.configManager = new UnifiedConfigurationManager(this.logger);
    this.migrator = new ConfigurationMigrator(this.logger, this.projectRoot);
  }

  /**
   * Display current configuration status and sources
   */
  async status(options: ConfigCommandOptions = {}): Promise<void> {
    try {
      if (options.verbose) {
        this.logger.info('Configuration status check...');
      }

      await this.configManager.initialize();
      const config = this.configManager.getConfiguration();
      const validation = this.configManager.validateConfiguration(config);

      console.log('\n📊 Configuration Status\n');
      console.log(`✅ Status: ${validation.isValid ? 'Valid' : 'Invalid'}`);
      console.log(`🎯 Environment: ${config.application.environment}`);
      console.log(`📝 Log Level: ${config.application.logLevel}`);
      console.log(`🤖 Default Provider: ${config.model.defaultProvider}`);
      console.log(`🔒 Security Level: ${config.security.securityLevel}`);
      console.log(`⚡ Max Concurrent: ${config.performance.maxConcurrentRequests}`);
      console.log(`🎭 Default Voices: ${config.voice.defaultVoices.join(', ')}`);

      if (validation.warnings.length > 0) {
        console.log(`\n⚠️  Warnings: ${validation.warnings.length}`);
        if (options.verbose) {
          validation.warnings.forEach(warning => {
            console.log(`   - ${warning.field}: ${warning.message}`);
          });
        }
      }

      if (!validation.isValid) {
        console.log(`\n❌ Errors: ${validation.errors.length}`);
        validation.errors.forEach(error => {
          console.log(`   - ${error.field}: ${error.message}`);
        });
      }

      if (options.verbose) {
        console.log('\n📋 Configuration Sources:');
        // Access private configSources through any type for debugging
        const sources = (this.configManager as any).configSources;
        for (const [key, info] of sources.entries()) {
          console.log(`   ${key}: ${info.source} (precedence: ${info.priority})`);
        }
      }

    } catch (error) {
      console.error('❌ Failed to load configuration:', error.message);
      process.exit(1);
    }
  }

  /**
   * Validate configuration and show detailed results
   */
  async validate(options: ConfigCommandOptions = {}): Promise<void> {
    try {
      console.log('🔍 Validating configuration...\n');

      await this.configManager.initialize();
      const config = this.configManager.getConfiguration();
      const validation = this.configManager.validateConfiguration(config);

      if (validation.isValid) {
        console.log('✅ Configuration is valid!');
      } else {
        console.log('❌ Configuration validation failed!');
      }

      if (validation.errors.length > 0) {
        console.log('\n🚨 Errors:');
        validation.errors.forEach((error, i) => {
          console.log(`  ${i + 1}. ${error.field}: ${error.message}`);
        });
      }

      if (validation.warnings.length > 0) {
        console.log('\n⚠️  Warnings:');
        validation.warnings.forEach((warning, i) => {
          console.log(`  ${i + 1}. ${warning.field}: ${warning.message}`);
          if (warning.suggestion) {
            console.log(`     Suggestion: ${warning.suggestion}`);
          }
        });
      }

      console.log(`\n📊 Summary: ${validation.errors.length} errors, ${validation.warnings.length} warnings`);

      if (!validation.isValid) {
        process.exit(1);
      }

    } catch (error) {
      console.error('❌ Validation failed:', error.message);
      process.exit(1);
    }
  }

  /**
   * Analyze legacy configuration files
   */
  async analyze(options: ConfigCommandOptions = {}): Promise<void> {
    try {
      console.log('🔍 Analyzing legacy configuration files...\n');

      const analysis = await this.migrator.analyzeLegacyConfiguration();

      console.log('📋 Legacy Files Found:');
      if (analysis.legacyFiles.length === 0) {
        console.log('   No legacy configuration files detected.');
      } else {
        analysis.legacyFiles.forEach(file => {
          const status = file.canAutoMigrate ? '✅' : '❌';
          console.log(`   ${status} ${file.path} (${file.format}, ${file.issues.length} issues)`);
          
          if (options.verbose && file.issues.length > 0) {
            file.issues.forEach(issue => {
              console.log(`      - ${issue.type}: ${issue.message}`);
            });
          }
        });
      }

      if (analysis.conflicts.length > 0) {
        console.log(`\n⚠️  Conflicts Detected: ${analysis.conflicts.length}`);
        analysis.conflicts.forEach(conflict => {
          const severityIcon = {
            low: '🟡',
            medium: '🟠', 
            high: '🔴',
            critical: '🚨'
          }[conflict.severity];
          
          console.log(`   ${severityIcon} ${conflict.key} (${conflict.severity})`);
          console.log(`      ${conflict.suggestion}`);
          
          if (options.verbose) {
            conflict.values.forEach(value => {
              console.log(`      - ${value.source}: ${JSON.stringify(value.value)}`);
            });
          }
        });
      }

      console.log(`\n📊 Analysis Summary:`);
      console.log(`   Compatibility Score: ${analysis.compatibilityScore}%`);
      console.log(`   Estimated Effort: ${analysis.estimatedEffort}`);
      console.log(`   Files: ${analysis.legacyFiles.length}, Conflicts: ${analysis.conflicts.length}`);

      if (analysis.recommendations.length > 0) {
        console.log(`\n💡 Recommendations:`);
        analysis.recommendations.forEach((rec, i) => {
          const priorityIcon = {
            low: '🟢',
            medium: '🟡',
            high: '🔴'
          }[rec.priority];
          
          console.log(`   ${i + 1}. ${priorityIcon} ${rec.type.toUpperCase()}: ${rec.target}`);
          console.log(`      Reason: ${rec.reason}`);
          console.log(`      Action: ${rec.action}`);
        });
      }

    } catch (error) {
      console.error('❌ Analysis failed:', error.message);
      process.exit(1);
    }
  }

  /**
   * Migrate legacy configuration files to unified system
   */
  async migrate(options: ConfigCommandOptions = {}): Promise<void> {
    try {
      if (options.dryRun) {
        console.log('🔍 Dry run mode - no files will be modified\n');
      } else {
        console.log('🚀 Starting configuration migration...\n');
      }

      // Analyze first
      const analysis = await this.migrator.analyzeLegacyConfiguration();
      
      if (analysis.legacyFiles.length === 0) {
        console.log('✅ No legacy configuration files found - nothing to migrate.');
        return;
      }

      console.log(`📋 Found ${analysis.legacyFiles.length} legacy files with ${analysis.conflicts.length} conflicts`);

      if (options.dryRun) {
        console.log('\n🔍 Dry run results:');
        console.log(`   - Would process ${analysis.legacyFiles.length} files`);
        console.log(`   - Would resolve ${analysis.conflicts.filter(c => c.resolution === 'auto').length} conflicts automatically`);
        console.log(`   - Would require ${analysis.conflicts.filter(c => c.resolution === 'manual').length} manual interventions`);
        console.log(`   - Estimated effort: ${analysis.estimatedEffort}`);
        return;
      }

      // Perform actual migration
      const result = await this.migrator.performMigration(analysis);

      if (result.success) {
        console.log('✅ Migration completed successfully!\n');
        
        console.log('📊 Migration Results:');
        console.log(`   Files Processed: ${result.migrationReport.filesProcessed}`);
        console.log(`   Conflicts Resolved: ${result.migrationReport.conflictsResolved}`);
        console.log(`   Manual Interventions: ${result.migrationReport.manualInterventionsRequired}`);
        console.log(`   Migration Time: ${result.migrationReport.migrationTime}ms`);
        console.log(`   Backup Location: ${result.migrationReport.backupLocation}`);

        if (result.warnings.length > 0) {
          console.log(`\n⚠️  Warnings: ${result.warnings.length}`);
          if (options.verbose) {
            result.warnings.forEach(warning => console.log(`   - ${warning}`));
          }
        }

        console.log('\n📝 Next Steps:');
        console.log('   1. Review the generated unified configuration');
        console.log('   2. Run: npm run config:validate');
        console.log('   3. Test your application with the new configuration');
        console.log('   4. Remove legacy files when satisfied');
        console.log('\n📖 See MIGRATION_GUIDE.md for detailed information');

      } else {
        console.log('❌ Migration failed!\n');
        
        if (result.errors.length > 0) {
          console.log('🚨 Errors:');
          result.errors.forEach(error => console.log(`   - ${error}`));
        }

        console.log(`\n📋 Files have been backed up to: ${result.migrationReport.backupLocation}`);
        process.exit(1);
      }

    } catch (error) {
      console.error('❌ Migration failed:', error.message);
      process.exit(1);
    }
  }

  /**
   * Export current configuration in specified format
   */
  async export(filePath: string, options: ConfigCommandOptions = {}): Promise<void> {
    try {
      await this.configManager.initialize();
      const config = this.configManager.getConfiguration();
      const format = options.format || 'yaml';

      let content: string;
      if (format === 'json') {
        content = JSON.stringify(config, null, 2);
      } else {
        const YAML = await import('yaml');
        content = YAML.stringify(config, { indent: 2 });
      }

      const fs = await import('fs/promises');
      await fs.writeFile(filePath, content, 'utf-8');

      console.log(`✅ Configuration exported to ${filePath} (${format})`);

    } catch (error) {
      console.error('❌ Export failed:', error.message);
      process.exit(1);
    }
  }

  /**
   * Show configuration help
   */
  help(): void {
    console.log(`
📖 Configuration Management Commands

Usage: npm run config:<command> [options]

Commands:
  status     Show configuration status and sources
  validate   Validate current configuration
  analyze    Analyze legacy configuration files
  migrate    Migrate to unified configuration system
  export     Export configuration to file

Options:
  --verbose    Show detailed output
  --dry-run    Show what would be done without making changes
  --backup     Create backup before migration
  --format     Output format (json|yaml|table)

Examples:
  npm run config:status --verbose
  npm run config:analyze
  npm run config:migrate --dry-run
  npm run config:validate
  npm run config:export ./config/backup.yaml

Configuration Precedence (highest to lowest):
  1. CLI Arguments (--option=value)
  2. Environment Variables (CC_*)
  3. Local Overrides (config/local.yaml)
  4. Environment Specific (config/development.yaml)
  5. Legacy Files (with conflict detection)
  6. Specialized Configs (config/voices.yaml)
  7. Project Defaults (config/default.yaml)
  8. Global User Config (~/.codecrucible/config.yaml)
  9. System Defaults (built-in)

For more information:
  - Unified Schema: ./context/configuration/unified-schema.md
  - Conflict Analysis: ./context/configuration/conflict-analysis.md
  - Migration Guide: ./MIGRATION_GUIDE.md (after migration)
`);
  }
}