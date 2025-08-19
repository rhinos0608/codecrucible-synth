
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import { AutonomousCodebaseAnalyzer, CodebaseAnalysis } from './tools/autonomous-codebase-auditor';

const execAsync = promisify(exec);

export interface SystemEnvironment {
  os: string;
  shell: string;
  node: string;
  npm: string;
  git: string;
  docker?: string;
  python?: string;
}

export interface ModelStatus {
  ollama: {
    available: boolean;
    models: string[];
    running: string[];
  };
  lmStudio: {
    available: boolean;
    endpoint?: string;
  };
}

export interface StartupReport {
  environment: SystemEnvironment;
  models: ModelStatus;
  project: {
    isGitRepo: boolean;
    hasPackageJson: boolean;
    dependencies: number;
    framework?: string;
  };
  analysis?: CodebaseAnalysis;
  recommendations: string[];
  readinessScore: number;
}

export class AutonomousStartupManager {
  private workingDirectory: string;
  
  constructor(workingDirectory: string = process.cwd()) {
    this.workingDirectory = workingDirectory;
  }
  
  async executeStartupSequence(): Promise<StartupReport> {
    console.log('🚀 Executing autonomous startup sequence...');
    
    const startTime = Date.now();
    
    // Run startup phases in parallel where possible
    const [environment, models, project] = await Promise.allSettled([
      this.detectSystemEnvironment(),
      this.validateAndOptimizeModels(),
      this.analyzeProject()
    ]);
    
    const report: StartupReport = {
      environment: environment.status === 'fulfilled' ? environment.value : this.getDefaultEnvironment(),
      models: models.status === 'fulfilled' ? models.value : this.getDefaultModels(),
      project: project.status === 'fulfilled' ? project.value : this.getDefaultProject(),
      recommendations: [],
      readinessScore: 0
    };
    
    // Perform codebase analysis if this is a development project
    if (report.project.hasPackageJson || report.project.isGitRepo) {
      try {
        const analyzer = new AutonomousCodebaseAnalyzer(this.workingDirectory);
        report.analysis = await analyzer.performComprehensiveAnalysis();
      } catch (error) {
        console.warn('⚠️ Codebase analysis failed:', error);
      }
    }
    
    // Generate recommendations
    report.recommendations = this.generateRecommendations(report);
    report.readinessScore = this.calculateReadinessScore(report);
    
    const duration = Date.now() - startTime;
    console.log(`✅ Startup sequence completed in ${duration}ms (Score: ${report.readinessScore}/100)`);
    
    return report;
  }
  
  private async detectSystemEnvironment(): Promise<SystemEnvironment> {
    const commands = {
      os: process.platform,
      shell: process.env.SHELL || process.env.ComSpec || 'unknown',
      node: 'node --version',
      npm: 'npm --version',
      git: 'git --version',
      docker: 'docker --version',
      python: 'python --version'
    };
    
    const environment: Record<string, string> = { os: commands.os, shell: commands.shell };
    
    for (const [key, command] of Object.entries(commands)) {
      if (key === 'os' || key === 'shell') continue;
      
      try {
        const { stdout } = await execAsync(command, { timeout: 5000 });
        environment[key] = stdout.trim();
      } catch (error) {
        if (key !== 'docker' && key !== 'python') {
          environment[key] = 'not available';
        }
      }
    }
    
    return environment as unknown as SystemEnvironment;
  }
  
  private async validateAndOptimizeModels(): Promise<ModelStatus> {
    const modelStatus: ModelStatus = {
      ollama: { available: false, models: [], running: [] },
      lmStudio: { available: false }
    };
    
    // Check Ollama
    try {
      const { stdout: listOutput } = await execAsync('ollama list', { timeout: 10000 });
      modelStatus.ollama.available = true;
      modelStatus.ollama.models = this.parseOllamaModels(listOutput);
      
      try {
        const { stdout: psOutput } = await execAsync('ollama ps', { timeout: 5000 });
        modelStatus.ollama.running = this.parseOllamaRunning(psOutput);
      } catch (error) {
        // Running models check failed, but Ollama is available
      }
    } catch (error) {
      // Ollama not available
    }
    
    // Check LM Studio
    try {
      const response = await fetch('http://localhost:1234/v1/models', { 
        signal: AbortSignal.timeout(5000) 
      });
      if (response.ok) {
        modelStatus.lmStudio.available = true;
        modelStatus.lmStudio.endpoint = 'http://localhost:1234';
      }
    } catch (error) {
      // LM Studio not available
    }
    
    return modelStatus;
  }
  
  private async analyzeProject() {
    const project = {
      isGitRepo: false,
      hasPackageJson: false,
      dependencies: 0,
      framework: undefined as string | undefined
    };
    
    // Check if Git repository
    try {
      await execAsync('git status', { cwd: this.workingDirectory, timeout: 3000 });
      project.isGitRepo = true;
    } catch (error) {
      // Not a git repo
    }
    
    // Check for package.json
    const packageJsonPath = path.join(this.workingDirectory, 'package.json');
    if (fs.existsSync(packageJsonPath)) {
      project.hasPackageJson = true;
      
      try {
        const packageJson = JSON.parse(await fs.promises.readFile(packageJsonPath, 'utf-8'));
        const deps = Object.keys(packageJson.dependencies || {});
        const devDeps = Object.keys(packageJson.devDependencies || {});
        project.dependencies = deps.length + devDeps.length;
        
        // Detect framework
        if (packageJson.dependencies?.react) project.framework = 'React';
        else if (packageJson.dependencies?.vue) project.framework = 'Vue';
        else if (packageJson.dependencies?.angular) project.framework = 'Angular';
        else if (packageJson.dependencies?.express) project.framework = 'Express';
        else if (packageJson.dependencies?.next) project.framework = 'Next.js';
        else if (packageJson.devDependencies?.typescript) project.framework = 'TypeScript';
      } catch (error) {
        // Invalid package.json
      }
    }
    
    return project;
  }
  
  private parseOllamaModels(output: string): string[] {
    const lines = output.split('\n').slice(1); // Skip header
    return lines
      .map(line => line.split('\t')[0])
      .filter(model => model && model !== 'NAME')
      .slice(0, 10); // Limit results
  }
  
  private parseOllamaRunning(output: string): string[] {
    const lines = output.split('\n').slice(1); // Skip header
    return lines
      .map(line => line.split('\t')[0])
      .filter(model => model && model !== 'NAME')
      .slice(0, 5); // Limit results
  }
  
  private generateRecommendations(report: StartupReport): string[] {
    const recommendations: string[] = [];
    
    // Environment recommendations
    if (report.environment.git === 'not available') {
      recommendations.push('Install Git for version control');
    }
    
    if (report.environment.node === 'not available') {
      recommendations.push('Install Node.js for JavaScript development');
    }
    
    // Model recommendations
    if (!report.models.ollama.available && !report.models.lmStudio.available) {
      recommendations.push('Install Ollama or LM Studio for local AI capabilities');
    } else if (report.models.ollama.available && report.models.ollama.models.length === 0) {
      recommendations.push('Download at least one model in Ollama (e.g., codellama:7b)');
    }
    
    // Project recommendations
    if (report.project.isGitRepo && report.project.hasPackageJson) {
      recommendations.push('Project setup looks good - ready for AI-assisted development');
    } else if (!report.project.isGitRepo) {
      recommendations.push('Initialize Git repository for better code tracking');
    }
    
    // Analysis-based recommendations
    if (report.analysis) {
      if (report.analysis?.dependencies?.security?.vulnerabilities > 0) {
        recommendations.push(`Fix ${report.analysis.dependencies.security.vulnerabilities} security vulnerabilities`);
      }
      
      if (report.analysis?.codeQuality?.maintainability === 'needs improvement') {
        recommendations.push('Improve code maintainability');
      }
      
      if (report.analysis?.security?.risks?.length > 0) {
        recommendations.push('Address security risks in codebase');
      }
    }
    
    return recommendations.slice(0, 8); // Limit recommendations
  }
  
  private calculateReadinessScore(report: StartupReport): number {
    let score = 0;
    
    // Environment scoring (40 points max)
    if (report.environment.node !== 'not available') score += 15;
    if (report.environment.git !== 'not available') score += 15;
    if (report.environment.npm !== 'not available') score += 10;
    
    // Model scoring (30 points max)
    if (report.models.ollama.available || report.models.lmStudio.available) score += 15;
    if (report.models.ollama.models.length > 0) score += 15;
    
    // Project scoring (30 points max)
    if (report.project.isGitRepo) score += 10;
    if (report.project.hasPackageJson) score += 10;
    if (report.project.framework) score += 10;
    
    return Math.min(100, score);
  }
  
  private getDefaultEnvironment(): SystemEnvironment {
    return {
      os: process.platform,
      shell: 'unknown',
      node: 'not available',
      npm: 'not available',
      git: 'not available'
    };
  }
  
  private getDefaultModels(): ModelStatus {
    return {
      ollama: { available: false, models: [], running: [] },
      lmStudio: { available: false }
    };
  }
  
  private getDefaultProject() {
    return {
      isGitRepo: false,
      hasPackageJson: false,
      dependencies: 0
    };
  }
}
