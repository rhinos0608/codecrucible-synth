/**
 * Configuration Migrator
 *
 * Tool to migrate from legacy configuration files to the unified configuration system.
 * Provides analysis, transformation, and backup capabilities.
 */

import { readFile, writeFile, mkdir, copyFile } from 'fs/promises';
import { join, dirname } from 'path';
import { existsSync } from 'fs';
import YAML from 'yaml';
import { UnifiedConfiguration } from '../interfaces/configuration.js';
import { UnifiedConfigurationManager } from '../config/config-manager.js';
import { ILogger } from '../interfaces/logger.js';

export interface MigrationAnalysis {
  legacyFiles: LegacyFileInfo[];
  conflicts: ConfigurationConflict[];
  recommendations: MigrationRecommendation[];
  estimatedEffort: 'low' | 'medium' | 'high';
  compatibilityScore: number; // 0-100
}

export interface LegacyFileInfo {
  path: string;
  size: number;
  lastModified: Date;
  format: 'yaml' | 'json';
  sections: string[];
  issues: FileIssue[];
  canAutoMigrate: boolean;
}

export interface ConfigurationConflict {
  key: string;
  values: ConflictingValue[];
  severity: 'low' | 'medium' | 'high' | 'critical';
  resolution: 'auto' | 'manual' | 'prompt';
  suggestion: string;
}

export interface ConflictingValue {
  value: any;
  source: string;
  precedence: number;
}

export interface FileIssue {
  type: 'deprecation' | 'conflict' | 'invalid' | 'security';
  message: string;
  line?: number;
  suggestion?: string;
}

export interface MigrationRecommendation {
  type: 'consolidate' | 'deprecate' | 'update' | 'remove';
  target: string;
  reason: string;
  action: string;
  priority: 'low' | 'medium' | 'high';
}

export interface MigrationResult {
  success: boolean;
  unifiedConfig: UnifiedConfiguration;
  backupPaths: string[];
  migrationReport: MigrationReport;
  warnings: string[];
  errors: string[];
}

export interface MigrationReport {
  filesProcessed: number;
  conflictsResolved: number;
  manualInterventionsRequired: number;
  backupLocation: string;
  migrationTime: number; // milliseconds
  validationResults: any;
}

export class ConfigurationMigrator {
  private legacyFilePaths = [
    'config/default.yaml',
    'codecrucible.config.json',
    'config/unified-model-config.yaml',
    'config/hybrid.yaml',
    'config/hybrid-config.json',
    'config/optimized-model-config.json',
    'config/voices.yaml',
  ];

  constructor(
    private logger: ILogger,
    private projectRoot: string = process.cwd()
  ) {}

  /**
   * Analyze existing configuration files and identify migration requirements
   */
  async analyzeLegacyConfiguration(): Promise<MigrationAnalysis> {
    this.logger.info('Analyzing legacy configuration files...');

    const legacyFiles: LegacyFileInfo[] = [];
    const conflicts: ConfigurationConflict[] = [];
    const recommendations: MigrationRecommendation[] = [];

    // Analyze each legacy file
    for (const filePath of this.legacyFilePaths) {
      const fullPath = join(this.projectRoot, filePath);
      if (existsSync(fullPath)) {
        const fileInfo = await this.analyzeFile(fullPath);
        legacyFiles.push(fileInfo);
      }
    }

    // Detect conflicts between files
    const conflictMap = await this.detectCrossFileConflicts(legacyFiles);
    conflicts.push(...conflictMap);

    // Generate recommendations
    recommendations.push(...this.generateRecommendations(legacyFiles, conflicts));

    // Calculate metrics
    const estimatedEffort = this.calculateEffort(legacyFiles, conflicts);
    const compatibilityScore = this.calculateCompatibilityScore(legacyFiles, conflicts);

    const analysis: MigrationAnalysis = {
      legacyFiles,
      conflicts,
      recommendations,
      estimatedEffort,
      compatibilityScore,
    };

    this.logger.info(
      `Migration analysis complete: ${legacyFiles.length} files, ${conflicts.length} conflicts, ${compatibilityScore}% compatibility`
    );
    return analysis;
  }

  /**
   * Perform automatic migration of configuration files
   */
  async performMigration(analysis?: MigrationAnalysis): Promise<MigrationResult> {
    const startTime = Date.now();
    this.logger.info('Starting configuration migration...');

    const warnings: string[] = [];
    const errors: string[] = [];
    const backupPaths: string[] = [];

    try {
      // Get analysis if not provided
      const migrationAnalysis = analysis || (await this.analyzeLegacyConfiguration());

      // Create backup directory
      const backupDir = join(
        this.projectRoot,
        'config-backup',
        new Date().toISOString().slice(0, 19).replace(/:/g, '-')
      );
      await mkdir(backupDir, { recursive: true });

      // Backup existing files
      for (const fileInfo of migrationAnalysis.legacyFiles) {
        const backupPath = join(backupDir, fileInfo.path.replace(/\//g, '_'));
        await copyFile(join(this.projectRoot, fileInfo.path), backupPath);
        backupPaths.push(backupPath);
      }

      this.logger.info(`Created backups in ${backupDir}`);

      // Load and merge configurations using UnifiedConfigurationManager
      const configManager = new UnifiedConfigurationManager(this.logger);
      await configManager.initialize();
      const unifiedConfig = await configManager.loadConfiguration();

      // Validate the unified configuration
      const validation = configManager.validateConfiguration(unifiedConfig);

      if (!validation.isValid) {
        errors.push(...validation.errors.map(e => `${e.field}: ${e.message}`));
      }

      if (validation.warnings.length > 0) {
        warnings.push(...validation.warnings.map(w => `${w.field}: ${w.message}`));
      }

      // Generate migration report
      const migrationReport: MigrationReport = {
        filesProcessed: migrationAnalysis.legacyFiles.length,
        conflictsResolved: migrationAnalysis.conflicts.filter(c => c.resolution === 'auto').length,
        manualInterventionsRequired: migrationAnalysis.conflicts.filter(
          c => c.resolution === 'manual'
        ).length,
        backupLocation: backupDir,
        migrationTime: Date.now() - startTime,
        validationResults: validation,
      };

      // Save the unified configuration
      const unifiedConfigPath = join(this.projectRoot, 'config', 'unified.yaml');
      await this.saveUnifiedConfiguration(unifiedConfig, unifiedConfigPath);

      // Generate migration guide
      await this.generateMigrationGuide(migrationAnalysis, unifiedConfigPath, backupDir);

      this.logger.info(`Migration completed successfully in ${migrationReport.migrationTime}ms`);

      return {
        success: errors.length === 0,
        unifiedConfig,
        backupPaths,
        migrationReport,
        warnings,
        errors,
      };
    } catch (error) {
      this.logger.error('Migration failed:', error);
      errors.push(`Migration failed: ${error instanceof Error ? error.message : String(error)}`);

      return {
        success: false,
        unifiedConfig: {} as UnifiedConfiguration,
        backupPaths,
        migrationReport: {
          filesProcessed: 0,
          conflictsResolved: 0,
          manualInterventionsRequired: 0,
          backupLocation: '',
          migrationTime: Date.now() - startTime,
          validationResults: { isValid: false, errors: [], warnings: [] },
        },
        warnings,
        errors,
      };
    }
  }

  /**
   * Generate a migration guide document
   */
  async generateMigrationGuide(
    analysis: MigrationAnalysis,
    unifiedConfigPath: string,
    backupPath: string
  ): Promise<void> {
    const guide = `# Configuration Migration Guide

## Migration Summary

- **Files Processed**: ${analysis.legacyFiles.length}
- **Conflicts Detected**: ${analysis.conflicts.length}
- **Compatibility Score**: ${analysis.compatibilityScore}%
- **Estimated Effort**: ${analysis.estimatedEffort}

## Unified Configuration

The new unified configuration is located at: \`${unifiedConfigPath}\`

This single file replaces all previous configuration files with a hierarchical precedence system.

## Backup Location

Your original configuration files have been backed up to: \`${backupPath}\`

## Legacy Files Analyzed

${analysis.legacyFiles
  .map(
    file => `
### ${file.path}
- **Format**: ${file.format}
- **Size**: ${file.size} bytes
- **Auto-migrate**: ${file.canAutoMigrate ? '✅' : '❌'}
- **Issues**: ${file.issues.length}
${file.issues.map(issue => `  - ${issue.type}: ${issue.message}`).join('\n')}
`
  )
  .join('\n')}

## Conflicts Resolved

${analysis.conflicts
  .map(
    conflict => `
### ${conflict.key}
- **Severity**: ${conflict.severity}
- **Resolution**: ${conflict.resolution}
- **Values**:
${conflict.values.map(v => `  - ${v.source}: ${JSON.stringify(v.value)}`).join('\n')}
- **Suggestion**: ${conflict.suggestion}
`
  )
  .join('\n')}

## Next Steps

${analysis.recommendations
  .map(
    (rec, i) => `
${i + 1}. **${rec.type.toUpperCase()}**: ${rec.target}
   - **Reason**: ${rec.reason}
   - **Action**: ${rec.action}
   - **Priority**: ${rec.priority}
`
  )
  .join('\n')}

## Configuration Precedence

The new system uses the following precedence order (highest to lowest):

1. **CLI Arguments** (--config-option=value)
2. **Environment Variables** (CC_*)
3. **Local Overrides** (config/local.yaml)
4. **Environment Specific** (config/development.yaml)
5. **Legacy Files** (with conflict detection)
6. **Specialized Configs** (config/voices.yaml)
7. **Project Defaults** (config/default.yaml)
8. **Global User Config** (~/.codecrucible/config.yaml)
9. **System Defaults** (built-in)

## Validation

Run the following command to validate your configuration:

\`\`\`bash
npm run config:validate
\`\`\`

## Troubleshooting

If you encounter issues:

1. Check the validation results in the migration report
2. Review conflicts and apply manual resolutions
3. Restore from backup if needed: \`cp ${backupPath}/* config/\`
4. Contact support with the migration report

## Learn More

- [Configuration Documentation](./Docs/configuration.md)
- [Unified Schema Reference](./context/configuration/unified-schema.md)
- [Troubleshooting Guide](./Docs/troubleshooting.md)
`;

    const guidePath = join(this.projectRoot, 'MIGRATION_GUIDE.md');
    await writeFile(guidePath, guide, 'utf-8');
    this.logger.info(`Migration guide created: ${guidePath}`);
  }

  private async analyzeFile(filePath: string): Promise<LegacyFileInfo> {
    const content = await readFile(filePath, 'utf-8');
    const stats = await import('fs').then(async fs => fs.promises.stat(filePath));

    const format = filePath.endsWith('.json') ? 'json' : 'yaml';
    const issues: FileIssue[] = [];
    const sections: string[] = [];

    try {
      const parsed = format === 'json' ? JSON.parse(content) : YAML.parse(content);
      sections.push(...Object.keys(parsed || {}));

      // Check for deprecated configurations
      if (parsed.agent?.mode === 'fast') {
        issues.push({
          type: 'deprecation',
          message: 'Fast mode is deprecated, use executionMode: "fast"',
          suggestion: 'Update to use model.executionMode: "fast"',
        });
      }

      // Check for security issues
      if (parsed.security?.allowUnsafeCommands) {
        issues.push({
          type: 'security',
          message: 'Unsafe commands are allowed',
          suggestion: 'Review security.allowedCommands and security.blockedCommands',
        });
      }

      // Check for conflicts
      if (parsed.model?.timeout && parsed.performance?.defaultTimeout) {
        issues.push({
          type: 'conflict',
          message: 'Multiple timeout configurations found',
          suggestion: 'Consolidate timeout settings',
        });
      }
    } catch (error) {
      issues.push({
        type: 'invalid',
        message: `Failed to parse file: ${error instanceof Error ? error.message : String(error)}`,
        suggestion: 'Fix syntax errors before migration',
      });
    }

    const canAutoMigrate = issues.filter(i => i.type === 'invalid').length === 0;

    return {
      path: filePath.replace(`${this.projectRoot}/`, ''),
      size: stats.size,
      lastModified: stats.mtime,
      format,
      sections,
      issues,
      canAutoMigrate,
    };
  }

  private async detectCrossFileConflicts(
    files: LegacyFileInfo[]
  ): Promise<ConfigurationConflict[]> {
    const conflicts: ConfigurationConflict[] = [];
    const configValues = new Map<string, ConflictingValue[]>();

    // Load and parse all files to extract values
    for (const file of files) {
      if (!file.canAutoMigrate) continue;

      try {
        const filePath = join(this.projectRoot, file.path);
        const content = await readFile(filePath, 'utf-8');
        const parsed = file.format === 'json' ? JSON.parse(content) : YAML.parse(content);

        this.extractConfigValues(parsed, file.path, configValues);
      } catch (error) {
        this.logger.warn(`Failed to parse ${file.path} for conflict detection:`, error);
      }
    }

    // Identify conflicts
    for (const [key, values] of configValues.entries()) {
      if (values.length > 1) {
        const uniqueValues = new Set(values.map(v => JSON.stringify(v.value)));
        if (uniqueValues.size > 1) {
          conflicts.push({
            key,
            values,
            severity: this.assessConflictSeverity(key, values),
            resolution: this.determineResolutionStrategy(key, values),
            suggestion: this.generateConflictSuggestion(key, values),
          });
        }
      }
    }

    return conflicts;
  }

  private extractConfigValues(
    obj: any,
    source: string,
    configValues: Map<string, ConflictingValue[]>,
    prefix = ''
  ): void {
    for (const [key, value] of Object.entries(obj)) {
      const fullKey = prefix ? `${prefix}.${key}` : key;

      if (value && typeof value === 'object' && !Array.isArray(value)) {
        this.extractConfigValues(value, source, configValues, fullKey);
      } else {
        if (!configValues.has(fullKey)) {
          configValues.set(fullKey, []);
        }
        configValues.get(fullKey)!.push({
          value,
          source,
          precedence: this.getFilePrecedence(source),
        });
      }
    }
  }

  private getFilePrecedence(source: string): number {
    const precedenceMap: Record<string, number> = {
      'config/default.yaml': 20,
      'config/voices.yaml': 25,
      'config/unified-model-config.yaml': 25,
      'codecrucible.config.json': 15, // Lower precedence (legacy)
      'config/hybrid.yaml': 15,
      'config/hybrid-config.json': 15,
      'config/optimized-model-config.json': 15,
    };
    return precedenceMap[source] || 10;
  }

  private assessConflictSeverity(
    key: string,
    values: ConflictingValue[]
  ): 'low' | 'medium' | 'high' | 'critical' {
    // Critical conflicts that could break the system
    if (key.includes('endpoint') || key.includes('timeout') || key.includes('security')) {
      return 'critical';
    }

    // High conflicts that affect core functionality
    if (key.includes('model') || key.includes('provider') || key.includes('performance')) {
      return 'high';
    }

    // Medium conflicts that affect features
    if (key.includes('voice') || key.includes('tool') || key.includes('cache')) {
      return 'medium';
    }

    return 'low';
  }

  private determineResolutionStrategy(
    key: string,
    values: ConflictingValue[]
  ): 'auto' | 'manual' | 'prompt' {
    // Auto-resolve if there's a clear precedence winner
    const maxPrecedence = Math.max(...values.map(v => v.precedence));
    const highestPrecedenceValues = values.filter(v => v.precedence === maxPrecedence);

    if (highestPrecedenceValues.length === 1) {
      return 'auto';
    }

    // Require manual intervention for critical conflicts
    if (this.assessConflictSeverity(key, values) === 'critical') {
      return 'manual';
    }

    return 'prompt';
  }

  private generateConflictSuggestion(key: string, values: ConflictingValue[]): string {
    const maxPrecedence = Math.max(...values.map(v => v.precedence));
    const winner = values.find(v => v.precedence === maxPrecedence);

    return `Use value ${JSON.stringify(winner?.value)} from ${winner?.source} (highest precedence)`;
  }

  private generateRecommendations(
    files: LegacyFileInfo[],
    conflicts: ConfigurationConflict[]
  ): MigrationRecommendation[] {
    const recommendations: MigrationRecommendation[] = [];

    // Recommend consolidation
    if (files.length > 3) {
      recommendations.push({
        type: 'consolidate',
        target: 'configuration files',
        reason: `${files.length} configuration files create complexity`,
        action: 'Migrate to unified configuration system',
        priority: 'high',
      });
    }

    // Recommend deprecation of legacy files
    const legacyFiles = files.filter(
      f => f.path.includes('codecrucible.config.json') || f.path.includes('hybrid')
    );
    for (const file of legacyFiles) {
      recommendations.push({
        type: 'deprecate',
        target: file.path,
        reason: 'Legacy configuration format',
        action: 'Migrate settings to unified configuration and remove file',
        priority: 'medium',
      });
    }

    // Recommend fixes for critical conflicts
    const criticalConflicts = conflicts.filter(c => c.severity === 'critical');
    for (const conflict of criticalConflicts) {
      recommendations.push({
        type: 'update',
        target: conflict.key,
        reason: `Critical conflict: ${conflict.values.length} different values`,
        action: conflict.suggestion,
        priority: 'high',
      });
    }

    return recommendations;
  }

  private calculateEffort(
    files: LegacyFileInfo[],
    conflicts: ConfigurationConflict[]
  ): 'low' | 'medium' | 'high' {
    let score = 0;

    // File complexity
    score += files.length;
    score += files.filter(f => !f.canAutoMigrate).length * 2;
    score += files.reduce((sum, f) => sum + f.issues.length, 0);

    // Conflict complexity
    score += conflicts.length;
    score += conflicts.filter(c => c.severity === 'critical').length * 3;
    score += conflicts.filter(c => c.resolution === 'manual').length * 2;

    if (score <= 5) return 'low';
    if (score <= 15) return 'medium';
    return 'high';
  }

  private calculateCompatibilityScore(
    files: LegacyFileInfo[],
    conflicts: ConfigurationConflict[]
  ): number {
    let totalItems = 0;
    let compatibleItems = 0;

    // File compatibility
    totalItems += files.length;
    compatibleItems += files.filter(f => f.canAutoMigrate).length;

    // Issue compatibility
    const totalIssues = files.reduce((sum, f) => sum + f.issues.length, 0);
    const criticalIssues = files.reduce(
      (sum, f) => sum + f.issues.filter(i => i.type === 'invalid').length,
      0
    );
    totalItems += totalIssues;
    compatibleItems += totalIssues - criticalIssues;

    // Conflict compatibility
    totalItems += conflicts.length;
    compatibleItems += conflicts.filter(c => c.resolution === 'auto').length;

    if (totalItems === 0) return 100;
    return Math.round((compatibleItems / totalItems) * 100);
  }

  private async saveUnifiedConfiguration(
    config: UnifiedConfiguration,
    path: string
  ): Promise<void> {
    await mkdir(dirname(path), { recursive: true });

    const yamlContent = YAML.stringify(config, {
      indent: 2,
      lineWidth: 120,
    });

    const header = `# Unified Configuration - Generated by Migration Tool
# Generated: ${new Date().toISOString()}
# 
# This file replaces all legacy configuration files with a single, coherent structure.
# Precedence: CLI args > env vars > local.yaml > environment.yaml > this file > defaults
# 
# For more information: ./context/configuration/unified-schema.md

`;

    await writeFile(path, header + yamlContent, 'utf-8');
    this.logger.info(`Unified configuration saved to ${path}`);
  }
}
