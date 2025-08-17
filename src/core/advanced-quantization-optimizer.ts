import { logger } from './logger.js';
import axios from 'axios';
import { exec } from 'child_process';
import { promisify } from 'util';
import { SystemBenchmark, SystemBenchmarkResult } from './system-benchmark.js';

const execAsync = promisify(exec);

/**
 * Advanced Quantization Optimizer
 * 
 * Implements state-of-the-art quantization strategies based on research:
 * - Dynamic quantization selection based on hardware
 * - K-quantization (Q4_K_M, Q6_K) for optimal quality/speed balance  
 * - GGUF optimization strategies
 * - Hardware-aware quantization levels
 * - Memory-efficient loading patterns
 */
export class AdvancedQuantizationOptimizer {
  private endpoint: string;
  private systemCapabilities: SystemCapabilities | null = null;
  private benchmarkResult: SystemBenchmarkResult | null = null;
  private quantizationCache = new Map<string, QuantizationRecommendation>();
  private performanceMetrics = new Map<string, PerformanceMetric[]>();

  constructor(endpoint: string) {
    this.endpoint = endpoint;
    this.initializeSystemCapabilities();
  }

  /**
   * Get optimal quantization for a model based on hardware and use case
   */
  async getOptimalQuantization(modelName: string, useCase: UseCase): Promise<QuantizationRecommendation> {
    const cacheKey = `${modelName}-${useCase}`;
    
    if (this.quantizationCache.has(cacheKey)) {
      return this.quantizationCache.get(cacheKey)!;
    }

    await this.ensureSystemCapabilities();
    const recommendation = this.calculateQuantizationRecommendation(modelName, useCase);
    
    this.quantizationCache.set(cacheKey, recommendation);
    return recommendation;
  }

  /**
   * Calculate the best quantization strategy based on REAL BENCHMARK RESULTS
   */
  private calculateQuantizationRecommendation(modelName: string, useCase: UseCase): QuantizationRecommendation {
    if (!this.systemCapabilities) {
      return this.getFallbackQuantization();
    }

    // Use benchmark results if available for OPTIMAL configuration
    if (this.benchmarkResult) {
      const optimal = this.benchmarkResult.ollamaOptimal;
      
      logger.info(`🎯 Using BENCHMARK-OPTIMIZED configuration for ${modelName}`);
      
      return {
        quantization: optimal.optimalQuantization,
        kvCacheQuantization: optimal.optimalQuantization.includes('Q6') ? 'f16' : 'q8_0',
        gpuLayers: optimal.maxGpuLayers,
        contextLength: optimal.maxContextLength,
        batchSize: optimal.batchSize,
        flashAttention: this.benchmarkResult.gpu.totalVRAM >= 8,
        lowVRAMMode: this.benchmarkResult.gpu.totalVRAM < 8,
        estimatedVRAMUsage: this.benchmarkResult.gpu.availableVRAM * 0.8,
        qualityScore: optimal.optimalQuantization === 'Q6_K' ? 90 : 
                     optimal.optimalQuantization === 'Q4_K_M' ? 75 : 60,
        speedScore: optimal.parallelProcessing ? 95 : 80,
        reasoning: `Benchmark-optimized for ${this.benchmarkResult.gpu.name} with ${this.benchmarkResult.gpu.totalVRAM}GB VRAM`
      };
    }

    // Fallback to legacy detection
    const { availableVRAM, systemRAM, cpuCores, hasGPU } = this.systemCapabilities;
    const modelSize = this.estimateModelSize(modelName);

    // Advanced quantization selection algorithm based on research
    let quantization: string;
    let kvCacheQuantization: string;
    let gpuLayers: number;
    let contextLength: number;
    let batchSize: number;

    if (!hasGPU || availableVRAM < 4) {
      // CPU-only optimization - prioritize speed over quality
      quantization = 'Q4_0'; // Fastest for CPU
      kvCacheQuantization = 'q4_0';
      gpuLayers = 0;
      contextLength = Math.min(16384, systemRAM > 16 ? 22528 : 14336);
      batchSize = systemRAM > 16 ? 1024 : 512;
    } else if (availableVRAM >= 12 && modelSize <= 7) {
      // High VRAM - can use better quality quantization
      quantization = 'Q6_K'; // High quality K-quantization
      kvCacheQuantization = 'f16'; // Full precision cache
      gpuLayers = -1; // All layers on GPU
      contextLength = useCase === 'coding' ? 16384 : 22528;
      batchSize = 2048;
    } else if (availableVRAM >= 8) {
      // Medium VRAM - balanced approach
      quantization = 'Q4_K_M'; // Medium K-quantization (best balance)
      kvCacheQuantization = 'q8_0'; // 8-bit cache quantization
      gpuLayers = this.calculateOptimalGPULayers(modelSize, availableVRAM);
      contextLength = useCase === 'coding' ? 14336 : 16384;
      batchSize = 1536;
    } else {
      // Low VRAM - aggressive optimization
      quantization = 'Q4_K_S'; // Small K-quantization
      kvCacheQuantization = 'q4_0'; // Aggressive cache quantization
      gpuLayers = Math.floor(availableVRAM / 2); // Conservative GPU usage
      contextLength = 14336;
      batchSize = 1024;
    }

    // Additional optimizations based on use case
    if (useCase === 'coding') {
      // Coding needs higher context but can sacrifice some speed
      contextLength = Math.min(contextLength * 1.5, 22528);
      if (quantization === 'Q4_0') quantization = 'Q4_K_M'; // Better quality for code
    } else if (useCase === 'chat') {
      // Chat prioritizes responsiveness
      batchSize = Math.max(batchSize * 0.75, 512);
    }

    const recommendation: QuantizationRecommendation = {
      quantization,
      kvCacheQuantization,
      gpuLayers,
      contextLength,
      batchSize,
      flashAttention: availableVRAM >= 6,
      lowVRAMMode: availableVRAM < 8,
      estimatedVRAMUsage: this.estimateVRAMUsage(modelSize, quantization, contextLength),
      qualityScore: this.calculateQualityScore(quantization),
      speedScore: this.calculateSpeedScore(quantization, gpuLayers),
      reasoning: this.generateRecommendationReasoning(quantization, kvCacheQuantization, gpuLayers)
    };

    logger.info(`🎯 Quantization recommendation for ${modelName}:`, {
      quantization: recommendation.quantization,
      kvCache: recommendation.kvCacheQuantization,
      gpuLayers: recommendation.gpuLayers,
      context: recommendation.contextLength,
      qualityScore: recommendation.qualityScore,
      speedScore: recommendation.speedScore
    });

    return recommendation;
  }

  /**
   * Calculate optimal GPU layers based on available VRAM and model size
   */
  private calculateOptimalGPULayers(modelSizeB: number, availableVRAM: number): number {
    // Estimation: 7B model ≈ 4GB in Q4_K_M, 13B ≈ 8GB, etc.
    const vramPerBillion = 0.6; // GB per billion parameters in Q4_K_M
    const modelVRAMUsage = modelSizeB * vramPerBillion;
    
    if (modelVRAMUsage <= availableVRAM * 0.8) {
      return -1; // All layers on GPU
    }
    
    // Partial offloading - calculate how many layers fit
    const totalLayers = modelSizeB <= 7 ? 32 : modelSizeB <= 13 ? 40 : 80;
    const layerVRAM = modelVRAMUsage / totalLayers;
    const maxLayers = Math.floor((availableVRAM * 0.8) / layerVRAM);
    
    return Math.max(0, maxLayers);
  }

  /**
   * Advanced system capability detection with AUTOMATIC BENCHMARKING
   */
  private static benchmarkPromise: Promise<SystemBenchmarkResult> | null = null;
  
  private async initializeSystemCapabilities(): Promise<void> {
    try {
      // Use singleton pattern to prevent multiple simultaneous benchmarks
      if (!AdvancedQuantizationOptimizer.benchmarkPromise) {
        logger.info('🔍 Running automatic system benchmark for optimal performance...');
        const benchmark = new SystemBenchmark(this.endpoint);
        AdvancedQuantizationOptimizer.benchmarkPromise = benchmark.runBenchmark();
      }
      
      // Run comprehensive benchmark automatically
      this.benchmarkResult = await AdvancedQuantizationOptimizer.benchmarkPromise;
      
      // Convert benchmark to legacy format for compatibility
      this.systemCapabilities = {
        availableVRAM: this.benchmarkResult.gpu.availableVRAM,
        systemRAM: this.benchmarkResult.memory.totalRAM,
        cpuCores: this.benchmarkResult.cpu.cores,
        hasGPU: this.benchmarkResult.gpu.totalVRAM > 0,
        gpuType: this.benchmarkResult.gpu.name
      };

      logger.info(`🚀 AUTOMATIC BENCHMARK COMPLETE:`, {
        cpu: `${this.benchmarkResult.cpu.cores} cores @ ${this.benchmarkResult.cpu.baseFrequency}MHz`,
        memory: `${this.benchmarkResult.memory.totalRAM}GB total, ${this.benchmarkResult.memory.availableRAM}GB available`,
        gpu: `${this.benchmarkResult.gpu.name} with ${this.benchmarkResult.gpu.totalVRAM}GB VRAM (${this.benchmarkResult.gpu.availableVRAM}GB available)`,
        optimal: `${this.benchmarkResult.ollamaOptimal.maxContextLength} context, ${this.benchmarkResult.ollamaOptimal.optimalQuantization} quant`
      });

    } catch (error) {
      logger.warn('Automatic benchmark failed, using fallback detection:', error);
      this.systemCapabilities = this.getFallbackCapabilities();
    }
  }

  /**
   * Detect available VRAM using multiple methods
   */
  private async detectVRAM(): Promise<number> {
    try {
      // Method 1: Try nvidia-ml-py via subprocess
      try {
        const { stdout } = await execAsync('nvidia-smi --query-gpu=memory.free --format=csv,noheader,nounits');
        const freeMemoryMB = parseInt(stdout.trim());
        if (!isNaN(freeMemoryMB)) {
          return Math.floor(freeMemoryMB / 1024); // Convert MB to GB
        }
      } catch (e) {
        // nvidia-smi not available or failed
      }

      // Method 2: Check Ollama GPU status
      try {
        const response = await axios.get(`${this.endpoint}/api/ps`, { timeout: 5000 });
        // Parse Ollama's GPU information from loaded models
        if (response.data && response.data.models) {
          // Estimate based on system RAM (fallback)
          const os = await import('os');
          const totalRAM = os.totalmem() / (1024 * 1024 * 1024);
          
          if (totalRAM >= 32) return 12; // High-end system
          if (totalRAM >= 16) return 8;  // Mid-range system
          return 6; // Entry-level system
        }
      } catch (e) {
        // Ollama not available
      }

      // Method 3: Conservative estimation based on system memory
      const os = await import('os');
      const totalRAM = os.totalmem() / (1024 * 1024 * 1024);
      return totalRAM >= 32 ? 8 : totalRAM >= 16 ? 6 : 4;

    } catch (error) {
      logger.debug('VRAM detection failed, using conservative estimate');
      return 6; // Conservative default
    }
  }

  /**
   * Detect system RAM
   */
  private async detectSystemRAM(): Promise<number> {
    try {
      const os = await import('os');
      return Math.round(os.totalmem() / (1024 * 1024 * 1024));
    } catch (error) {
      return 16; // Default assumption
    }
  }

  /**
   * Detect CPU cores
   */
  private async detectCPUCores(): Promise<number> {
    try {
      const os = await import('os');
      return os.cpus().length;
    } catch (error) {
      return 4; // Default assumption
    }
  }

  /**
   * Detect GPU type
   */
  private async detectGPUType(): Promise<string> {
    try {
      const { stdout } = await execAsync('nvidia-smi --query-gpu=name --format=csv,noheader');
      const gpuName = stdout.trim();
      if (gpuName.includes('RTX')) return 'nvidia';
      if (gpuName.includes('GTX')) return 'nvidia';
      return 'nvidia';
    } catch (error) {
      return 'unknown';
    }
  }

  /**
   * Get CPU frequency
   */
  private async detectCPUFrequency(): Promise<number> {
    try {
      const os = await import('os');
      const cpus = os.cpus();
      return cpus[0]?.speed || 3000; // MHz
    } catch (error) {
      return 3000; // Default
    }
  }

  /**
   * Get current memory usage percentage
   */
  private async getMemoryUsage(): Promise<number> {
    try {
      const os = await import('os');
      const total = os.totalmem();
      const free = os.freemem();
      return Math.round(((total - free) / total) * 100);
    } catch (error) {
      return 50; // Default
    }
  }

  /**
   * Estimate model size in billions of parameters
   */
  private estimateModelSize(modelName: string): number {
    const name = modelName.toLowerCase();
    
    if (name.includes('7b')) return 7;
    if (name.includes('8b')) return 8;
    if (name.includes('13b')) return 13;
    if (name.includes('20b')) return 20;
    if (name.includes('27b')) return 27;
    if (name.includes('34b')) return 34;
    if (name.includes('70b')) return 70;
    
    // Guess based on common patterns
    if (name.includes('3.2')) return 3.2;
    if (name.includes('gemma2')) return 9;
    if (name.includes('qwq')) return 32;
    
    return 7; // Default assumption
  }

  /**
   * Estimate VRAM usage for a given configuration
   */
  private estimateVRAMUsage(modelSizeB: number, quantization: string, contextLength: number): number {
    // Base model memory usage (GB)
    let baseMemory: number;
    
    switch (quantization) {
      case 'Q4_0': baseMemory = modelSizeB * 0.5; break;
      case 'Q4_K_S': baseMemory = modelSizeB * 0.55; break;
      case 'Q4_K_M': baseMemory = modelSizeB * 0.6; break;
      case 'Q5_K_S': baseMemory = modelSizeB * 0.7; break;
      case 'Q5_K_M': baseMemory = modelSizeB * 0.75; break;
      case 'Q6_K': baseMemory = modelSizeB * 0.9; break;
      case 'Q8_0': baseMemory = modelSizeB * 1.1; break;
      case 'F16': baseMemory = modelSizeB * 2.0; break;
      default: baseMemory = modelSizeB * 0.6;
    }

    // Context memory (approximate)
    const contextMemory = (contextLength * modelSizeB * 0.0001); // Very rough estimate
    
    return baseMemory + contextMemory;
  }

  /**
   * Calculate quality score for quantization
   */
  private calculateQualityScore(quantization: string): number {
    const qualityMap: Record<string, number> = {
      'F16': 100,
      'Q8_0': 95,
      'Q6_K': 90,
      'Q5_K_M': 85,
      'Q5_K_S': 80,
      'Q4_K_M': 75,
      'Q4_K_S': 70,
      'Q4_0': 60
    };
    
    return qualityMap[quantization] || 70;
  }

  /**
   * Calculate speed score for configuration
   */
  private calculateSpeedScore(quantization: string, gpuLayers: number): number {
    const quantSpeedMap: Record<string, number> = {
      'Q4_0': 100,
      'Q4_K_S': 95,
      'Q4_K_M': 90,
      'Q5_K_S': 80,
      'Q5_K_M': 75,
      'Q6_K': 70,
      'Q8_0': 60,
      'F16': 50
    };
    
    const baseSpeed = quantSpeedMap[quantization] || 70;
    
    // GPU acceleration bonus
    if (gpuLayers === -1) return Math.min(baseSpeed * 1.5, 100);
    if (gpuLayers > 0) return Math.min(baseSpeed * 1.2, 100);
    
    return baseSpeed;
  }

  /**
   * Generate human-readable reasoning for recommendation
   */
  private generateRecommendationReasoning(quantization: string, kvCache: string, gpuLayers: number): string {
    const parts = [];
    
    parts.push(`Selected ${quantization} quantization`);
    
    if (quantization.includes('K')) {
      parts.push('(K-quantization for optimal quality/speed balance)');
    }
    
    if (kvCache !== 'f16') {
      parts.push(`with ${kvCache} K/V cache quantization for memory efficiency`);
    }
    
    if (gpuLayers === -1) {
      parts.push('using full GPU acceleration');
    } else if (gpuLayers > 0) {
      parts.push(`using ${gpuLayers} GPU layers with CPU fallback`);
    } else {
      parts.push('using CPU-only inference for memory constraints');
    }
    
    return parts.join(' ');
  }

  /**
   * Get fallback quantization for unknown systems
   */
  private getFallbackQuantization(): QuantizationRecommendation {
    return {
      quantization: 'Q4_K_M',
      kvCacheQuantization: 'q8_0',
      gpuLayers: 20,
      contextLength: 16384,
      batchSize: 1024,
      flashAttention: true,
      lowVRAMMode: true,
      estimatedVRAMUsage: 6,
      qualityScore: 75,
      speedScore: 80,
      reasoning: 'Conservative fallback configuration for unknown system'
    };
  }

  /**
   * Get fallback system capabilities
   */
  private getFallbackCapabilities(): SystemCapabilities {
    return {
      availableVRAM: 6,
      systemRAM: 16,
      cpuCores: 6,
      hasGPU: true,
      gpuType: 'unknown'
    };
  }

  /**
   * Ensure system capabilities are detected
   */
  private async ensureSystemCapabilities(): Promise<void> {
    if (!this.systemCapabilities) {
      await this.initializeSystemCapabilities();
    }
  }

  /**
   * Track performance metrics for continuous optimization
   */
  recordPerformanceMetric(modelName: string, metric: PerformanceMetric): void {
    if (!this.performanceMetrics.has(modelName)) {
      this.performanceMetrics.set(modelName, []);
    }
    
    const metrics = this.performanceMetrics.get(modelName)!;
    metrics.push(metric);
    
    // Keep only last 10 measurements
    if (metrics.length > 10) {
      metrics.shift();
    }
  }

  /**
   * Get performance insights for a model
   */
  getPerformanceInsights(modelName: string): PerformanceInsights | null {
    const metrics = this.performanceMetrics.get(modelName);
    if (!metrics || metrics.length === 0) return null;

    const avgTokensPerSecond = metrics.reduce((sum, m) => sum + m.tokensPerSecond, 0) / metrics.length;
    const avgMemoryUsage = metrics.reduce((sum, m) => sum + m.memoryUsageGB, 0) / metrics.length;
    const avgLatency = metrics.reduce((sum, m) => sum + m.latencyMs, 0) / metrics.length;

    return {
      averageTokensPerSecond: avgTokensPerSecond,
      averageMemoryUsage: avgMemoryUsage,
      averageLatency: avgLatency,
      sampleCount: metrics.length,
      trend: metrics.length > 1 ? this.calculateTrend(metrics) : 'stable'
    };
  }

  /**
   * Calculate performance trend
   */
  private calculateTrend(metrics: PerformanceMetric[]): 'improving' | 'declining' | 'stable' {
    if (metrics.length < 3) return 'stable';
    
    const recent = metrics.slice(-3);
    const older = metrics.slice(-6, -3);
    
    if (older.length === 0) return 'stable';
    
    const recentAvg = recent.reduce((sum, m) => sum + m.tokensPerSecond, 0) / recent.length;
    const olderAvg = older.reduce((sum, m) => sum + m.tokensPerSecond, 0) / older.length;
    
    const change = (recentAvg - olderAvg) / olderAvg;
    
    if (change > 0.1) return 'improving';
    if (change < -0.1) return 'declining';
    return 'stable';
  }
}

// Type definitions
export interface SystemCapabilities {
  availableVRAM: number;
  systemRAM: number;
  cpuCores: number;
  hasGPU: boolean;
  gpuType: string;
}

export interface QuantizationRecommendation {
  quantization: string;
  kvCacheQuantization: string;
  gpuLayers: number;
  contextLength: number;
  batchSize: number;
  flashAttention: boolean;
  lowVRAMMode: boolean;
  estimatedVRAMUsage: number;
  qualityScore: number;
  speedScore: number;
  reasoning: string;
}

export interface PerformanceMetric {
  tokensPerSecond: number;
  memoryUsageGB: number;
  latencyMs: number;
  timestamp: number;
}

export interface PerformanceInsights {
  averageTokensPerSecond: number;
  averageMemoryUsage: number;
  averageLatency: number;
  sampleCount: number;
  trend: 'improving' | 'declining' | 'stable';
}

export type UseCase = 'coding' | 'chat' | 'analysis' | 'writing' | 'reasoning';