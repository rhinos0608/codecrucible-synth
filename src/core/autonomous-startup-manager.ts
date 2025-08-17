import { logger } from './logger.js';
import { exec } from 'child_process';
import { promisify } from 'util';
import { promises as fs } from 'fs';
import { join } from 'path';
import axios from 'axios';
import chalk from 'chalk';

const execAsync = promisify(exec);

/**
 * Autonomous Startup Manager
 * 
 * Implements comprehensive startup routines based on research from:
 * - Claude Code: OAuth, codebase indexing, tool discovery
 * - Cursor/Windsurf: IDE integration, model selection, project analysis
 * - Aider: Git-first approach, file watching, dependency detection
 * - Gemini CLI: System profiling, model management, context optimization
 */

export interface StartupContext {
  system: {
    os: string;
    shell: string;
    user: string;
    workingDirectory: string;
    architecture: string;
  };
  development: {
    git: { available: boolean; version?: string; repository?: boolean; branch?: string; };
    node: { available: boolean; version?: string; packageManager?: string; };
    python: { available: boolean; version?: string; };
    docker: { available: boolean; version?: string; };
    tools: string[];
  };
  ai: {
    ollama: { available: boolean; running: boolean; models: string[]; };
    models: { available: string[]; running: string[]; optimal?: string; };
    hardware: { gpu?: string; vram?: number; cpu: number; ram: number; };
  };
  project: {
    type: string;
    framework?: string;
    dependencies?: any;
    gitStatus?: any;
    structure?: any;
    buildSystem?: string;
    testFramework?: string;
  };
  security: {
    vulnerabilities: number;
    secrets: string[];
    recommendations: string[];
  };
  performance: {
    baseline: { cpu: number; memory: number; disk: number; };
    recommendations: string[];
  };
}

export class AutonomousStartupManager {
  private context: Partial<StartupContext> = {};
  private startTime: number = 0;
  private timeouts = {
    quick: 5000,    // 5 seconds for critical commands
    standard: 15000, // 15 seconds for normal commands  
    extended: 30000  // 30 seconds for comprehensive scans
  };

  /**
   * Execute comprehensive autonomous startup sequence
   */
  async executeStartupSequence(options: { 
    mode?: 'quick' | 'standard' | 'comprehensive';
    silent?: boolean;
    skipChecks?: string[];
  } = {}): Promise<StartupContext> {
    this.startTime = Date.now();
    const mode = options.mode || 'standard';
    
    if (!options.silent) {
      console.log(chalk.cyan('🚀 Initializing CodeCrucible with autonomous startup...'));
    }

    try {
      // Phase 1: Core System Detection (Parallel execution)
      await this.executePhase1SystemDetection(mode, options.silent || false);

      // Phase 2: AI Model Management (Conditional on Ollama availability)
      await this.executePhase2ModelManagement(mode, options.silent || false);

      // Phase 3: Project Context Building (Parallel where possible)
      await this.executePhase3ProjectAnalysis(mode, options.silent || false);

      // Phase 4: Security and Performance (Background/Optional)
      if (mode !== 'quick') {
        await this.executePhase4SecurityPerformance(mode, options.silent || false);
      }

      // Phase 5: Finalization and Optimization
      await this.executePhase5Finalization(options.silent || false);

      const duration = Date.now() - this.startTime;
      if (!options.silent) {
        console.log(chalk.green(`✅ Autonomous startup completed in ${duration}ms`));
      }

      return this.context as StartupContext;

    } catch (error) {
      logger.error('Autonomous startup failed:', error);
      throw error;
    }
  }

  /**
   * Phase 1: Core System Detection (30-50ms target)
   */
  private async executePhase1SystemDetection(mode: string, silent: boolean) {
    if (!silent) console.log(chalk.blue('🔍 Phase 1: System Environment Detection'));

    const systemPromises = [
      this.detectOperatingSystem(),
      this.detectShellEnvironment(),
      this.detectUserContext(),
      this.detectDevelopmentTools()
    ];

    await Promise.allSettled(systemPromises);
    logger.info('✅ System environment detection completed');
  }

  /**
   * Phase 2: AI Model Management (100-200ms target)
   */
  private async executePhase2ModelManagement(mode: string, silent: boolean) {
    if (!silent) console.log(chalk.blue('🤖 Phase 2: AI Model Management'));

    // Check Ollama availability first
    const ollamaStatus = await this.checkOllamaStatus();
    
    if (ollamaStatus.available) {
      const modelPromises = [
        this.discoverAvailableModels(),
        this.checkRunningModels(),
        this.detectHardwareCapabilities(),
        this.selectOptimalModel()
      ];

      await Promise.allSettled(modelPromises);
    } else {
      logger.warn('Ollama not available, skipping model management');
      this.context.ai = { 
        ollama: { available: false, running: false, models: [] },
        models: { available: [], running: [] },
        hardware: { cpu: 0, ram: 0 }
      };
    }

    logger.info('✅ AI model management completed');
  }

  /**
   * Phase 3: Project Context Building (50-100ms target)
   */
  private async executePhase3ProjectAnalysis(mode: string, silent: boolean) {
    if (!silent) console.log(chalk.blue('📁 Phase 3: Project Context Analysis'));

    const projectPromises = [
      this.analyzeProjectStructure(),
      this.detectGitRepository(),
      this.analyzeDependencies(),
      this.detectBuildSystem(),
      this.detectTestingFramework()
    ];

    await Promise.allSettled(projectPromises);
    logger.info('✅ Project context analysis completed');
  }

  /**
   * Phase 4: Security and Performance (Background)
   */
  private async executePhase4SecurityPerformance(mode: string, silent: boolean) {
    if (!silent) console.log(chalk.blue('🔒 Phase 4: Security & Performance Analysis'));

    const securityPromises = [
      this.performSecurityScan(),
      this.checkForSecrets(),
      this.performanceBaseline()
    ];

    await Promise.allSettled(securityPromises);
    logger.info('✅ Security and performance analysis completed');
  }

  /**
   * Phase 5: Finalization and Optimization
   */
  private async executePhase5Finalization(silent: boolean) {
    if (!silent) console.log(chalk.blue('⚡ Phase 5: Optimization & Finalization'));

    // Generate recommendations based on discovered context
    this.generateRecommendations();
    
    // Log summary for debugging
    logger.info('Startup context summary:', {
      system: this.context.system?.os,
      development: Object.keys(this.context.development || {}),
      project: this.context.project?.type,
      ai: `${this.context.ai?.models?.available?.length || 0} models available`
    });
  }

  // System Detection Methods
  private async detectOperatingSystem() {
    try {
      const result = await this.executeCommand('uname -a', 'echo %OS%');
      this.context.system = {
        ...this.context.system,
        os: process.platform,
        architecture: process.arch,
        workingDirectory: process.cwd()
      } as any;
    } catch (error) {
      logger.warn('Failed to detect OS:', error);
    }
  }

  private async detectShellEnvironment() {
    try {
      const shell = process.env.SHELL || process.env.ComSpec || 'unknown';
      this.context.system = {
        ...this.context.system,
        shell: shell.split('/').pop() || shell.split('\\\\').pop() || shell
      } as any;
    } catch (error) {
      logger.warn('Failed to detect shell:', error);
    }
  }

  private async detectUserContext() {
    try {
      const user = process.env.USER || process.env.USERNAME || 'unknown';
      this.context.system = {
        ...this.context.system,
        user
      } as any;
    } catch (error) {
      logger.warn('Failed to detect user context:', error);
    }
  }

  private async detectDevelopmentTools() {
    const tools = [];
    const checks = [
      { tool: 'git', command: 'git --version' },
      { tool: 'node', command: 'node --version' },
      { tool: 'npm', command: 'npm --version' },
      { tool: 'python', command: 'python --version' },
      { tool: 'docker', command: 'docker --version' },
      { tool: 'code', command: 'code --version' }
    ];

    for (const check of checks) {
      try {
        const result = await this.executeCommandWithTimeout(check.command, this.timeouts.quick);
        if (result.success) {
          tools.push(check.tool);
          
          // Store specific version info
          if (check.tool === 'git') {
            this.context.development = {
              ...this.context.development,
              git: { available: true, version: result.output?.split(' ')[2] }
            } as any;
          } else if (check.tool === 'node') {
            this.context.development = {
              ...this.context.development,
              node: { available: true, version: result.output?.trim() }
            } as any;
          }
        }
      } catch (error) {
        // Tool not available, continue
      }
    }

    this.context.development = {
      ...this.context.development,
      tools
    } as any;
  }

  // AI Model Management Methods
  private async checkOllamaStatus() {
    try {
      // Check if Ollama is running
      const response = await axios.get('http://localhost:11434/api/tags', { timeout: 5000 });
      const status = { available: true, running: true };
      
      this.context.ai = {
        ...this.context.ai,
        ollama: status
      } as any;

      return status;
    } catch (error) {
      const status = { available: false, running: false };
      this.context.ai = {
        ...this.context.ai,
        ollama: status
      } as any;
      return status;
    }
  }

  private async discoverAvailableModels() {
    try {
      const result = await this.executeCommandWithTimeout('ollama list', this.timeouts.standard);
      if (result.success && result.output) {
        const models = result.output
          .split('\\n')
          .slice(1) // Skip header
          .map(line => line.split(/\\s+/)[0])
          .filter(name => name && !name.includes('NAME'));

        this.context.ai = {
          ...this.context.ai,
          models: { ...this.context.ai?.models, available: models }
        } as any;
      }
    } catch (error) {
      logger.warn('Failed to discover models:', error);
    }
  }

  private async checkRunningModels() {
    try {
      const result = await this.executeCommandWithTimeout('ollama ps', this.timeouts.quick);
      if (result.success && result.output) {
        const running = result.output
          .split('\\n')
          .slice(1)
          .map(line => line.split(/\\s+/)[0])
          .filter(name => name && !name.includes('NAME'));

        this.context.ai = {
          ...this.context.ai,
          models: { ...this.context.ai?.models, running }
        } as any;
      }
    } catch (error) {
      logger.warn('Failed to check running models:', error);
    }
  }

  private async detectHardwareCapabilities() {
    try {
      // Detect GPU
      const gpuResult = await this.executeCommand('nvidia-smi --query-gpu=name,memory.total --format=csv,noheader,nounits', 'echo No GPU detected');
      
      const hardware: any = {
        cpu: require('os').cpus().length,
        ram: Math.round(require('os').totalmem() / 1024 / 1024 / 1024)
      };

      if (gpuResult.success && gpuResult.output && !gpuResult.output.includes('No GPU')) {
        const gpuInfo = gpuResult.output.split(',');
        hardware.gpu = gpuInfo[0]?.trim();
        hardware.vram = parseInt(gpuInfo[1]?.trim()) || 0;
      }

      this.context.ai = {
        ...this.context.ai,
        hardware
      } as any;
    } catch (error) {
      logger.warn('Failed to detect hardware:', error);
    }
  }

  private async selectOptimalModel() {
    const available = this.context.ai?.models?.available || [];
    if (available.length === 0) return;

    // Simple heuristic: prefer smaller models for quick startup
    const optimal = available.find(model => 
      model.includes('2b') || model.includes('7b')
    ) || available[0];

    this.context.ai = {
      ...this.context.ai,
      models: { ...this.context.ai?.models, optimal }
    } as any;
  }

  // Project Analysis Methods
  private async analyzeProjectStructure() {
    try {
      const files = await fs.readdir(process.cwd());
      
      // Detect project type
      let type = 'unknown';
      let framework = undefined;
      
      if (files.includes('package.json')) {
        type = 'nodejs';
        const packageJson = JSON.parse(await fs.readFile('package.json', 'utf-8'));
        
        if (packageJson.dependencies?.react) framework = 'react';
        else if (packageJson.dependencies?.vue) framework = 'vue';
        else if (packageJson.dependencies?.angular) framework = 'angular';
        else if (packageJson.dependencies?.express) framework = 'express';
      } else if (files.includes('Cargo.toml')) {
        type = 'rust';
      } else if (files.includes('requirements.txt') || files.includes('pyproject.toml')) {
        type = 'python';
      } else if (files.includes('go.mod')) {
        type = 'go';
      }

      this.context.project = {
        ...this.context.project,
        type,
        framework,
        structure: { files: files.length }
      } as any;
    } catch (error) {
      logger.warn('Failed to analyze project structure:', error);
    }
  }

  private async detectGitRepository() {
    try {
      const statusResult = await this.executeCommandWithTimeout('git status --porcelain', this.timeouts.quick);
      const branchResult = await this.executeCommandWithTimeout('git branch --show-current', this.timeouts.quick);
      
      if (statusResult.success) {
        this.context.project = {
          ...this.context.project,
          gitStatus: {
            isRepository: true,
            branch: branchResult.output?.trim(),
            hasChanges: !!statusResult.output?.trim()
          }
        } as any;

        // Update development tools
        this.context.development = {
          ...this.context.development,
          git: {
            ...this.context.development?.git,
            repository: true,
            branch: branchResult.output?.trim()
          }
        } as any;
      }
    } catch (error) {
      // Not a git repository
    }
  }

  private async analyzeDependencies() {
    try {
      if (this.context.project?.type === 'nodejs') {
        const result = await this.executeCommandWithTimeout('npm ls --depth=0 --json', this.timeouts.standard);
        if (result.success && result.output) {
          try {
            const deps = JSON.parse(result.output);
            this.context.project = {
              ...this.context.project,
              dependencies: {
                count: Object.keys(deps.dependencies || {}).length,
                hasDevDeps: !!deps.devDependencies
              }
            } as any;
          } catch {
            // Invalid JSON, skip
          }
        }
      }
    } catch (error) {
      logger.warn('Failed to analyze dependencies:', error);
    }
  }

  private async detectBuildSystem() {
    try {
      const files = await fs.readdir(process.cwd());
      
      let buildSystem = undefined;
      if (files.includes('webpack.config.js')) buildSystem = 'webpack';
      else if (files.includes('vite.config.js')) buildSystem = 'vite';
      else if (files.includes('rollup.config.js')) buildSystem = 'rollup';
      else if (files.includes('Cargo.toml')) buildSystem = 'cargo';
      else if (files.includes('Makefile')) buildSystem = 'make';

      this.context.project = {
        ...this.context.project,
        buildSystem
      } as any;
    } catch (error) {
      logger.warn('Failed to detect build system:', error);
    }
  }

  private async detectTestingFramework() {
    try {
      if (this.context.project?.type === 'nodejs') {
        const packageJson = JSON.parse(await fs.readFile('package.json', 'utf-8'));
        const allDeps = { ...packageJson.dependencies, ...packageJson.devDependencies };
        
        let testFramework = undefined;
        if (allDeps.jest) testFramework = 'jest';
        else if (allDeps.mocha) testFramework = 'mocha';
        else if (allDeps.vitest) testFramework = 'vitest';
        else if (allDeps.cypress) testFramework = 'cypress';

        this.context.project = {
          ...this.context.project,
          testFramework
        } as any;
      }
    } catch (error) {
      logger.warn('Failed to detect test framework:', error);
    }
  }

  // Security and Performance Methods
  private async performSecurityScan() {
    try {
      if (this.context.project?.type === 'nodejs') {
        const result = await this.executeCommandWithTimeout('npm audit --json', this.timeouts.extended);
        if (result.success && result.output) {
          try {
            const audit = JSON.parse(result.output);
            this.context.security = {
              ...this.context.security,
              vulnerabilities: audit.metadata?.vulnerabilities?.total || 0
            } as any;
          } catch {
            // Handle non-JSON output
            this.context.security = {
              ...this.context.security,
              vulnerabilities: result.output?.includes('vulnerabilities') ? 1 : 0
            } as any;
          }
        }
      }
    } catch (error) {
      logger.warn('Failed to perform security scan:', error);
    }
  }

  private async checkForSecrets() {
    try {
      const secrets = [];
      const patterns = ['password', 'api.?key', 'secret', 'token'];
      
      for (const pattern of patterns) {
        const result = await this.executeCommandWithTimeout(
          `grep -r "${pattern}" . --include="*.js" --include="*.ts" --exclude-dir=node_modules --exclude-dir=.git`,
          this.timeouts.quick
        );
        
        if (result.success && result.output?.trim()) {
          secrets.push(pattern);
        }
      }

      this.context.security = {
        ...this.context.security,
        secrets
      } as any;
    } catch (error) {
      logger.warn('Failed to check for secrets:', error);
    }
  }

  private async performanceBaseline() {
    try {
      const start = process.hrtime.bigint();
      await fs.readdir(process.cwd());
      const end = process.hrtime.bigint();
      
      const diskTime = Number(end - start) / 1000000; // Convert to milliseconds
      
      this.context.performance = {
        baseline: {
          cpu: require('os').loadavg()[0],
          memory: process.memoryUsage().heapUsed / 1024 / 1024,
          disk: diskTime
        },
        recommendations: []
      } as any;
    } catch (error) {
      logger.warn('Failed to perform baseline:', error);
    }
  }

  private generateRecommendations() {
    const recommendations = [];
    
    // Model recommendations
    if (!this.context.ai?.ollama?.available) {
      recommendations.push('Install Ollama for local AI model support');
    } else if ((this.context.ai?.models?.available?.length || 0) === 0) {
      recommendations.push('Download AI models with: ollama pull gemma:2b');
    }

    // Project recommendations
    if (!this.context.project?.gitStatus?.isRepository) {
      recommendations.push('Initialize Git repository for version control');
    }

    if (this.context.project?.type === 'nodejs' && !this.context.project?.testFramework) {
      recommendations.push('Add testing framework (Jest recommended)');
    }

    // Security recommendations
    if ((this.context.security?.vulnerabilities || 0) > 0) {
      recommendations.push('Address security vulnerabilities with npm audit fix');
    }

    if ((this.context.security?.secrets?.length || 0) > 0) {
      recommendations.push('Review and secure hardcoded secrets');
    }

    this.context.security = {
      ...this.context.security,
      recommendations
    } as any;
  }

  // Utility Methods
  private async executeCommand(unixCommand: string, windowsCommand?: string): Promise<{ success: boolean; output?: string }> {
    const command = process.platform === 'win32' && windowsCommand ? windowsCommand : unixCommand;
    
    try {
      const { stdout } = await execAsync(command);
      return { success: true, output: stdout.trim() };
    } catch (error) {
      return { success: false };
    }
  }

  private async executeCommandWithTimeout(command: string, timeout: number): Promise<{ success: boolean; output?: string }> {
    try {
      const { stdout } = await execAsync(command, { timeout });
      return { success: true, output: stdout.trim() };
    } catch (error) {
      return { success: false };
    }
  }

  /**
   * Get the current startup context
   */
  getStartupContext(): Partial<StartupContext> {
    return this.context;
  }

  /**
   * Quick health check for critical systems
   */
  async performHealthCheck(): Promise<{ healthy: boolean; issues: string[] }> {
    const issues = [];
    
    if (!this.context.ai?.ollama?.available) {
      issues.push('Ollama not available');
    }

    if ((this.context.ai?.models?.available?.length || 0) === 0) {
      issues.push('No AI models available');
    }

    if ((this.context.security?.vulnerabilities || 0) > 10) {
      issues.push('High number of security vulnerabilities');
    }

    return {
      healthy: issues.length === 0,
      issues
    };
  }
}