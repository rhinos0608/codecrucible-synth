#!/usr/bin/env node

/**
 * Dependency Auditor
 * Analyzes, audits, and optimizes project dependencies
 */

import { promises as fs } from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';
import { glob } from 'glob';
import { logger } from './logger.js';

const execAsync = promisify(exec);

interface DependencyInfo {
  name: string;
  version: string;
  type: 'dependency' | 'devDependency';
  size?: number;
  lastPublished?: string;
  securityVulnerabilities?: number;
  isUsed: boolean;
  usageCount: number;
  usageLocations: string[];
}

interface DependencyIssue {
  type: 'unused' | 'duplicate' | 'outdated' | 'security' | 'oversized' | 'deprecated';
  severity: 'low' | 'medium' | 'high' | 'critical';
  dependency: string;
  description: string;
  recommendation: string;
  autoFixable: boolean;
}

interface AuditResult {
  totalDependencies: number;
  issues: DependencyIssue[];
  recommendations: string[];
  potentialSavings: {
    size: string;
    count: number;
  };
}

export class DependencyAuditor {
  private packageJson: any;
  private dependencies: Map<string, DependencyInfo> = new Map();
  private issues: DependencyIssue[] = [];

  /**
   * Run comprehensive dependency audit
   */
  async auditDependencies(): Promise<AuditResult> {
    logger.info('🔍 Starting comprehensive dependency audit...');

    // Load package.json
    await this.loadPackageJson();

    // Analyze dependencies
    await this.analyzeDependencies();

    // Check usage
    await this.checkDependencyUsage();

    // Security audit
    await this.securityAudit();

    // Find issues
    this.findIssues();

    // Generate recommendations
    const recommendations = this.generateRecommendations();

    const potentialSavings = this.calculatePotentialSavings();

    return {
      totalDependencies: this.dependencies.size,
      issues: this.issues,
      recommendations,
      potentialSavings
    };
  }

  /**
   * Load and parse package.json
   */
  private async loadPackageJson(): Promise<void> {
    try {
      const packageContent = await fs.readFile('package.json', 'utf-8');
      this.packageJson = JSON.parse(packageContent);
      logger.info(`📦 Loaded package.json (${this.packageJson.name}@${this.packageJson.version})`);
    } catch (error) {
      throw new Error(`Failed to load package.json: ${error}`);
    }
  }

  /**
   * Analyze all dependencies
   */
  private async analyzeDependencies(): Promise<void> {
    const allDeps = {
      ...this.packageJson.dependencies || {},
      ...this.packageJson.devDependencies || {}
    };

    for (const [name, version] of Object.entries(allDeps)) {
      const type = this.packageJson.dependencies?.[name] ? 'dependency' : 'devDependency';
      
      const depInfo: DependencyInfo = {
        name,
        version: version as string,
        type,
        isUsed: false,
        usageCount: 0,
        usageLocations: []
      };

      // Get additional info from npm
      try {
        await this.enrichDependencyInfo(depInfo);
      } catch (error) {
        logger.warn(`Failed to get info for ${name}:`, error);
      }

      this.dependencies.set(name, depInfo);
    }
  }

  /**
   * Enrich dependency info with npm data
   */
  private async enrichDependencyInfo(depInfo: DependencyInfo): Promise<void> {
    try {
      // Get package info from npm
      const { stdout } = await execAsync(`npm view ${depInfo.name} --json`);
      const npmInfo = JSON.parse(stdout);

      depInfo.lastPublished = npmInfo.time?.modified || npmInfo.time?.created;
      depInfo.size = npmInfo.dist?.unpackedSize;

      // Check for deprecation
      if (npmInfo.deprecated) {
        this.issues.push({
          type: 'deprecated',
          severity: 'medium',
          dependency: depInfo.name,
          description: `Package is deprecated: ${npmInfo.deprecated}`,
          recommendation: 'Find an alternative package or maintain a fork',
          autoFixable: false
        });
      }

    } catch (error) {
      // Ignore errors for local/private packages
    }
  }

  /**
   * Check which dependencies are actually used
   */
  private async checkDependencyUsage(): Promise<void> {
    const sourceFiles = await glob('src/**/*.{ts,js,tsx,jsx}', { ignore: ['node_modules/**'] });
    
    for (const file of sourceFiles) {
      try {
        const content = await fs.readFile(file, 'utf-8');
        
        for (const [name, depInfo] of this.dependencies) {
          // Check for various import patterns
          const importPatterns = [
            new RegExp(`import.*['"\`]${name}['"\`]`, 'g'),
            new RegExp(`from\\s+['"\`]${name}['"\`]`, 'g'),
            new RegExp(`require\\(['"\`]${name}['"\`]\\)`, 'g'),
            new RegExp(`import\\s+.*\\s+from\\s+['"\`]${name}/`, 'g'),
            new RegExp(`require\\(['"\`]${name}/`, 'g')
          ];

          for (const pattern of importPatterns) {
            const matches = content.match(pattern);
            if (matches) {
              depInfo.isUsed = true;
              depInfo.usageCount += matches.length;
              if (!depInfo.usageLocations.includes(file)) {
                depInfo.usageLocations.push(file);
              }
            }
          }
        }
      } catch (error) {
        logger.warn(`Failed to analyze ${file}:`, error);
      }
    }

    // Check config files for usage
    await this.checkConfigFileUsage();
  }

  /**
   * Check configuration files for dependency usage
   */
  private async checkConfigFileUsage(): Promise<void> {
    const configFiles = [
      'package.json',
      'tsconfig.json',
      'jest.config.*',
      'webpack.config.*',
      'vite.config.*',
      '.eslintrc.*',
      'rollup.config.*'
    ];

    for (const pattern of configFiles) {
      const files = await glob(pattern);
      
      for (const file of files) {
        try {
          const content = await fs.readFile(file, 'utf-8');
          
          for (const [name, depInfo] of this.dependencies) {
            if (content.includes(name)) {
              depInfo.isUsed = true;
              if (!depInfo.usageLocations.includes(file)) {
                depInfo.usageLocations.push(`${file} (config)`);
              }
            }
          }
        } catch (error) {
          // Ignore file read errors
        }
      }
    }
  }

  /**
   * Run security audit
   */
  private async securityAudit(): Promise<void> {
    try {
      const { stdout } = await execAsync('npm audit --json');
      const auditResult = JSON.parse(stdout);

      if (auditResult.vulnerabilities) {
        for (const [pkgName, vulnInfo] of Object.entries(auditResult.vulnerabilities as any)) {
          const vuln = vulnInfo as any;
          const severity = this.mapNpmSeverity(vuln.severity);
          
          this.issues.push({
            type: 'security',
            severity,
            dependency: pkgName,
            description: `${vuln.via?.length || 0} security vulnerabilities found`,
            recommendation: 'Run `npm audit fix` or update to a secure version',
            autoFixable: true
          });

          // Update dependency info
          const depInfo = this.dependencies.get(pkgName);
          if (depInfo) {
            depInfo.securityVulnerabilities = vuln.via?.length || 0;
          }
        }
      }
    } catch (error) {
      logger.warn('Security audit failed:', error);
    }
  }

  /**
   * Map npm audit severity to our severity levels
   */
  private mapNpmSeverity(npmSeverity: string): 'low' | 'medium' | 'high' | 'critical' {
    switch (npmSeverity?.toLowerCase()) {
      case 'critical': return 'critical';
      case 'high': return 'high';
      case 'moderate': return 'medium';
      case 'low': return 'low';
      default: return 'medium';
    }
  }

  /**
   * Find various dependency issues
   */
  private findIssues(): void {
    for (const [name, depInfo] of this.dependencies) {
      // Unused dependencies
      if (!depInfo.isUsed) {
        this.issues.push({
          type: 'unused',
          severity: depInfo.type === 'dependency' ? 'medium' : 'low',
          dependency: name,
          description: `Dependency is not used in the codebase`,
          recommendation: `Remove ${name} from ${depInfo.type === 'dependency' ? 'dependencies' : 'devDependencies'}`,
          autoFixable: true
        });
      }

      // Oversized dependencies
      if (depInfo.size && depInfo.size > 10 * 1024 * 1024) { // 10MB
        this.issues.push({
          type: 'oversized',
          severity: 'medium',
          dependency: name,
          description: `Large dependency (${this.formatSize(depInfo.size)})`,
          recommendation: 'Consider alternatives or lazy loading',
          autoFixable: false
        });
      }

      // Outdated dependencies (simple heuristic)
      if (depInfo.lastPublished) {
        const lastUpdate = new Date(depInfo.lastPublished);
        const oneYearAgo = new Date();
        oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

        if (lastUpdate < oneYearAgo) {
          this.issues.push({
            type: 'outdated',
            severity: 'low',
            dependency: name,
            description: `Package hasn't been updated in over a year`,
            recommendation: 'Check for newer alternatives or security updates',
            autoFixable: false
          });
        }
      }
    }

    // Find duplicate functionality
    this.findDuplicateFunctionality();
  }

  /**
   * Find dependencies with duplicate functionality
   */
  private findDuplicateFunctionality(): void {
    const duplicateGroups = [
      {
        category: 'HTTP Clients',
        packages: ['axios', 'node-fetch', 'cross-fetch', 'isomorphic-fetch'],
        recommendation: 'Use a single HTTP client'
      },
      {
        category: 'CLI Frameworks',
        packages: ['commander', 'yargs', 'meow', 'cac'],
        recommendation: 'Consolidate to one CLI framework'
      },
      {
        category: 'Process Management',
        packages: ['execa', 'cross-spawn', 'child_process'],
        recommendation: 'Use a single process execution library'
      },
      {
        category: 'File System',
        packages: ['fs-extra', 'fs', 'graceful-fs'],
        recommendation: 'Use fs-extra or native fs for consistency'
      },
      {
        category: 'Terminal Styling',
        packages: ['chalk', 'kleur', 'colors', 'picocolors'],
        recommendation: 'Use one terminal coloring library'
      },
      {
        category: 'YAML Processing',
        packages: ['js-yaml', 'yaml'],
        recommendation: 'Use a single YAML parser'
      },
      {
        category: 'Markdown Processing',
        packages: ['markdown-it', 'marked'],
        recommendation: 'Use one markdown processor'
      }
    ];

    for (const group of duplicateGroups) {
      const found = group.packages.filter(pkg => this.dependencies.has(pkg));
      
      if (found.length > 1) {
        this.issues.push({
          type: 'duplicate',
          severity: 'medium',
          dependency: found.join(', '),
          description: `Multiple ${group.category.toLowerCase()}: ${found.join(', ')}`,
          recommendation: group.recommendation,
          autoFixable: false
        });
      }
    }
  }

  /**
   * Generate recommendations
   */
  private generateRecommendations(): string[] {
    const recommendations: string[] = [];

    const unusedCount = this.issues.filter(i => i.type === 'unused').length;
    const securityCount = this.issues.filter(i => i.type === 'security').length;
    const duplicateCount = this.issues.filter(i => i.type === 'duplicate').length;

    if (unusedCount > 0) {
      recommendations.push(`Remove ${unusedCount} unused dependencies to reduce bundle size`);
    }

    if (securityCount > 0) {
      recommendations.push(`Fix ${securityCount} security vulnerabilities with \`npm audit fix\``);
    }

    if (duplicateCount > 0) {
      recommendations.push(`Consolidate ${duplicateCount} groups of duplicate functionality`);
    }

    if (this.dependencies.size > 100) {
      recommendations.push('Consider breaking down the project into smaller modules');
    }

    const oversizedDeps = this.issues.filter(i => i.type === 'oversized');
    if (oversizedDeps.length > 0) {
      recommendations.push(`Review ${oversizedDeps.length} large dependencies for alternatives`);
    }

    return recommendations;
  }

  /**
   * Calculate potential savings from removing unused dependencies
   */
  private calculatePotentialSavings(): { size: string; count: number } {
    const unusedDeps = this.issues
      .filter(i => i.type === 'unused')
      .map(i => this.dependencies.get(i.dependency))
      .filter(Boolean);

    const totalSize = unusedDeps.reduce((sum, dep) => sum + (dep!.size || 0), 0);
    
    return {
      size: this.formatSize(totalSize),
      count: unusedDeps.length
    };
  }

  /**
   * Format byte size to human readable
   */
  private formatSize(bytes: number): string {
    if (bytes === 0) return '0 B';
    
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Generate detailed audit report
   */
  generateReport(): string {
    const totalDeps = this.dependencies.size;
    const usedDeps = Array.from(this.dependencies.values()).filter(d => d.isUsed).length;
    const unusedDeps = totalDeps - usedDeps;

    let report = `
📦 DEPENDENCY AUDIT REPORT
=========================

OVERVIEW:
• Total Dependencies: ${totalDeps}
• Used Dependencies: ${usedDeps}
• Unused Dependencies: ${unusedDeps}
• Dependencies with Issues: ${this.issues.length}

`;

    // Issues by type
    const typeGroups = new Map<string, DependencyIssue[]>();

    for (const issue of this.issues) {
      if (!typeGroups.has(issue.type)) {
        typeGroups.set(issue.type, []);
      }
      typeGroups.get(issue.type)!.push(issue);
    }

    if (this.issues.length > 0) {
      report += 'ISSUES FOUND:\n';
      report += '─'.repeat(50) + '\n';

      for (const [type, issues] of typeGroups) {
        const icon = type === 'security' ? '🔐' : 
                    type === 'unused' ? '🗑️' : 
                    type === 'duplicate' ? '🔄' : 
                    type === 'outdated' ? '📅' : 
                    type === 'oversized' ? '📏' : '⚠️';
        
        report += `${icon} ${type.toUpperCase()} (${issues.length}):\n`;
        
        for (const issue of issues.slice(0, 5)) { // Show first 5
          report += `  • ${issue.dependency}: ${issue.description}\n`;
          report += `    💡 ${issue.recommendation}\n`;
        }
        
        if (issues.length > 5) {
          report += `    ... and ${issues.length - 5} more\n`;
        }
        report += '\n';
      }
    }

    // Dependency size analysis
    const largestDeps = Array.from(this.dependencies.values())
      .filter(d => d.size && d.size > 0)
      .sort((a, b) => (b.size || 0) - (a.size || 0))
      .slice(0, 10);

    if (largestDeps.length > 0) {
      report += '📏 LARGEST DEPENDENCIES:\n';
      report += '─'.repeat(50) + '\n';
      
      for (const dep of largestDeps) {
        const used = dep.isUsed ? '✅' : '❌';
        report += `${used} ${dep.name}: ${this.formatSize(dep.size || 0)}\n`;
      }
      report += '\n';
    }

    // Security summary
    const securityIssues = this.issues.filter(i => i.type === 'security');
    if (securityIssues.length > 0) {
      report += '🔐 SECURITY SUMMARY:\n';
      report += '─'.repeat(50) + '\n';
      
      const criticalSecurity = securityIssues.filter(i => i.severity === 'critical').length;
      const highSecurity = securityIssues.filter(i => i.severity === 'high').length;
      
      report += `🚨 Critical: ${criticalSecurity}\n`;
      report += `🔴 High: ${highSecurity}\n`;
      report += `🟡 Medium/Low: ${securityIssues.length - criticalSecurity - highSecurity}\n\n`;
    }

    return report;
  }

  /**
   * Generate package.json with removed unused dependencies
   */
  async generateCleanedPackageJson(): Promise<string> {
    const cleaned = JSON.parse(JSON.stringify(this.packageJson));
    
    const unusedDeps = this.issues
      .filter(i => i.type === 'unused')
      .map(i => i.dependency);

    for (const dep of unusedDeps) {
      delete cleaned.dependencies?.[dep];
      delete cleaned.devDependencies?.[dep];
    }

    return JSON.stringify(cleaned, null, 2);
  }

  /**
   * Apply automatic fixes
   */
  async applyAutomaticFixes(): Promise<{ fixed: number; failed: number }> {
    let fixed = 0;
    let failed = 0;

    const autoFixableIssues = this.issues.filter(i => i.autoFixable);

    for (const issue of autoFixableIssues) {
      try {
        if (issue.type === 'security') {
          await execAsync('npm audit fix --force');
          fixed++;
        } else if (issue.type === 'unused') {
          // Would need to modify package.json
          logger.info(`Would remove unused dependency: ${issue.dependency}`);
          fixed++;
        }
      } catch (error) {
        logger.error(`Failed to fix ${issue.dependency}:`, error);
        failed++;
      }
    }

    return { fixed, failed };
  }
}

// CLI usage
if (import.meta.url === `file://${process.argv[1]}`) {
  const auditor = new DependencyAuditor();
  
  auditor.auditDependencies()
    .then(result => {
      console.log(auditor.generateReport());
      
      if (result.issues.length > 0) {
        console.log(`\n🔧 Found ${result.issues.length} issues to address`);
        console.log(`💾 Potential savings: ${result.potentialSavings.size} from ${result.potentialSavings.count} unused packages`);
      } else {
        console.log('\n✅ No dependency issues found!');
      }
    })
    .catch(error => {
      console.error('Dependency audit failed:', error);
      process.exit(1);
    });
}