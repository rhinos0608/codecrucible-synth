import { exec } from 'child_process';
import { promisify } from 'util';
import { logger } from './logger.js';
import chalk from 'chalk';

const execAsync = promisify(exec);

export interface GPUInfo {
  available: boolean;
  type: 'nvidia' | 'amd' | 'intel' | 'apple' | 'cpu';
  memory?: number; // GB
  name?: string;
  driverVersion?: string;
  computeCapability?: string;
}

export interface QuantizationConfig {
  model: string;
  quantization: 'q2_k' | 'q3_k_s' | 'q3_k_m' | 'q3_k_l' | 'q4_0' | 'q4_1' | 'q4_k_s' | 'q4_k_m' | 'q5_0' | 'q5_1' | 'q5_k_s' | 'q5_k_m' | 'q6_k' | 'q8_0' | 'f16' | 'f32';
  memoryUsage: number; // GB estimate
  speed: 'fastest' | 'fast' | 'balanced' | 'quality' | 'best';
  description: string;
}

/**
 * GPU Optimizer for enhanced Ollama performance
 * Automatically detects hardware and optimizes model selection and quantization
 */
export class GPUOptimizer {
  private gpuInfo: GPUInfo | null = null;
  private quantizationMap: Map<string, QuantizationConfig[]> = new Map();
  
  constructor() {
    this.initializeQuantizationMap();
  }

  /**
   * Initialize quantization configurations for different model sizes
   */
  private initializeQuantizationMap(): void {
    // 7B models
    this.quantizationMap.set('7b', [
      { model: '7b', quantization: 'q4_k_m', memoryUsage: 4.4, speed: 'balanced', description: 'Balanced quality/speed for 7B models' },
      { model: '7b', quantization: 'q4_0', memoryUsage: 3.8, speed: 'fast', description: 'Fast inference with good quality' },
      { model: '7b', quantization: 'q3_k_m', memoryUsage: 3.2, speed: 'fastest', description: 'Fastest inference, lower quality' },
      { model: '7b', quantization: 'q5_k_m', memoryUsage: 5.1, speed: 'quality', description: 'Higher quality, slower' },
      { model: '7b', quantization: 'q8_0', memoryUsage: 7.2, speed: 'best', description: 'Best quality, slowest' }
    ]);

    // 9B models 
    this.quantizationMap.set('9b', [
      { model: '9b', quantization: 'q4_k_m', memoryUsage: 5.4, speed: 'balanced', description: 'Balanced for 9B models' },
      { model: '9b', quantization: 'q4_0', memoryUsage: 4.8, speed: 'fast', description: 'Fast 9B inference' },
      { model: '9b', quantization: 'q3_k_m', memoryUsage: 4.1, speed: 'fastest', description: 'Fastest 9B inference' }
    ]);

    // 13B models
    this.quantizationMap.set('13b', [
      { model: '13b', quantization: 'q4_k_m', memoryUsage: 7.8, speed: 'balanced', description: 'Balanced for 13B models' },
      { model: '13b', quantization: 'q4_0', memoryUsage: 6.9, speed: 'fast', description: 'Fast 13B inference' },
      { model: '13b', quantization: 'q3_k_m', memoryUsage: 5.8, speed: 'fastest', description: 'Fastest 13B inference' }
    ]);

    // 27B+ models
    this.quantizationMap.set('27b+', [
      { model: '27b+', quantization: 'q3_k_m', memoryUsage: 12.0, speed: 'fastest', description: 'Only fast option for large models' },
      { model: '27b+', quantization: 'q4_0', memoryUsage: 15.0, speed: 'fast', description: 'Higher quality large models' }
    ]);
  }

  /**
   * Detect GPU capabilities and optimize Ollama configuration
   */
  async detectAndOptimizeGPU(): Promise<GPUInfo> {
    if (this.gpuInfo) return this.gpuInfo;

    logger.info('🔍 Detecting GPU capabilities...');
    
    try {
      // Check for NVIDIA GPU
      const nvidiaInfo = await this.detectNVIDIA();
      if (nvidiaInfo.available) {
        this.gpuInfo = nvidiaInfo;
        await this.optimizeForNVIDIA(nvidiaInfo);
        return this.gpuInfo;
      }

      // Check for AMD GPU
      const amdInfo = await this.detectAMD();
      if (amdInfo.available) {
        this.gpuInfo = amdInfo;
        await this.optimizeForAMD(amdInfo);
        return this.gpuInfo;
      }

      // Check for Apple Silicon
      const appleInfo = await this.detectAppleSilicon();
      if (appleInfo.available) {
        this.gpuInfo = appleInfo;
        await this.optimizeForApple(appleInfo);
        return this.gpuInfo;
      }

      // Fallback to CPU
      this.gpuInfo = { available: false, type: 'cpu' };
      await this.optimizeForCPU();
      
    } catch (error) {
      logger.warn('GPU detection failed, using CPU fallback:', error);
      this.gpuInfo = { available: false, type: 'cpu' };
    }

    return this.gpuInfo;
  }

  /**
   * Detect NVIDIA GPU
   */
  private async detectNVIDIA(): Promise<GPUInfo> {
    try {
      const { stdout } = await execAsync('nvidia-smi --query-gpu=name,memory.total,driver_version --format=csv,noheader,nounits');
      const lines = stdout.trim().split('\n');
      if (lines.length > 0 && !lines[0].includes('command not found')) {
        const [name, memory, driver] = lines[0].split(',').map(s => s.trim());
        logger.info(`🎮 NVIDIA GPU detected: ${name} (${memory}MB VRAM)`);
        
        return {
          available: true,
          type: 'nvidia',
          name,
          memory: Math.floor(parseInt(memory) / 1024), // Convert to GB
          driverVersion: driver
        };
      }
    } catch (error) {
      // nvidia-smi not available
    }
    
    return { available: false, type: 'cpu' };
  }

  /**
   * Detect AMD GPU  
   */
  private async detectAMD(): Promise<GPUInfo> {
    try {
      // Check for ROCm on Linux/Windows
      const { stdout } = await execAsync('rocm-smi --showmeminfo vram --csv');
      if (stdout && !stdout.includes('command not found')) {
        logger.info('🔴 AMD GPU with ROCm detected');
        return {
          available: true,
          type: 'amd',
          name: 'AMD GPU (ROCm)',
          memory: 8 // Estimate, ROCm detection is complex
        };
      }
    } catch (error) {
      // ROCm not available
    }
    
    return { available: false, type: 'cpu' };
  }

  /**
   * Detect Apple Silicon
   */
  private async detectAppleSilicon(): Promise<GPUInfo> {
    try {
      if (process.platform === 'darwin') {
        const { stdout } = await execAsync('system_profiler SPHardwareDataType');
        if (stdout.includes('Apple M1') || stdout.includes('Apple M2') || stdout.includes('Apple M3') || stdout.includes('Apple M4')) {
          const chipMatch = stdout.match(/Chip: (Apple M\d+[^\\n]*)/);
          const memoryMatch = stdout.match(/Memory: (\d+) GB/);
          
          logger.info(`🍎 Apple Silicon detected: ${chipMatch?.[1] || 'Apple Silicon'}`);
          
          return {
            available: true,
            type: 'apple',
            name: chipMatch?.[1] || 'Apple Silicon',
            memory: memoryMatch ? parseInt(memoryMatch[1]) : 16 // Default to 16GB
          };
        }
      }
    } catch (error) {
      // macOS detection failed
    }
    
    return { available: false, type: 'cpu' };
  }

  /**
   * Optimize Ollama for NVIDIA GPU
   */
  private async optimizeForNVIDIA(gpu: GPUInfo): Promise<void> {
    logger.info('⚡ Optimizing for NVIDIA GPU acceleration...');
    
    // Set CUDA environment variables for optimal performance
    process.env.CUDA_VISIBLE_DEVICES = '0';
    process.env.OLLAMA_GPU_LAYERS = '99'; // Use maximum GPU layers
    process.env.OLLAMA_FLASH_ATTENTION = '1'; // Enable flash attention if available
    
    // Optimize memory usage based on VRAM
    if (gpu.memory && gpu.memory >= 12) {
      process.env.OLLAMA_GPU_MEMORY_FRACTION = '0.9'; // Use 90% of VRAM
      process.env.OLLAMA_CONTEXT_SIZE = '8192'; // Larger context for more VRAM
      logger.info('🚀 High VRAM detected: Using optimized settings for large models');
    } else if (gpu.memory && gpu.memory >= 8) {
      process.env.OLLAMA_GPU_MEMORY_FRACTION = '0.8'; // Use 80% of VRAM
      process.env.OLLAMA_CONTEXT_SIZE = '20000'; // Expanded context
      logger.info('⚡ Medium VRAM detected: Using balanced settings');
    } else {
      process.env.OLLAMA_GPU_MEMORY_FRACTION = '0.7'; // Use 70% of VRAM
      process.env.OLLAMA_CONTEXT_SIZE = '2048'; // Smaller context for limited VRAM
      logger.info('⚠️ Limited VRAM detected: Using conservative settings');
    }
  }

  /**
   * Optimize Ollama for AMD GPU
   */
  private async optimizeForAMD(gpu: GPUInfo): Promise<void> {
    logger.info('🔴 Optimizing for AMD GPU (ROCm) acceleration...');
    
    process.env.HSA_OVERRIDE_GFX_VERSION = '10.3.0'; // Common compatibility setting
    process.env.OLLAMA_GPU_LAYERS = '50'; // Conservative GPU layers for AMD
    process.env.OLLAMA_CONTEXT_SIZE = '20000';
  }

  /**
   * Optimize Ollama for Apple Silicon
   */
  private async optimizeForApple(gpu: GPUInfo): Promise<void> {
    logger.info('🍎 Optimizing for Apple Silicon Metal acceleration...');
    
    process.env.OLLAMA_GPU_LAYERS = '99'; // Apple Silicon handles this well
    process.env.OLLAMA_METAL = '1'; // Enable Metal acceleration
    
    // Optimize based on unified memory
    if (gpu.memory && gpu.memory >= 32) {
      process.env.OLLAMA_CONTEXT_SIZE = '8192'; // Large context for high memory
      logger.info('🚀 High memory Apple Silicon: Using optimized settings');
    } else {
      process.env.OLLAMA_CONTEXT_SIZE = '20000'; // Expanded context
    }
  }

  /**
   * Optimize Ollama for CPU-only operation
   */
  private async optimizeForCPU(): Promise<void> {
    logger.info('🖥️ Optimizing for CPU-only operation...');
    
    process.env.OLLAMA_NUM_THREADS = String(Math.max(1, Math.floor(require('os').cpus().length * 0.8)));
    process.env.OLLAMA_CONTEXT_SIZE = '2048'; // Smaller context for CPU
    delete process.env.OLLAMA_GPU_LAYERS; // Ensure no GPU layers are used
  }

  /**
   * Get optimal quantization for model and hardware
   */
  getOptimalQuantization(modelName: string, priority: 'speed' | 'balanced' | 'quality' = 'balanced'): QuantizationConfig | null {
    const modelSize = this.extractModelSize(modelName);
    const configs = this.quantizationMap.get(modelSize);
    
    if (!configs) return null;

    // Filter based on available memory
    const availableMemory = this.getAvailableMemory();
    const suitableConfigs = configs.filter(config => config.memoryUsage <= availableMemory);
    
    if (suitableConfigs.length === 0) {
      // Return the most memory-efficient option
      return configs.reduce((min, config) => config.memoryUsage < min.memoryUsage ? config : min);
    }

    // Select based on priority
    switch (priority) {
      case 'speed':
        return suitableConfigs.find(c => c.speed === 'fastest') || suitableConfigs[0];
      case 'quality':
        return suitableConfigs.find(c => c.speed === 'best') || 
               suitableConfigs.find(c => c.speed === 'quality') || 
               suitableConfigs[suitableConfigs.length - 1];
      case 'balanced':
      default:
        return suitableConfigs.find(c => c.speed === 'balanced') || suitableConfigs[0];
    }
  }

  /**
   * Extract model size from model name
   */
  private extractModelSize(modelName: string): string {
    const lowerName = modelName.toLowerCase();
    
    if (lowerName.includes('72b') || lowerName.includes('70b') || lowerName.includes('32b') || lowerName.includes('27b')) {
      return '27b+';
    }
    if (lowerName.includes('13b') || lowerName.includes('15b')) {
      return '13b';
    }
    if (lowerName.includes('9b')) {
      return '9b';
    }
    if (lowerName.includes('7b') || lowerName.includes('8b')) {
      return '7b';
    }
    
    // Default to 7b for unknown sizes
    return '7b';
  }

  /**
   * Get available memory for model loading
   */
  private getAvailableMemory(): number {
    if (!this.gpuInfo || !this.gpuInfo.available) {
      // CPU: Use system RAM estimate (conservative)
      const totalRam = require('os').totalmem() / (1024 * 1024 * 1024); // GB
      return Math.floor(totalRam * 0.3); // Use 30% of system RAM
    }

    // GPU: Use VRAM
    return this.gpuInfo.memory || 8; // Default to 8GB if unknown
  }

  /**
   * Get recommended models based on hardware
   */
  getRecommendedModels(): string[] {
    const availableMemory = this.getAvailableMemory();
    
    if (availableMemory >= 24) {
      return ['qwen2.5:32b', 'llama3.1:70b', 'codellama:34b', 'gemma2:27b'];
    } else if (availableMemory >= 12) {
      return ['codellama:13b', 'llama3.1:13b', 'gemma2:9b', 'qwen2.5:14b'];
    } else if (availableMemory >= 6) {
      return ['gemma2:9b', 'llama3.2:8b', 'qwen2.5:7b', 'codellama:7b'];
    } else {
      return ['gemma:2b', 'phi3:mini', 'tinyllama:1.1b'];
    }
  }

  /**
   * Apply quantization optimizations to a model name
   */
  optimizeModelName(modelName: string, priority: 'speed' | 'balanced' | 'quality' = 'balanced'): string {
    const config = this.getOptimalQuantization(modelName, priority);
    
    if (!config) return modelName;

    // Check if model name already has quantization
    if (modelName.includes(':') && (modelName.includes('q') || modelName.includes('f16') || modelName.includes('f32'))) {
      return modelName; // Already quantized
    }

    // Add optimal quantization
    const baseName = modelName.split(':')[0];
    const tag = modelName.split(':')[1] || 'latest';
    
    return `${baseName}:${tag}-${config.quantization}`;
  }

  /**
   * Get performance summary
   */
  getPerformanceSummary(): string {
    if (!this.gpuInfo) return 'Hardware not detected';

    if (!this.gpuInfo.available) {
      return chalk.yellow('🖥️ CPU-only operation (consider GPU for faster inference)');
    }

    const memoryInfo = this.gpuInfo.memory ? `${this.gpuInfo.memory}GB` : 'Unknown';
    const typeIcon = {
      'nvidia': '🎮',
      'amd': '🔴', 
      'apple': '🍎',
      'intel': '🔵',
      'cpu': '🖥️'
    }[this.gpuInfo.type];

    return chalk.green(`${typeIcon} ${this.gpuInfo.name || this.gpuInfo.type.toUpperCase()} GPU acceleration enabled (${memoryInfo})`);
  }
}