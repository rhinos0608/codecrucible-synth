import { logger } from './logger.js';
import { AutonomousErrorHandler } from './autonomous-error-handler.js';
import { execSync } from 'child_process';
import { promisify } from 'util';
import { exec } from 'child_process';
import axios from 'axios';

const execAsync = promisify(exec);

export interface SystemSpecs {
  cpu: {
    cores: number;
    threads: number;
    frequency: number;
    usage: number;
  };
  memory: {
    total: number;
    available: number;
    usage: number;
  };
  gpu: {
    available: boolean;
    vram: number;
    type: 'nvidia' | 'amd' | 'intel' | 'none';
  };
}

export interface ModelCapability {
  name: string;
  strengths: string[];
  weaknesses: string[];
  recommendedFor: string[];
  size: 'small' | 'medium' | 'large';
  speed: 'fast' | 'medium' | 'slow';
  requirements: {
    minRam: number; // MB
    minVram?: number; // MB
    minCores: number;
  };
}

/**
 * Intelligent Model Selector
 * 
 * Automatically selects the best model for each task based on:
 * - Task requirements
 * - Available resources
 * - Historical performance
 * - Model capabilities
 */
export class IntelligentModelSelector {
  private errorHandler: AutonomousErrorHandler;
  private performanceHistory = new Map<string, number[]>();
  
  private systemSpecs?: SystemSpecs;
  private availableModels: string[] = [];
  private lastModelCheck = 0;

  // Model capability database with system requirements
  private modelCapabilities: ModelCapability[] = [
    {
      name: 'codellama:34b',
      strengths: ['code generation', 'debugging', 'code analysis'],
      weaknesses: ['general chat', 'creative writing'],
      recommendedFor: ['coding', 'debugging', 'code_review'],
      size: 'large',
      speed: 'slow',
      requirements: { minRam: 16384, minVram: 20480, minCores: 4 }
    },
    {
      name: 'codellama:13b', 
      strengths: ['code generation', 'fast responses'],
      weaknesses: ['complex reasoning'],
      recommendedFor: ['coding', 'simple_tasks'],
      size: 'medium',
      speed: 'medium',
      requirements: { minRam: 8192, minVram: 8192, minCores: 2 }
    },
    {
      name: 'codellama:7b',
      strengths: ['fast responses', 'lightweight'],
      weaknesses: ['complex tasks', 'accuracy'],
      recommendedFor: ['simple_coding', 'quick_help'],
      size: 'small',
      speed: 'fast',
      requirements: { minRam: 4096, minVram: 4096, minCores: 2 }
    },
    {
      name: 'llama3.1:70b',
      strengths: ['reasoning', 'complex tasks', 'accuracy'],
      weaknesses: ['speed', 'resource usage'],
      recommendedFor: ['planning', 'analysis', 'complex_reasoning'],
      size: 'large',
      speed: 'slow',
      requirements: { minRam: 32768, minVram: 40960, minCores: 8 }
    },
    {
      name: 'llama3.2:latest',
      strengths: ['balance', 'general purpose', 'good speed'],
      weaknesses: ['not specialized'],
      recommendedFor: ['general', 'chat', 'mixed_tasks'],
      size: 'small',
      speed: 'fast',
      requirements: { minRam: 2048, minCores: 1 }
    },
    {
      name: 'llama3.2:8b',
      strengths: ['balance', 'general purpose', 'good speed'],
      weaknesses: ['not specialized'],
      recommendedFor: ['general', 'chat', 'mixed_tasks'],
      size: 'medium',
      speed: 'medium',
      requirements: { minRam: 6144, minVram: 6144, minCores: 2 }
    },
    {
      name: 'qwen2.5:72b',
      strengths: ['multilingual', 'reasoning', 'coding'],
      weaknesses: ['speed', 'resource usage'],
      recommendedFor: ['complex_coding', 'analysis', 'planning'],
      size: 'large', 
      speed: 'slow',
      requirements: { minRam: 32768, minVram: 40960, minCores: 8 }
    },
    {
      name: 'qwen2.5:7b',
      strengths: ['fast', 'coding', 'lightweight'],
      weaknesses: ['complex reasoning'],
      recommendedFor: ['simple_coding', 'quick_tasks'],
      size: 'small',
      speed: 'fast',
      requirements: { minRam: 4096, minVram: 4096, minCores: 2 }
    },
    {
      name: 'gemma2:27b',
      strengths: ['reasoning', 'safety', 'accuracy'],
      weaknesses: ['speed'],
      recommendedFor: ['analysis', 'safe_operations'],
      size: 'large',
      speed: 'slow',
      requirements: { minRam: 16384, minVram: 20480, minCores: 4 }
    },
    {
      name: 'gemma2:9b',
      strengths: ['balanced', 'efficient', 'safe'],
      weaknesses: ['not specialized'],
      recommendedFor: ['general', 'safe_operations'],
      size: 'medium',
      speed: 'medium',
      requirements: { minRam: 6144, minVram: 6144, minCores: 2 }
    },
    {
      name: 'gpt-oss:20b',
      strengths: ['code generation', 'reasoning', 'analysis', 'debugging'],
      weaknesses: ['speed', 'resource usage'],
      recommendedFor: ['coding', 'complex_coding', 'debugging', 'code_review', 'analysis'],
      size: 'large',
      speed: 'medium',
      requirements: { minRam: 16384, minVram: 12288, minCores: 4 }
    }
  ];

  constructor() {
    this.errorHandler = new AutonomousErrorHandler();
    this.initializeSystemAnalysis();
  }

  /**
   * Initialize system analysis and model detection
   */
  private async initializeSystemAnalysis(): Promise<void> {
    try {
      await this.detectSystemSpecs();
      await this.detectAvailableModels();
      logger.info('🔍 System analysis completed');
    } catch (error) {
      logger.warn('⚠️ System analysis failed, using defaults:', error);
    }
  }

  /**
   * Detect system specifications
   */
  private async detectSystemSpecs(): Promise<SystemSpecs> {
    try {
      const specs: SystemSpecs = {
        cpu: await this.detectCPU(),
        memory: await this.detectMemory(),
        gpu: await this.detectGPU()
      };
      
      this.systemSpecs = specs;
      logger.info('💻 System specs detected:', {
        cpu: `${specs.cpu.cores} cores @ ${specs.cpu.frequency}MHz`,
        memory: `${Math.round(specs.memory.total / 1024)} GB (${specs.memory.usage}% used)`,
        gpu: specs.gpu.available ? `${specs.gpu.type} with ${Math.round(specs.gpu.vram / 1024)} GB VRAM` : 'None'
      });
      
      return specs;
    } catch (error) {
      logger.error('Failed to detect system specs:', error);
      // Fallback specs for low-end systems
      const fallback: SystemSpecs = {
        cpu: { cores: 2, threads: 4, frequency: 2000, usage: 50 },
        memory: { total: 8192, available: 4096, usage: 50 },
        gpu: { available: false, vram: 0, type: 'none' }
      };
      this.systemSpecs = fallback;
      return fallback;
    }
  }

  /**
   * Detect CPU specifications
   */
  private async detectCPU(): Promise<SystemSpecs['cpu']> {
    try {
      if (process.platform === 'win32') {
        // Try WMIC first
        let stdout: string | undefined;
        try {
          const result = await execAsync('wmic cpu get NumberOfCores,NumberOfLogicalProcessors,MaxClockSpeed /format:csv');
          stdout = result.stdout;
        } catch (wmicError) {
          // WMIC not available, try PowerShell
          try {
            const psResult = await execAsync('powershell "Get-WmiObject -Class Win32_Processor | Select-Object NumberOfCores, NumberOfLogicalProcessors, MaxClockSpeed | ConvertTo-Json"');
            const cpuInfo = JSON.parse(psResult.stdout);
            const cpuData = Array.isArray(cpuInfo) ? cpuInfo[0] : cpuInfo;
            return {
              cores: cpuData.NumberOfCores || 2,
              threads: cpuData.NumberOfLogicalProcessors || 4,
              frequency: cpuData.MaxClockSpeed || 2000,
              usage: 25
            };
          } catch (psError) {
            // Try simple PowerShell command
            const altResult = await execAsync('powershell "(Get-CimInstance -ClassName Win32_ComputerSystem).NumberOfLogicalProcessors"');
            const threads = parseInt(altResult.stdout.trim()) || 4;
            return {
              cores: Math.max(1, Math.floor(threads / 2)),
              threads,
              frequency: 2400,
              usage: 25
            };
          }
        }
        const lines = stdout?.split('\n').filter((line: string) => line.includes(',')) || [];
        if (lines.length > 1) {
          const parts = lines[1].split(',');
          return {
            cores: parseInt(parts[2]) || 2,
            threads: parseInt(parts[3]) || 4,
            frequency: parseInt(parts[1]) || 2000,
            usage: 25 // Default estimate
          };
        }
      } else {
        const { stdout: cores } = await execAsync('nproc');
        const { stdout: freq } = await execAsync('cat /proc/cpuinfo | grep "cpu MHz" | head -1 | awk \'{print $4}\'').catch(() => ({ stdout: '2000' }));
        return {
          cores: parseInt(cores.trim()) || 2,
          threads: parseInt(cores.trim()) || 4,
          frequency: parseFloat(freq.trim()) || 2000,
          usage: 25
        };
      }
    } catch (error) {
      logger.warn('CPU detection failed:', error);
    }
    
    return { cores: 2, threads: 4, frequency: 2000, usage: 25 };
  }

  /**
   * Detect memory specifications
   */
  private async detectMemory(): Promise<SystemSpecs['memory']> {
    try {
      if (process.platform === 'win32') {
        // Try WMIC first
        let stdout: string | undefined;
        try {
          const result = await execAsync('wmic computersystem get TotalPhysicalMemory /format:csv');
          stdout = result.stdout;
        } catch (wmicError) {
          // WMIC not available, try PowerShell
          try {
            const psResult = await execAsync('powershell "Get-WmiObject -Class Win32_ComputerSystem | Select-Object TotalPhysicalMemory | ConvertTo-Json"');
            const memInfo = JSON.parse(psResult.stdout);
            const totalBytes = parseInt(memInfo.TotalPhysicalMemory);
            const totalMB = Math.round(totalBytes / (1024 * 1024));
            return {
              total: totalMB,
              available: Math.round(totalMB * 0.6),
              usage: 40
            };
          } catch (psError) {
            // Try alternative method
            const altResult = await execAsync('powershell "[math]::round((Get-CimInstance -ClassName Win32_PhysicalMemory | Measure-Object -Property Capacity -Sum).Sum / 1MB)"');
            const totalMB = parseInt(altResult.stdout.trim()) || 8192;
            return {
              total: totalMB,
              available: Math.round(totalMB * 0.6),
              usage: 40
            };
          }
        }
        const lines = stdout?.split('\n').filter((line: string) => line.includes(',')) || [];
        if (lines.length > 1) {
          const totalBytes = parseInt(lines[1].split(',')[1]);
          const totalMB = Math.round(totalBytes / (1024 * 1024));
          return {
            total: totalMB,
            available: Math.round(totalMB * 0.6), // Estimate 60% available
            usage: 40
          };
        }
      } else {
        const { stdout } = await execAsync('free -m | grep "^Mem:" | awk \'{print $2,$7}\'');
        const [total, available] = stdout.trim().split(' ').map(Number);
        return {
          total: total || 8192,
          available: available || 4096,
          usage: Math.round(((total - available) / total) * 100)
        };
      }
    } catch (error) {
      logger.warn('Memory detection failed:', error);
    }
    
    return { total: 8192, available: 4096, usage: 50 };
  }

  /**
   * Detect GPU specifications
   */
  private async detectGPU(): Promise<SystemSpecs['gpu']> {
    try {
      // Try nvidia-smi first
      try {
        const { stdout } = await execAsync('nvidia-smi --query-gpu=memory.total --format=csv,noheader,nounits');
        const vramMB = parseInt(stdout.trim()) || 0;
        if (vramMB > 0) {
          return { available: true, vram: vramMB, type: 'nvidia' };
        }
      } catch {
        // nvidia-smi not available
      }

      // Try AMD ROCm
      try {
        const { stdout } = await execAsync('rocm-smi --showmeminfo vram --csv');
        if (stdout.includes('GB')) {
          const vramGB = parseFloat(stdout.match(/(\d+\.?\d*)\s*GB/)?.[1] || '0');
          return { available: true, vram: vramGB * 1024, type: 'amd' };
        }
      } catch {
        // ROCm not available
      }

      // Check for Intel GPU on Windows
      if (process.platform === 'win32') {
        try {
          // Try WMIC first
          let stdout: string | undefined;
          try {
            const result = await execAsync('wmic path win32_VideoController get AdapterRAM,Name /format:csv');
            stdout = result.stdout;
          } catch (wmicError) {
            // WMIC not available, try PowerShell
            const psResult = await execAsync('powershell "Get-WmiObject -Class Win32_VideoController | Select-Object Name, AdapterRAM | ConvertTo-Json"');
            const gpuInfo = JSON.parse(psResult.stdout);
            const gpuArray = Array.isArray(gpuInfo) ? gpuInfo : [gpuInfo];
            const intelGpu = gpuArray.find(gpu => gpu.Name && gpu.Name.includes('Intel'));
            if (intelGpu) {
              return { available: true, vram: 1024, type: 'intel' };
            }
            return { available: false, vram: 0, type: 'none' };
          }
          const lines = stdout?.split('\n').filter((line: string) => line.includes('Intel')) || [];
          if (lines.length > 0) {
            return { available: true, vram: 1024, type: 'intel' }; // Estimate for Intel iGPU
          }
        } catch {
          // Intel GPU detection failed
        }
      }

    } catch (error) {
      logger.warn('GPU detection failed:', error);
    }
    
    return { available: false, vram: 0, type: 'none' };
  }

  /**
   * Detect available Ollama models
   */
  private async detectAvailableModels(): Promise<string[]> {
    try {
      // Check cache first (refresh every 5 minutes)
      if (Date.now() - this.lastModelCheck < 300000 && this.availableModels.length > 0) {
        return this.availableModels;
      }

      // Try Ollama API first
      try {
        const response = await axios.get('http://localhost:11434/api/tags', { timeout: 3000 });
        const models = response.data.models?.map((m: any) => m.name) || [];
        this.availableModels = models;
        this.lastModelCheck = Date.now();
        
        logger.info(`🤖 Detected ${models.length} available models:`, models.slice(0, 5));
        return models;
      } catch (apiError) {
        // Fallback to ollama list command
        const { stdout } = await execAsync('ollama list');
        const lines = stdout.split('\n').slice(1); // Skip header
        const models = lines
          .filter(line => line.trim() && !line.startsWith('NAME'))
          .map(line => line.split(/\s+/)[0])
          .filter(Boolean);
        
        this.availableModels = models;
        this.lastModelCheck = Date.now();
        
        logger.info(`🤖 Detected ${models.length} available models via CLI`);
        return models;
      }
    } catch (error) {
      logger.warn('Failed to detect available models:', error);
      // Return common fallback models
      const fallback = ['llama3.2:latest', 'gemma2:9b', 'qwen2.5:7b'];
      this.availableModels = fallback;
      return fallback;
    }
  }

  /**
   * Check if model can run on current system
   */
  private canModelRun(model: ModelCapability): boolean {
    if (!this.systemSpecs) {
      logger.warn(`No system specs available for ${model.name}, allowing model to run`);
      return true; // Conservative fallback
    }
    
    const specs = this.systemSpecs;
    const req = model.requirements;
    
    // Check RAM requirement - use total instead of available for better compatibility
    const usableRam = Math.min(specs.memory.total * 0.8, specs.memory.available); // 80% of total or available
    if (usableRam < req.minRam) {
      logger.debug(`${model.name} requires ${req.minRam}MB RAM, but only ${Math.round(usableRam)}MB usable`);
      return false;
    }
    
    // Check CPU cores
    if (specs.cpu.cores < req.minCores) {
      logger.debug(`${model.name} requires ${req.minCores} cores, but only ${specs.cpu.cores} available`);
      return false;
    }
    
    // Check VRAM if required - only fail if GPU is available but insufficient
    if (req.minVram && specs.gpu.available && specs.gpu.vram < req.minVram) {
      logger.debug(`${model.name} requires ${req.minVram}MB VRAM, but only ${specs.gpu.vram}MB available`);
      return false;
    }
    
    // If VRAM required but no GPU, still allow (CPU inference)
    if (req.minVram && !specs.gpu.available) {
      logger.debug(`${model.name} prefers GPU but will run on CPU`);
    }
    
    logger.debug(`✅ ${model.name} is compatible with system specs`);
    return true;
  }

  /**
   * Select the best model for a given task with autonomous system analysis
   */
  async selectOptimalModel(
    taskType: string,
    requirements: {
      speed?: 'fast' | 'medium' | 'slow';
      accuracy?: 'high' | 'medium' | 'low';
      complexity?: 'simple' | 'medium' | 'complex';
      resources?: 'limited' | 'normal' | 'unlimited';
    } = {},
    providedModels: string[] = []
  ): Promise<string> {
    
    logger.info(`🧠 Autonomous model selection for task: ${taskType}`);
    
    // Ensure system specs and models are up to date
    if (!this.systemSpecs) {
      await this.detectSystemSpecs();
    }
    
    // Get available models
    const availableModels = providedModels.length > 0 ? providedModels : await this.detectAvailableModels();
    
    // Auto-adjust requirements based on system capabilities
    const autoRequirements = this.optimizeRequirementsForSystem(requirements);
    
    // Get task-specific model preferences
    let candidates = this.getTaskSpecificModels(taskType);
    
    // Filter by system compatibility first
    const compatibleCandidates = candidates.filter(model => this.canModelRun(model));
    logger.debug(`Compatible models after system check: ${compatibleCandidates.map(m => m.name).join(', ')}`);
    
    // Filter by availability with more robust matching
    const availableCandidates = compatibleCandidates.filter(model => {
      const modelBase = model.name.split(':')[0];
      const isAvailable = availableModels.some(available => {
        const availableBase = available.split(':')[0];
        return available === model.name || availableBase === modelBase || available.includes(modelBase);
      });
      
      if (!isAvailable) {
        logger.debug(`❌ ${model.name} not found in available models: ${availableModels.join(', ')}`);
      } else {
        logger.debug(`✅ ${model.name} is available`);
      }
      
      return isAvailable;
    });
    
    candidates = availableCandidates;
    logger.info(`Final candidate models: ${candidates.map(m => m.name).join(', ')}`);
    
    if (candidates.length === 0) {
      logger.warn(`⚠️ No compatible models found for task: ${taskType}`);
      logger.info(`Available models from Ollama: ${availableModels.join(', ')}`);
      logger.info(`Original candidates: ${this.getTaskSpecificModels(taskType).map(m => m.name).join(', ')}`);
      
      // Fallback to any available model
      const simplestModel = this.findSimplestCompatibleModel(availableModels);
      if (simplestModel) {
        logger.info(`🔄 Using fallback model: ${simplestModel}`);
        return simplestModel;
      }
      
      // Ultimate fallback - use first available model
      if (availableModels.length > 0) {
        logger.warn(`🚨 Using first available model as last resort: ${availableModels[0]}`);
        return availableModels[0];
      }
      
      throw new Error('No models available in Ollama. Please install a model with: ollama pull llama3.2:latest');
    }
    
    // Apply requirement filters
    candidates = this.filterByRequirements(candidates, autoRequirements);
    
    // Sort by comprehensive score including system performance
    candidates.sort((a, b) => {
      const aScore = this.calculateComprehensiveScore(a, taskType, autoRequirements);
      const bScore = this.calculateComprehensiveScore(b, taskType, autoRequirements);
      return bScore - aScore;
    });
    
    const selectedModel = candidates[0]?.name;
    
    if (selectedModel) {
      logger.info(`✅ Autonomously selected model: ${selectedModel} for task: ${taskType}`, {
        systemSpecs: this.systemSpecs ? {
          ram: `${Math.round(this.systemSpecs.memory.available / 1024)}GB available`,
          cpu: `${this.systemSpecs.cpu.cores} cores`,
          gpu: this.systemSpecs.gpu.available ? `${this.systemSpecs.gpu.type}` : 'none'
        } : 'unknown'
      });
      return selectedModel;
    }
    
    // Ultimate fallback
    const fallback = await this.errorHandler.getRecommendedModel(taskType as any);
    logger.warn(`⚠️ No optimal model found, using system fallback: ${fallback}`);
    return fallback;
  }

  /**
   * Optimize requirements based on system capabilities
   */
  private optimizeRequirementsForSystem(
    requirements: any
  ): any {
    if (!this.systemSpecs) return requirements;
    
    const optimized = { ...requirements };
    const specs = this.systemSpecs;
    
    // Auto-adjust based on available RAM
    if (specs.memory.available < 4096) {
      optimized.resources = 'limited';
      optimized.speed = 'fast';
    } else if (specs.memory.available > 16384) {
      optimized.resources = 'unlimited';
    }
    
    // Auto-adjust based on CPU cores
    if (specs.cpu.cores <= 2) {
      optimized.speed = optimized.speed || 'fast';
    } else if (specs.cpu.cores >= 8) {
      optimized.accuracy = optimized.accuracy || 'high';
    }
    
    // Auto-adjust based on GPU availability
    if (!specs.gpu.available) {
      optimized.resources = optimized.resources || 'limited';
    }
    
    logger.debug('📊 Auto-optimized requirements:', optimized);
    return optimized;
  }

  /**
   * Find the simplest model that can run on the system
   */
  private findSimplestCompatibleModel(availableModels: string[]): string | null {
    // Ordered list of models from simplest to most complex (including what's actually installed)
    const simplicityOrder = [
      'gemma:2b', 'llama3.2:latest', 'llama3.2:3b', 'qwen2.5:3b', 
      'gpt-oss:20b', 'codellama:7b', 'qwen2.5:7b', 'llama3.2:8b', 
      'gemma2:9b', 'gemma:7b', 'gemma2:27b', 'qwq:32b'
    ];
    
    logger.debug(`Looking for simple model from available: ${availableModels.join(', ')}`);
    
    for (const simple of simplicityOrder) {
      const found = availableModels.find(available => {
        const simpleBase = simple.split(':')[0];
        const availableBase = available.split(':')[0];
        return available === simple || availableBase === simpleBase || available.includes(simpleBase);
      });
      
      if (found) {
        logger.info(`📋 Selected simplest compatible model: ${found}`);
        return found;
      }
    }
    
    // Return first available model as last resort
    logger.warn('No models in simplicity order found, using first available');
    return availableModels[0] || null;
  }

  /**
   * Calculate comprehensive score including system performance
   */
  private calculateComprehensiveScore(
    model: ModelCapability,
    taskType: string,
    requirements: any
  ): number {
    let score = this.calculateModelScore(model, taskType, requirements);
    
    if (!this.systemSpecs) return score;
    
    const specs = this.systemSpecs;
    const req = model.requirements;
    
    // System compatibility bonus (0-40 points)
    let compatibilityScore = 0;
    
    // RAM efficiency bonus
    const ramEfficiency = specs.memory.available / req.minRam;
    if (ramEfficiency > 2) compatibilityScore += 15;
    else if (ramEfficiency > 1.5) compatibilityScore += 10;
    else if (ramEfficiency > 1.2) compatibilityScore += 5;
    
    // CPU compatibility bonus
    const cpuEfficiency = specs.cpu.cores / req.minCores;
    if (cpuEfficiency > 2) compatibilityScore += 10;
    else if (cpuEfficiency > 1.5) compatibilityScore += 5;
    
    // GPU acceleration bonus
    if (req.minVram && specs.gpu.available && specs.gpu.vram >= req.minVram) {
      compatibilityScore += 15;
    }
    
    score += compatibilityScore;
    
    // Current system load penalty (if high usage, prefer lighter models)
    if (specs.memory.usage > 80 && model.size === 'large') {
      score -= 20;
    } else if (specs.memory.usage > 60 && model.size === 'medium') {
      score -= 10;
    }
    
    logger.debug(`🔢 Comprehensive score for ${model.name}: ${score} (compat: +${compatibilityScore})`);
    return score;
  }

  /**
   * Get models suitable for specific task types
   */
  private getTaskSpecificModels(taskType: string): ModelCapability[] {
    const taskMappings = {
      'coding': ['coding', 'code_generation', 'debugging'],
      'analysis': ['analysis', 'reasoning', 'complex_reasoning'],
      'planning': ['planning', 'reasoning', 'complex_reasoning'],
      'chat': ['general', 'chat'],
      'debugging': ['coding', 'debugging', 'code_review'],
      'review': ['code_review', 'analysis'],
      'simple': ['simple_tasks', 'quick_help', 'simple_coding'],
      'complex': ['complex_reasoning', 'complex_coding', 'analysis']
    };
    
    const relevantTasks = taskMappings[taskType as keyof typeof taskMappings] || ['general'];
    
    return this.modelCapabilities.filter(model =>
      model.recommendedFor.some(task => relevantTasks.includes(task))
    );
  }

  /**
   * Filter models by requirements
   */
  private filterByRequirements(
    models: ModelCapability[],
    requirements: any
  ): ModelCapability[] {
    let filtered = [...models];
    
    // Speed requirements
    if (requirements.speed === 'fast') {
      filtered = filtered.filter(m => m.speed === 'fast');
    } else if (requirements.speed === 'slow') {
      // Allow medium and slow for slow requirement
      filtered = filtered.filter(m => m.speed !== 'fast');
    }
    
    // Resource constraints
    if (requirements.resources === 'limited') {
      filtered = filtered.filter(m => m.size === 'small' || m.size === 'medium');
    } else if (requirements.resources === 'unlimited') {
      // Prefer larger models for better quality
      filtered.sort((a, b) => {
        const sizeOrder = { 'small': 1, 'medium': 2, 'large': 3 };
        return sizeOrder[b.size] - sizeOrder[a.size];
      });
    }
    
    // Complexity requirements
    if (requirements.complexity === 'simple') {
      filtered = filtered.filter(m => 
        m.size === 'small' || m.speed === 'fast'
      );
    } else if (requirements.complexity === 'complex') {
      filtered = filtered.filter(m => 
        m.size === 'large' || m.strengths.includes('reasoning')
      );
    }
    
    return filtered;
  }

  /**
   * Calculate overall score for a model
   */
  private calculateModelScore(
    model: ModelCapability,
    taskType: string,
    requirements: any
  ): number {
    let score = 0;
    
    // Base suitability score (0-50)
    const taskMappings = {
      'coding': ['code generation', 'debugging', 'coding'],
      'analysis': ['reasoning', 'complex tasks', 'analysis'],
      'planning': ['reasoning', 'complex tasks'],
      'chat': ['general purpose', 'balance'],
      'simple': ['fast responses', 'lightweight']
    };
    
    const relevantStrengths = taskMappings[taskType as keyof typeof taskMappings] || [];
    const matchingStrengths = model.strengths.filter(strength =>
      relevantStrengths.some(relevant => strength.includes(relevant))
    );
    
    score += matchingStrengths.length * 10;
    
    // Performance history bonus (0-20)
    const historicalPerformance = this.getAveragePerformance(model.name, taskType);
    score += Math.min(historicalPerformance * 20, 20);
    
    // Requirements alignment (0-30)
    if (requirements.speed && model.speed === requirements.speed) score += 10;
    if (requirements.accuracy === 'high' && model.size === 'large') score += 10;
    if (requirements.resources === 'limited' && model.size === 'small') score += 10;
    
    return score;
  }

  /**
   * Get average performance for a model on specific task type
   */
  private getAveragePerformance(modelName: string, taskType: string): number {
    const key = `${modelName}-${taskType}`;
    const history = this.performanceHistory.get(key);
    
    if (!history || history.length === 0) return 0.5; // Default neutral score
    
    return history.reduce((sum, score) => sum + score, 0) / history.length;
  }

  /**
   * Record performance for a model
   */
  recordPerformance(
    modelName: string,
    taskType: string,
    success: boolean,
    duration: number = 0,
    quality: number = 1
  ): void {
    const key = `${modelName}-${taskType}`;
    
    // Calculate composite score (0-1)
    // Success contributes 50%, speed 25%, quality 25%
    let score = success ? 0.5 : 0;
    
    if (duration > 0) {
      // Normalize duration (assume 30s is baseline, faster is better)
      const speedScore = Math.max(0, Math.min(0.25, 0.25 * (30 / duration)));
      score += speedScore;
    }
    
    score += quality * 0.25;
    
    const history = this.performanceHistory.get(key) || [];
    history.push(score);
    
    // Keep only last 10 performance records
    if (history.length > 10) {
      history.shift();
    }
    
    this.performanceHistory.set(key, history);
    
    logger.debug(`📊 Recorded performance for ${modelName} on ${taskType}: ${score.toFixed(2)}`);
  }

  /**
   * Get adaptive model recommendation based on context
   */
  async getAdaptiveRecommendation(
    taskType: string,
    context: {
      urgency?: 'low' | 'medium' | 'high';
      complexity?: 'simple' | 'medium' | 'complex';
      accuracy_needed?: boolean;
      resource_constraints?: boolean;
      previous_failures?: string[];
    } = {}
  ): Promise<string> {
    
    const requirements = {
      speed: context.urgency === 'high' ? 'fast' as const : 
             context.urgency === 'low' ? 'slow' as const : 'medium' as const,
      accuracy: context.accuracy_needed ? 'high' as const : 'medium' as const,
      complexity: context.complexity || 'medium' as const,
      resources: context.resource_constraints ? 'limited' as const : 'normal' as const
    };
    
    const selectedModel = await this.selectOptimalModel(taskType, requirements);
    
    // Avoid previously failed models if specified
    if (context.previous_failures && context.previous_failures.includes(selectedModel)) {
      logger.warn(`⚠️ Avoiding previously failed model: ${selectedModel}`);
      const alternatives = await this.getAlternativeModels(selectedModel, taskType, requirements);
      return alternatives[0] || selectedModel;
    }
    
    return selectedModel;
  }

  /**
   * Get alternative models when primary choice fails
   */
  async getAlternativeModels(
    failedModel: string,
    taskType: string,
    requirements: any
  ): Promise<string[]> {
    let candidates = this.getTaskSpecificModels(taskType);
    
    // Remove failed model
    candidates = candidates.filter(model => model.name !== failedModel);
    
    // Apply filters and sort
    candidates = this.filterByRequirements(candidates, requirements);
    candidates.sort((a, b) => {
      const aScore = this.calculateModelScore(a, taskType, requirements);
      const bScore = this.calculateModelScore(b, taskType, requirements);
      return bScore - aScore;
    });
    
    return candidates.map(model => model.name);
  }

  /**
   * Monitor and auto-switch models based on performance
   */
  async autoOptimizeModelSelection(): Promise<void> {
    logger.info('🔄 Running automatic model optimization...');
    
    // Analyze performance patterns
    const taskTypes = ['coding', 'analysis', 'planning', 'chat'];
    
    for (const taskType of taskTypes) {
      const modelPerformance = new Map<string, number>();
      
      // Calculate average performance for each model
      for (const [key, history] of this.performanceHistory.entries()) {
        const [modelName, task] = key.split('-');
        
        if (task === taskType && history.length >= 3) {
          const avgPerformance = history.reduce((sum, score) => sum + score, 0) / history.length;
          modelPerformance.set(modelName, avgPerformance);
        }
      }
      
      // Identify best performing model
      if (modelPerformance.size > 0) {
        const bestModel = Array.from(modelPerformance.entries())
          .sort(([,a], [,b]) => b - a)[0];
        
        logger.info(`📈 Best performing model for ${taskType}: ${bestModel[0]} (score: ${bestModel[1].toFixed(2)})`);
      }
    }
  }

  /**
   * Export performance data for analysis
   */
  exportPerformanceData(): any {
    const data: any = {};
    
    for (const [key, history] of this.performanceHistory.entries()) {
      const [modelName, taskType] = key.split('-');
      
      if (!data[taskType]) data[taskType] = {};
      
      data[taskType][modelName] = {
        history: [...history],
        average: history.reduce((sum, score) => sum + score, 0) / history.length,
        samples: history.length
      };
    }
    
    return data;
  }
}