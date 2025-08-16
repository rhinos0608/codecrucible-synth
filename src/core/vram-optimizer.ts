import { logger } from './logger.js';
import { AdvancedQuantizationOptimizer, QuantizationRecommendation as AdvancedQuantizationRecommendation, UseCase } from './advanced-quantization-optimizer.js';
import axios from 'axios';

/**
 * VRAM Optimizer for running large models on limited GPU memory
 * 
 * Implements multiple strategies:
 * - Dynamic layer offloading (CPU/GPU balancing)
 * - K/V cache quantization
 * - Context window optimization
 * - Quantization level selection
 * - Memory-aware model loading
 */
export class VRAMOptimizer {
  private estimatedVRAM: number = 12; // GB, default for RTX 4070 SUPER
  private availableVRAM: number = 8; // Conservative estimate for available VRAM
  private systemRAM: number = 32; // GB
  private endpoint: string;
  private quantizationOptimizer: AdvancedQuantizationOptimizer;
  private optimizationCache = new Map<string, OptimizationConfig>();

  constructor(endpoint: string) {
    this.endpoint = endpoint;
    this.quantizationOptimizer = new AdvancedQuantizationOptimizer(endpoint);
    this.detectSystemCapabilities();
  }

  /**
   * Detect system capabilities for VRAM optimization
   */
  private async detectSystemCapabilities(): Promise<void> {
    try {
      // Try to get system memory info
      const os = await import('os');
      this.systemRAM = Math.round(os.totalmem() / (1024 * 1024 * 1024));
      
      // Conservative VRAM estimation based on common GPUs
      if (this.systemRAM >= 32) {
        this.estimatedVRAM = 12; // Likely RTX 4070+ class
        this.availableVRAM = 8;  // Conservative available after OS/other apps
      } else if (this.systemRAM >= 16) {
        this.estimatedVRAM = 8;  // Likely RTX 3070/4060 class
        this.availableVRAM = 6;
      } else {
        this.estimatedVRAM = 6;  // Entry level GPU
        this.availableVRAM = 4;
      }

      logger.info(`🔍 Detected system: ${this.systemRAM}GB RAM, estimated ${this.estimatedVRAM}GB VRAM`);
    } catch (error) {
      logger.debug('Could not detect system capabilities, using defaults');
    }
  }

  /**
   * Calculate optimal layer offloading for a model
   */
  calculateOptimalLayerOffloading(modelInfo: ModelInfo): LayerOffloadingConfig {
    const {
      totalLayers,
      parameterCount,
      quantization,
      contextLength = 4096
    } = modelInfo;

    // Estimate memory requirements
    const modelMemoryGB = this.estimateModelMemory(parameterCount, quantization);
    const contextMemoryGB = this.estimateContextMemory(contextLength, parameterCount);
    const totalMemoryGB = modelMemoryGB + contextMemoryGB;

    logger.info(`📊 Model memory estimation: ${modelMemoryGB.toFixed(1)}GB model + ${contextMemoryGB.toFixed(1)}GB context = ${totalMemoryGB.toFixed(1)}GB total`);

    // Calculate optimal GPU layer count
    let gpuLayers = totalLayers;
    let cpuLayers = 0;

    if (totalMemoryGB > this.availableVRAM) {
      // Need to offload some layers to CPU
      const memoryPerLayer = modelMemoryGB / totalLayers;
      const maxGPULayers = Math.floor((this.availableVRAM - contextMemoryGB) / memoryPerLayer);
      
      gpuLayers = Math.max(0, Math.min(maxGPULayers, totalLayers));
      cpuLayers = totalLayers - gpuLayers;

      logger.info(`⚖️  Memory balancing: ${gpuLayers} GPU layers + ${cpuLayers} CPU layers`);
    } else {
      logger.info(`✅ Full GPU loading: All ${totalLayers} layers fit in VRAM`);
    }

    return {
      gpuLayers,
      cpuLayers,
      totalLayers,
      estimatedGPUMemory: modelMemoryGB * (gpuLayers / totalLayers) + contextMemoryGB,
      estimatedCPUMemory: modelMemoryGB * (cpuLayers / totalLayers),
      canFullyOffload: gpuLayers === totalLayers
    };
  }

  /**
   * Get K/V cache quantization recommendations
   */
  getKVCacheQuantizationConfig(contextLength: number, modelSize: number): KVCacheConfig {
    const contextMemoryF16 = this.estimateContextMemory(contextLength, modelSize);
    
    // Determine best quantization level based on available VRAM
    let quantizationType: 'f16' | 'q8_0' | 'q4_0' = 'f16';
    let memoryReduction = 1.0;

    if (contextMemoryF16 > this.availableVRAM * 0.4) { // Context uses >40% of available VRAM
      if (contextMemoryF16 > this.availableVRAM * 0.6) {
        quantizationType = 'q4_0';
        memoryReduction = 0.33; // 67% reduction
        logger.info(`🗜️  Using Q4_0 K/V cache quantization for maximum VRAM savings`);
      } else {
        quantizationType = 'q8_0';
        memoryReduction = 0.5; // 50% reduction
        logger.info(`🗜️  Using Q8_0 K/V cache quantization for balanced quality/memory`);
      }
    } else {
      logger.info(`📝 Using F16 K/V cache (sufficient VRAM available)`);
    }

    return {
      quantizationType,
      estimatedMemoryGB: contextMemoryF16 * memoryReduction,
      memoryReduction,
      qualityImpact: quantizationType === 'q4_0' ? 'noticeable' : 'minimal'
    };
  }

  /**
   * Select optimal quantization for available VRAM
   */
  selectOptimalQuantization(parameterCount: number, targetVRAM?: number): LegacyQuantizationRecommendation {
    const vramTarget = targetVRAM || this.availableVRAM;
    
    // Quantization options ordered by quality (best to worst)
    const quantizations: Array<{
      type: string;
      bitsPerWeight: number;
      qualityScore: number;
      description: string;
    }> = [
      { type: 'f16', bitsPerWeight: 16, qualityScore: 100, description: 'Full precision' },
      { type: 'q8_0', bitsPerWeight: 8.5, qualityScore: 95, description: 'Very high quality' },
      { type: 'q6_k', bitsPerWeight: 6.5, qualityScore: 90, description: 'High quality' },
      { type: 'q5_k_m', bitsPerWeight: 5.5, qualityScore: 85, description: 'Good quality' },
      { type: 'q4_k_m', bitsPerWeight: 4.5, qualityScore: 80, description: 'Balanced quality (recommended)' },
      { type: 'q4_k_s', bitsPerWeight: 4.0, qualityScore: 75, description: 'Good for CPU offloading' },
      { type: 'q3_k_m', bitsPerWeight: 3.5, qualityScore: 70, description: 'Lower quality' },
      { type: 'q2_k', bitsPerWeight: 2.5, qualityScore: 60, description: 'Significant quality loss' }
    ];

    // Find the highest quality quantization that fits
    for (const quant of quantizations) {
      const estimatedMemory = this.estimateModelMemory(parameterCount, quant.type);
      
      if (estimatedMemory <= vramTarget) {
        logger.info(`🎯 Selected ${quant.type} quantization: ${estimatedMemory.toFixed(1)}GB (${quant.description})`);
        
        return {
          quantization: quant.type,
          estimatedMemoryGB: estimatedMemory,
          qualityScore: quant.qualityScore,
          description: quant.description,
          fitsInVRAM: true
        };
      }
    }

    // If nothing fits, recommend the smallest
    const smallest = quantizations[quantizations.length - 1];
    logger.warn(`⚠️  No quantization fits in ${vramTarget}GB, recommending ${smallest.type}`);
    
    return {
      quantization: smallest.type,
      estimatedMemoryGB: this.estimateModelMemory(parameterCount, smallest.type),
      qualityScore: smallest.qualityScore,
      description: smallest.description,
      fitsInVRAM: false
    };
  }

  /**
   * Create optimized environment variables for Ollama
   */
  createOptimizedEnvironment(config: OptimizationConfig): Record<string, string> {
    const env: Record<string, string> = {};

    // Enable Flash Attention if using K/V cache quantization
    if (config.kvCache && config.kvCache.quantizationType !== 'f16') {
      env['OLLAMA_FLASH_ATTENTION'] = '1';
      env['OLLAMA_KV_CACHE_TYPE'] = config.kvCache.quantizationType;
      logger.info(`🔧 Enabled Flash Attention with ${config.kvCache.quantizationType} K/V cache`);
    }

    // Set GPU layer count for offloading
    if (config.layerOffloading && config.layerOffloading.gpuLayers < config.layerOffloading.totalLayers) {
      env['OLLAMA_NUM_GPU_LAYERS'] = config.layerOffloading.gpuLayers.toString();
      logger.info(`🔧 Set GPU layers: ${config.layerOffloading.gpuLayers}/${config.layerOffloading.totalLayers}`);
    }

    // Optimize for low VRAM
    if (this.availableVRAM <= 8) {
      env['OLLAMA_LOW_VRAM'] = '1';
      env['OLLAMA_CPU_MEMORY_LIMIT'] = Math.round(this.systemRAM * 0.7).toString() + 'G';
      logger.info(`🔧 Enabled low VRAM optimizations`);
    }

    // Set context window if optimized
    if (config.contextLength && config.contextLength < 4096) {
      env['OLLAMA_CONTEXT_LENGTH'] = config.contextLength.toString();
      logger.info(`🔧 Optimized context length: ${config.contextLength}`);
    }

    return env;
  }

  /**
   * Estimate model memory usage based on parameters and quantization
   */
  private estimateModelMemory(parameterCount: number, quantization: string): number {
    // Base memory calculation: parameters * bits_per_weight / 8 / (1024^3)
    const bitsPerWeight = this.getBitsPerWeight(quantization);
    const baseMemoryGB = (parameterCount * bitsPerWeight) / 8 / (1024 * 1024 * 1024);
    
    // Add overhead for activation memory, intermediate calculations, etc.
    const overhead = 1.2; // 20% overhead
    
    return baseMemoryGB * overhead;
  }

  /**
   * Estimate context (K/V cache) memory usage
   */
  private estimateContextMemory(contextLength: number, parameterCount: number): number {
    // Simplified K/V cache estimation
    // For transformer models: 2 * layers * d_model * context_length * bytes_per_token
    
    // Rough estimation based on parameter count
    const layers = Math.sqrt(parameterCount / 1e6) * 4; // Rough layer estimation
    const dModel = Math.sqrt(parameterCount / layers / 1e6) * 1000; // Rough dimension estimation
    
    // F16 uses 2 bytes per value, 2 for K and V
    const contextMemoryBytes = 2 * layers * dModel * contextLength * 2;
    const contextMemoryGB = contextMemoryBytes / (1024 * 1024 * 1024);
    
    return Math.max(contextMemoryGB, 0.1); // Minimum 100MB
  }

  /**
   * Get bits per weight for different quantization types
   */
  private getBitsPerWeight(quantization: string): number {
    const quantMap: Record<string, number> = {
      'f16': 16,
      'f32': 32,
      'q8_0': 8.5,
      'q6_k': 6.56,
      'q5_k_m': 5.68,
      'q5_k_s': 5.54,
      'q4_k_m': 4.85,
      'q4_k_s': 4.58,
      'q4_0': 4.5,
      'q3_k_m': 3.91,
      'q3_k_s': 3.5,
      'q2_k': 2.63,
      'iq3_xxs': 3.06,
      'iq2_xxs': 2.06,
      'iq1_s': 1.56
    };

    return quantMap[quantization.toLowerCase()] || 4.5; // Default to Q4 if unknown
  }

  /**
   * Parse model information from name
   */
  parseModelInfo(modelName: string): ModelInfo {
    const name = modelName.toLowerCase();
    
    // Extract parameter count
    let parameterCount = 7e9; // Default 7B
    if (name.includes('1b')) parameterCount = 1e9;
    else if (name.includes('2b')) parameterCount = 2e9;
    else if (name.includes('3b')) parameterCount = 3e9;
    else if (name.includes('7b')) parameterCount = 7e9;
    else if (name.includes('8b')) parameterCount = 8e9;
    else if (name.includes('11b')) parameterCount = 11e9;
    else if (name.includes('13b')) parameterCount = 13e9;
    else if (name.includes('14b')) parameterCount = 14e9;
    else if (name.includes('27b')) parameterCount = 27e9;
    else if (name.includes('32b')) parameterCount = 32e9;
    else if (name.includes('70b')) parameterCount = 70e9;

    // Extract quantization
    let quantization = 'q4_k_m'; // Default
    if (name.includes(':q8_0') || name.includes('-q8_0')) quantization = 'q8_0';
    else if (name.includes(':q6_k') || name.includes('-q6_k')) quantization = 'q6_k';
    else if (name.includes(':q5_k_m') || name.includes('-q5_k_m')) quantization = 'q5_k_m';
    else if (name.includes(':q4_k_s') || name.includes('-q4_k_s')) quantization = 'q4_k_s';
    else if (name.includes(':q4_0') || name.includes('-q4_0')) quantization = 'q4_0';
    else if (name.includes(':q3_k_m') || name.includes('-q3_k_m')) quantization = 'q3_k_m';
    else if (name.includes(':q2_k') || name.includes('-q2_k')) quantization = 'q2_k';

    // Estimate layer count based on parameter count
    const totalLayers = Math.round(Math.sqrt(parameterCount / 1e6) * 4);

    return {
      name: modelName,
      parameterCount,
      quantization,
      totalLayers,
      contextLength: 16384 // Default context length
    };
  }

  /**
   * Generate comprehensive optimization configuration for a model
   */
  optimizeModelForVRAM(modelName: string, targetVRAM?: number): OptimizationConfig {
    const modelInfo = this.parseModelInfo(modelName);
    const vramTarget = targetVRAM || this.availableVRAM;

    logger.info(`🎯 Optimizing ${modelName} for ${vramTarget}GB VRAM`);

    // Calculate layer offloading
    const layerOffloading = this.calculateOptimalLayerOffloading(modelInfo);

    // Get K/V cache configuration
    const kvCache = this.getKVCacheQuantizationConfig(modelInfo.contextLength, modelInfo.parameterCount);

    // Optimize context length if needed
    let contextLength = modelInfo.contextLength;
    if (kvCache.estimatedMemoryGB > vramTarget * 0.5) { // K/V cache uses >50% of VRAM
      contextLength = Math.min(14336, contextLength); // Moderate context reduction
      logger.info(`📏 Reduced context length to ${contextLength} for memory optimization`);
    }

    // Generate quantization recommendation
    const quantRec = this.selectOptimalQuantization(modelInfo.parameterCount, vramTarget);

    return {
      modelInfo,
      layerOffloading,
      kvCache,
      contextLength,
      quantizationRecommendation: quantRec,
      estimatedTotalMemory: layerOffloading.estimatedGPUMemory + kvCache.estimatedMemoryGB,
      fitsInVRAM: layerOffloading.estimatedGPUMemory + kvCache.estimatedMemoryGB <= vramTarget
    };
  }
}

// Type definitions
export interface ModelInfo {
  name: string;
  parameterCount: number;
  quantization: string;
  totalLayers: number;
  contextLength: number;
}

export interface LayerOffloadingConfig {
  gpuLayers: number;
  cpuLayers: number;
  totalLayers: number;
  estimatedGPUMemory: number;
  estimatedCPUMemory: number;
  canFullyOffload: boolean;
}

export interface KVCacheConfig {
  quantizationType: 'f16' | 'q8_0' | 'q4_0';
  estimatedMemoryGB: number;
  memoryReduction: number;
  qualityImpact: 'minimal' | 'noticeable';
}

export interface LegacyQuantizationRecommendation {
  quantization: string;
  estimatedMemoryGB: number;
  qualityScore: number;
  description: string;
  fitsInVRAM: boolean;
}

export interface OptimizationConfig {
  modelInfo: ModelInfo;
  layerOffloading: LayerOffloadingConfig;
  kvCache: KVCacheConfig;
  contextLength: number;
  quantizationRecommendation: LegacyQuantizationRecommendation;
  estimatedTotalMemory: number;
  fitsInVRAM: boolean;
}