/**
 * Data Transformation Pipeline
 * 
 * Addresses Issue #4: Data Transformation Mismatches
 * 
 * This pipeline handles all data transformations between the 4 major systems,
 * ensuring consistent data formats and preventing transformation errors
 * that could break system integration.
 */

import { EventEmitter } from 'events';
import { logger } from '../logger.js';
import {
  UnifiedRequestContext,
  SystemResult,
  UnifiedRoutingDecision,
  UnifiedVoiceResult,
  UnifiedMCPResult,
  UnifiedOrchestrationResult,
  DataTransformation,
  DataTransformer,
  TransformationResult,
  TransformationRegistry,
  ValidationResult,
  TransformationType,
  TransformationRule,
} from './unified-data-models.js';

/**
 * Data Transformation Pipeline
 * Central system for managing all inter-system data transformations
 */
export class DataTransformationPipeline extends EventEmitter implements TransformationRegistry {
  private static instance: DataTransformationPipeline | null = null;
  
  // Transformer registry
  private transformers: Map<string, DataTransformer> = new Map();
  private transformationMatrix: Map<string, Map<string, DataTransformer>> = new Map();
  
  // Transformation tracking
  private transformationHistory: Map<string, DataTransformation[]> = new Map();
  private transformationCache: Map<string, CachedTransformation> = new Map();
  
  // Pipeline metrics
  private pipelineMetrics: TransformationMetrics;
  
  // Built-in transformers
  private builtInTransformers: Map<string, DataTransformer> = new Map();
  
  private constructor() {
    super();
    
    this.pipelineMetrics = {
      totalTransformations: 0,
      successfulTransformations: 0,
      failedTransformations: 0,
      averageTransformationTime: 0,
      dataIntegrityScores: [],
      transformerPerformance: new Map(),
      systemPairPerformance: new Map(),
    };
    
    this.initializeBuiltInTransformers();
    this.setupTransformationMatrix();
  }
  
  static getInstance(): DataTransformationPipeline {
    if (!DataTransformationPipeline.instance) {
      DataTransformationPipeline.instance = new DataTransformationPipeline();
    }
    return DataTransformationPipeline.instance;
  }
  
  /**
   * Register a custom transformer
   */
  registerTransformation(
    sourceSystem: string,
    targetSystem: string,
    transformer: DataTransformer
  ): void {
    const key = `${sourceSystem}->${targetSystem}`;
    this.transformers.set(key, transformer);
    
    // Update transformation matrix
    if (!this.transformationMatrix.has(sourceSystem)) {
      this.transformationMatrix.set(sourceSystem, new Map());
    }
    this.transformationMatrix.get(sourceSystem)!.set(targetSystem, transformer);
    
    logger.info('Data transformer registered', {
      transformerId: transformer.transformerId,
      sourceSystem,
      targetSystem,
      sourceFormat: transformer.sourceFormat,
      targetFormat: transformer.targetFormat,
    });
    
    this.emit('transformer-registered', { sourceSystem, targetSystem, transformer });
  }
  
  /**
   * Get transformer for system pair
   */
  getTransformer(sourceSystem: string, targetSystem: string): DataTransformer | null {
    const key = `${sourceSystem}->${targetSystem}`;
    return this.transformers.get(key) || null;
  }
  
  /**
   * Main transformation method
   */
  async transform<T, U>(
    data: T,
    sourceSystem: string,
    targetSystem: string,
    context: UnifiedRequestContext
  ): Promise<TransformationResult<U>> {
    const transformationId = this.generateTransformationId();
    const startTime = Date.now();
    
    try {
      logger.debug('Starting data transformation', {
        transformationId,
        sourceSystem,
        targetSystem,
        requestId: context.requestId,
      });
      
      // Check cache first
      const cacheKey = this.generateCacheKey(data, sourceSystem, targetSystem);
      const cached = this.transformationCache.get(cacheKey);
      
      if (cached && this.isCacheValid(cached)) {
        logger.debug('Using cached transformation', { transformationId, cacheKey });
        return this.createCachedResult(cached, transformationId);
      }
      
      // Get appropriate transformer
      const transformer = this.getTransformer(sourceSystem, targetSystem);
      if (!transformer) {
        throw new Error(`No transformer found for ${sourceSystem} -> ${targetSystem}`);
      }
      
      // Validate input data
      const validation = transformer.validate(data);
      if (!validation.valid) {
        throw new Error(`Input validation failed: ${validation.errors.map(e => e.message).join(', ')}`);
      }
      
      // Perform transformation
      const transformationResult = await transformer.transform(data, context);
      
      if (!transformationResult.success) {
        throw new Error(`Transformation failed: ${transformationResult.error}`);
      }
      
      // Create transformation record
      const transformationRecord = this.createTransformationRecord(
        transformationId,
        sourceSystem,
        targetSystem,
        transformer,
        validation,
        startTime
      );
      
      // Update metrics
      const executionTime = Date.now() - startTime;
      this.updateTransformationMetrics(
        transformationRecord,
        executionTime,
        transformationResult.metadata.dataIntegrity
      );
      
      // Cache successful transformation
      this.cacheTransformation(cacheKey, transformationResult, transformationRecord);
      
      // Store transformation history
      this.storeTransformationHistory(context.requestId, transformationRecord);
      
      const result: TransformationResult<U> = {
        success: true,
        data: transformationResult.data,
        metadata: {
          ...transformationResult.metadata,
          transformationId,
          sourceSystem,
          targetSystem,
          executionTime,
        },
        validationResult: validation,
        transformationRecord,
      };
      
      logger.info('Data transformation completed successfully', {
        transformationId,
        sourceSystem,
        targetSystem,
        executionTime,
        dataIntegrity: transformationResult.metadata.dataIntegrity,
      });
      
      this.emit('transformation-completed', result);
      return result;
      
    } catch (error) {
      const executionTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      logger.error('Data transformation failed', {
        transformationId,
        sourceSystem,
        targetSystem,
        error: errorMessage,
        executionTime,
      });
      
      // Update failure metrics
      this.pipelineMetrics.failedTransformations++;
      
      const result: TransformationResult<U> = {
        success: false,
        error: errorMessage,
        metadata: {
          transformationId,
          sourceSystem,
          targetSystem,
          executionTime,
          dataIntegrity: 0,
          informationPreserved: 0,
        },
        validationResult: {
          valid: false,
          errors: [{ field: 'data', message: errorMessage, severity: 'error', code: 'TRANSFORM_FAILED' }],
          warnings: [],
          confidence: 0,
        },
        transformationRecord: this.createFailedTransformationRecord(
          transformationId,
          sourceSystem,
          targetSystem,
          errorMessage,
          startTime
        ),
      };
      
      this.emit('transformation-failed', result, error);
      return result;
    }
  }
  
  /**
   * Transform routing decision to voice system format
   */
  async transformRoutingToVoice(
    routingDecision: UnifiedRoutingDecision,
    context: UnifiedRequestContext
  ): Promise<TransformationResult<VoiceTransformationInput>> {
    return await this.transform<UnifiedRoutingDecision, VoiceTransformationInput>(
      routingDecision,
      'intelligent-routing',
      'voice-optimization',
      context
    );
  }
  
  /**
   * Transform voice result to MCP system format
   */
  async transformVoiceToMCP(
    voiceResult: UnifiedVoiceResult,
    context: UnifiedRequestContext
  ): Promise<TransformationResult<MCPTransformationInput>> {
    return await this.transform<UnifiedVoiceResult, MCPTransformationInput>(
      voiceResult,
      'voice-optimization',
      'mcp-enhancement',
      context
    );
  }
  
  /**
   * Transform MCP result to orchestration system format
   */
  async transformMCPToOrchestration(
    mcpResult: UnifiedMCPResult,
    context: UnifiedRequestContext
  ): Promise<TransformationResult<OrchestrationTransformationInput>> {
    return await this.transform<UnifiedMCPResult, OrchestrationTransformationInput>(
      mcpResult,
      'mcp-enhancement',
      'unified-orchestration',
      context
    );
  }
  
  /**
   * Batch transform multiple system results
   */
  async batchTransform(
    transformations: BatchTransformationRequest[],
    context: UnifiedRequestContext
  ): Promise<BatchTransformationResult> {
    const results: TransformationResult<any>[] = [];
    let allSuccessful = true;
    
    for (const request of transformations) {
      try {
        const result = await this.transform(
          request.data,
          request.sourceSystem,
          request.targetSystem,
          context
        );
        
        results.push(result);
        if (!result.success) {
          allSuccessful = false;
        }
      } catch (error) {
        allSuccessful = false;
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        
        results.push({
          success: false,
          error: errorMessage,
          metadata: {
            transformationId: this.generateTransformationId(),
            sourceSystem: request.sourceSystem,
            targetSystem: request.targetSystem,
            executionTime: 0,
            dataIntegrity: 0,
            informationPreserved: 0,
          },
          validationResult: {
            valid: false,
            errors: [{ field: 'data', message: errorMessage, severity: 'error', code: 'BATCH_FAILED' }],
            warnings: [],
            confidence: 0,
          },
          transformationRecord: this.createFailedTransformationRecord(
            this.generateTransformationId(),
            request.sourceSystem,
            request.targetSystem,
            errorMessage,
            Date.now()
          ),
        });
      }
    }
    
    return {
      success: allSuccessful,
      results,
      totalTransformations: transformations.length,
      successfulTransformations: results.filter(r => r.success).length,
      failedTransformations: results.filter(r => !r.success).length,
    };
  }
  
  /**
   * Validate transformation pipeline health
   */
  async validatePipelineHealth(): Promise<PipelineHealthReport> {
    const report: PipelineHealthReport = {
      overall: 'healthy',
      transformerStatus: new Map(),
      systemPairStatus: new Map(),
      recommendations: [],
      metrics: this.pipelineMetrics,
    };
    
    // Check transformer health
    for (const [key, transformer] of this.transformers) {
      const performance = this.pipelineMetrics.transformerPerformance.get(transformer.transformerId);
      
      if (!performance) {
        report.transformerStatus.set(key, 'untested');
        continue;
      }
      
      if (performance.successRate < 0.8) {
        report.transformerStatus.set(key, 'unhealthy');
        report.overall = 'degraded';
        report.recommendations.push(`Transformer ${key} has low success rate: ${(performance.successRate * 100).toFixed(1)}%`);
      } else if (performance.averageTime > 5000) {
        report.transformerStatus.set(key, 'slow');
        report.recommendations.push(`Transformer ${key} is slow: ${performance.averageTime.toFixed(0)}ms average`);
      } else {
        report.transformerStatus.set(key, 'healthy');
      }
    }
    
    // Check data integrity trends
    const recentIntegrityScores = this.pipelineMetrics.dataIntegrityScores.slice(-10);
    const averageIntegrity = recentIntegrityScores.reduce((a, b) => a + b, 0) / recentIntegrityScores.length;
    
    if (averageIntegrity < 0.8) {
      report.overall = 'critical';
      report.recommendations.push('Data integrity is below acceptable threshold');
    }
    
    return report;
  }
  
  /**
   * Get transformation history for a request
   */
  getTransformationHistory(requestId: string): DataTransformation[] {
    return this.transformationHistory.get(requestId) || [];
  }
  
  /**
   * Get pipeline metrics
   */
  getMetrics(): TransformationMetrics {
    return { ...this.pipelineMetrics };
  }
  
  /**
   * Clear transformation cache
   */
  clearCache(): void {
    this.transformationCache.clear();
    logger.info('Transformation cache cleared');
  }
  
  // ========================================
  // PRIVATE IMPLEMENTATION METHODS
  // ========================================
  
  private initializeBuiltInTransformers(): void {
    // Routing -> Voice transformer
    this.builtInTransformers.set('routing->voice', new RoutingToVoiceTransformer());
    
    // Voice -> MCP transformer
    this.builtInTransformers.set('voice->mcp', new VoiceToMCPTransformer());
    
    // MCP -> Orchestration transformer
    this.builtInTransformers.set('mcp->orchestration', new MCPToOrchestrationTransformer());
    
    logger.info('Built-in transformers initialized', {
      count: this.builtInTransformers.size,
      transformers: Array.from(this.builtInTransformers.keys()),
    });
  }
  
  private setupTransformationMatrix(): void {
    // Register built-in transformers
    this.registerTransformation(
      'intelligent-routing',
      'voice-optimization', 
      this.builtInTransformers.get('routing->voice')!
    );
    
    this.registerTransformation(
      'voice-optimization',
      'mcp-enhancement',
      this.builtInTransformers.get('voice->mcp')!
    );
    
    this.registerTransformation(
      'mcp-enhancement',
      'unified-orchestration',
      this.builtInTransformers.get('mcp->orchestration')!
    );
    
    logger.info('Transformation matrix setup complete');
  }
  
  private createTransformationRecord(
    transformationId: string,
    sourceSystem: string,
    targetSystem: string,
    transformer: DataTransformer,
    validation: ValidationResult,
    startTime: number
  ): DataTransformation {
    return {
      transformationId,
      sourceSystem,
      targetSystem,
      sourceFormat: transformer.sourceFormat,
      targetFormat: transformer.targetFormat,
      transformationType: this.determineTransformationType(sourceSystem, targetSystem),
      transformationRules: this.getTransformationRules(transformer),
      validationResults: validation,
      timestamp: Date.now(),
      reversible: !!transformer.reverseTransform,
      dataLoss: validation.confidence < 1.0,
      dataLossDetails: validation.warnings.length > 0 ? validation.warnings : undefined,
    };
  }
  
  private createFailedTransformationRecord(
    transformationId: string,
    sourceSystem: string,
    targetSystem: string,
    error: string,
    startTime: number
  ): DataTransformation {
    return {
      transformationId,
      sourceSystem,
      targetSystem,
      sourceFormat: 'unknown',
      targetFormat: 'unknown',
      transformationType: 'format_conversion',
      transformationRules: [],
      validationResults: {
        valid: false,
        errors: [{ field: 'data', message: error, severity: 'error', code: 'TRANSFORM_FAILED' }],
        warnings: [],
        confidence: 0,
      },
      timestamp: Date.now(),
      reversible: false,
      dataLoss: true,
      dataLossDetails: [error],
    };
  }
  
  private determineTransformationType(sourceSystem: string, targetSystem: string): TransformationType {
    // Determine transformation type based on system pair
    if (sourceSystem === 'intelligent-routing' && targetSystem === 'voice-optimization') {
      return 'context_adaptation';
    } else if (sourceSystem === 'voice-optimization' && targetSystem === 'mcp-enhancement') {
      return 'data_enrichment';
    } else if (sourceSystem === 'mcp-enhancement' && targetSystem === 'unified-orchestration') {
      return 'data_reduction';
    }
    
    return 'format_conversion';
  }
  
  private getTransformationRules(transformer: DataTransformer): TransformationRule[] {
    // Extract transformation rules from transformer (if available)
    // This would be specific to each transformer implementation
    return [];
  }
  
  private updateTransformationMetrics(
    transformationRecord: DataTransformation,
    executionTime: number,
    dataIntegrity: number
  ): void {
    this.pipelineMetrics.totalTransformations++;
    
    if (transformationRecord.validationResults.valid) {
      this.pipelineMetrics.successfulTransformations++;
    } else {
      this.pipelineMetrics.failedTransformations++;
    }
    
    // Update running average
    const alpha = 0.1;
    this.pipelineMetrics.averageTransformationTime =
      (1 - alpha) * this.pipelineMetrics.averageTransformationTime + alpha * executionTime;
    
    // Track data integrity
    this.pipelineMetrics.dataIntegrityScores.push(dataIntegrity);
    if (this.pipelineMetrics.dataIntegrityScores.length > 100) {
      this.pipelineMetrics.dataIntegrityScores.shift(); // Keep only recent scores
    }
    
    // Update transformer performance
    const transformerId = transformationRecord.transformationId;
    const current = this.pipelineMetrics.transformerPerformance.get(transformerId) || {
      totalTransformations: 0,
      successfulTransformations: 0,
      averageTime: 0,
      successRate: 0,
    };
    
    current.totalTransformations++;
    if (transformationRecord.validationResults.valid) {
      current.successfulTransformations++;
    }
    current.averageTime = (current.averageTime + executionTime) / 2;
    current.successRate = current.successfulTransformations / current.totalTransformations;
    
    this.pipelineMetrics.transformerPerformance.set(transformerId, current);
  }
  
  private cacheTransformation(
    cacheKey: string,
    result: TransformationResult<any>,
    record: DataTransformation
  ): void {
    const cached: CachedTransformation = {
      cacheKey,
      result,
      transformationRecord: record,
      timestamp: Date.now(),
      accessCount: 0,
    };
    
    this.transformationCache.set(cacheKey, cached);
    
    // Clean old cache entries
    this.cleanupCache();
  }
  
  private cleanupCache(): void {
    const maxAge = 300000; // 5 minutes
    const now = Date.now();
    
    for (const [key, cached] of this.transformationCache) {
      if (now - cached.timestamp > maxAge) {
        this.transformationCache.delete(key);
      }
    }
  }
  
  private storeTransformationHistory(requestId: string, record: DataTransformation): void {
    const history = this.transformationHistory.get(requestId) || [];
    history.push(record);
    this.transformationHistory.set(requestId, history);
    
    // Clean up old history after request completion
    setTimeout(() => {
      this.transformationHistory.delete(requestId);
    }, 600000); // 10 minutes
  }
  
  private generateTransformationId(): string {
    return `transform_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  private generateCacheKey(data: any, sourceSystem: string, targetSystem: string): string {
    // Generate a hash-based cache key
    const dataStr = JSON.stringify(data);
    const keyStr = `${sourceSystem}->${targetSystem}:${dataStr}`;
    
    // Simple hash function
    let hash = 0;
    for (let i = 0; i < keyStr.length; i++) {
      const char = keyStr.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    
    return `cache_${Math.abs(hash).toString(16)}`;
  }
  
  private isCacheValid(cached: CachedTransformation): boolean {
    const maxAge = 300000; // 5 minutes
    return (Date.now() - cached.timestamp) < maxAge;
  }
  
  private createCachedResult<T>(
    cached: CachedTransformation,
    newTransformationId: string
  ): TransformationResult<T> {
    cached.accessCount++;
    
    return {
      ...cached.result,
      metadata: {
        ...cached.result.metadata,
        transformationId: newTransformationId,
      },
    };
  }
}

// ========================================
// BUILT-IN TRANSFORMERS
// ========================================

class RoutingToVoiceTransformer implements DataTransformer {
  transformerId = 'routing-to-voice-v1';
  sourceFormat = 'UnifiedRoutingDecision';
  targetFormat = 'VoiceTransformationInput';
  
  async transform(
    data: UnifiedRoutingDecision,
    context: UnifiedRequestContext
  ): Promise<TransformationResult<VoiceTransformationInput>> {
    try {
      const voiceInput: VoiceTransformationInput = {
        requestId: context.requestId,
        routingDecision: data,
        selectedVoices: data.data.selectedVoices,
        routingStrategy: data.data.routingStrategy,
        context: {
          phase: context.phase,
          iteration: context.iteration,
          performanceTargets: context.performanceTargets,
          previousResults: context.previousResults,
        },
        constraints: {
          maxLatency: data.data.estimatedLatency,
          qualityThreshold: context.performanceTargets.qualityThreshold,
          maxCost: data.data.estimatedCost,
        },
      };
      
      return {
        success: true,
        data: voiceInput,
        metadata: {
          transformationId: '',
          sourceSystem: 'intelligent-routing',
          targetSystem: 'voice-optimization',
          executionTime: 0,
          dataIntegrity: 0.95,
          informationPreserved: 0.98,
        },
        validationResult: { valid: true, errors: [], warnings: [], confidence: 1.0 },
        transformationRecord: {} as DataTransformation,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        metadata: {
          transformationId: '',
          sourceSystem: 'intelligent-routing',
          targetSystem: 'voice-optimization',
          executionTime: 0,
          dataIntegrity: 0,
          informationPreserved: 0,
        },
        validationResult: { valid: false, errors: [], warnings: [], confidence: 0 },
        transformationRecord: {} as DataTransformation,
      };
    }
  }
  
  validate(data: any): ValidationResult {
    const errors: any[] = [];
    
    if (!data.systemId || data.systemId !== 'intelligent-routing') {
      errors.push({
        field: 'systemId',
        message: 'Invalid system ID for routing decision',
        severity: 'error',
        code: 'INVALID_SYSTEM_ID',
      });
    }
    
    if (!data.data?.selectedVoices) {
      errors.push({
        field: 'data.selectedVoices',
        message: 'Selected voices are required',
        severity: 'error',
        code: 'MISSING_VOICES',
      });
    }
    
    return {
      valid: errors.length === 0,
      errors,
      warnings: [],
      confidence: errors.length === 0 ? 1.0 : 0.0,
    };
  }
}

class VoiceToMCPTransformer implements DataTransformer {
  transformerId = 'voice-to-mcp-v1';
  sourceFormat = 'UnifiedVoiceResult';
  targetFormat = 'MCPTransformationInput';
  
  async transform(
    data: UnifiedVoiceResult,
    context: UnifiedRequestContext
  ): Promise<TransformationResult<MCPTransformationInput>> {
    try {
      const mcpInput: MCPTransformationInput = {
        requestId: context.requestId,
        voiceResult: data,
        requiredCapabilities: context.mcpRequirements.capabilities,
        voiceIntegrationRequests: data.data.primaryVoice ? [
          {
            voiceId: data.data.primaryVoice.voiceId,
            content: data.data.primaryVoice.content,
            capabilities: this.extractRequiredCapabilities(data.data.primaryVoice.content),
            priority: 'high',
          }
        ] : [],
        constraints: {
          maxLatency: context.mcpRequirements.maxLatency,
          minReliability: context.mcpRequirements.minReliability,
          securityLevel: context.mcpRequirements.securityLevel,
        },
      };
      
      return {
        success: true,
        data: mcpInput,
        metadata: {
          transformationId: '',
          sourceSystem: 'voice-optimization',
          targetSystem: 'mcp-enhancement',
          executionTime: 0,
          dataIntegrity: 0.92,
          informationPreserved: 0.95,
        },
        validationResult: { valid: true, errors: [], warnings: [], confidence: 1.0 },
        transformationRecord: {} as DataTransformation,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        metadata: {
          transformationId: '',
          sourceSystem: 'voice-optimization',
          targetSystem: 'mcp-enhancement',
          executionTime: 0,
          dataIntegrity: 0,
          informationPreserved: 0,
        },
        validationResult: { valid: false, errors: [], warnings: [], confidence: 0 },
        transformationRecord: {} as DataTransformation,
      };
    }
  }
  
  validate(data: any): ValidationResult {
    const errors: any[] = [];
    
    if (!data.systemId || data.systemId !== 'voice-optimization') {
      errors.push({
        field: 'systemId',
        message: 'Invalid system ID for voice result',
        severity: 'error',
        code: 'INVALID_SYSTEM_ID',
      });
    }
    
    return {
      valid: errors.length === 0,
      errors,
      warnings: [],
      confidence: errors.length === 0 ? 1.0 : 0.0,
    };
  }
  
  private extractRequiredCapabilities(content: string): string[] {
    // Extract MCP capabilities from voice content
    const capabilities: string[] = [];
    
    if (content.includes('file') || content.includes('read') || content.includes('write')) {
      capabilities.push('filesystem');
    }
    
    if (content.includes('git') || content.includes('commit') || content.includes('branch')) {
      capabilities.push('git');
    }
    
    if (content.includes('terminal') || content.includes('command') || content.includes('execute')) {
      capabilities.push('terminal');
    }
    
    return capabilities;
  }
}

class MCPToOrchestrationTransformer implements DataTransformer {
  transformerId = 'mcp-to-orchestration-v1';
  sourceFormat = 'UnifiedMCPResult';
  targetFormat = 'OrchestrationTransformationInput';
  
  async transform(
    data: UnifiedMCPResult,
    context: UnifiedRequestContext
  ): Promise<TransformationResult<OrchestrationTransformationInput>> {
    try {
      const orchestrationInput: OrchestrationTransformationInput = {
        requestId: context.requestId,
        mcpResult: data,
        allSystemResults: context.previousResults || [],
        synthesisRequirements: {
          method: this.determineSynthesisMethod(context),
          qualityThreshold: context.performanceTargets.qualityThreshold,
          includeMetadata: true,
          preserveContext: true,
        },
        finalOutputFormat: 'comprehensive',
      };
      
      return {
        success: true,
        data: orchestrationInput,
        metadata: {
          transformationId: '',
          sourceSystem: 'mcp-enhancement',
          targetSystem: 'unified-orchestration',
          executionTime: 0,
          dataIntegrity: 0.98,
          informationPreserved: 0.99,
        },
        validationResult: { valid: true, errors: [], warnings: [], confidence: 1.0 },
        transformationRecord: {} as DataTransformation,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        metadata: {
          transformationId: '',
          sourceSystem: 'mcp-enhancement',
          targetSystem: 'unified-orchestration',
          executionTime: 0,
          dataIntegrity: 0,
          informationPreserved: 0,
        },
        validationResult: { valid: false, errors: [], warnings: [], confidence: 0 },
        transformationRecord: {} as DataTransformation,
      };
    }
  }
  
  validate(data: any): ValidationResult {
    const errors: any[] = [];
    
    if (!data.systemId || data.systemId !== 'mcp-enhancement') {
      errors.push({
        field: 'systemId',
        message: 'Invalid system ID for MCP result',
        severity: 'error',
        code: 'INVALID_SYSTEM_ID',
      });
    }
    
    return {
      valid: errors.length === 0,
      errors,
      warnings: [],
      confidence: errors.length === 0 ? 1.0 : 0.0,
    };
  }
  
  private determineSynthesisMethod(context: UnifiedRequestContext): string {
    if (context.phase === 'council') {
      return 'collaborative';
    } else if (context.phase === 'synthesis') {
      return 'consensus';
    } else {
      return 'weighted';
    }
  }
}

// ========================================
// SUPPORTING INTERFACES
// ========================================

interface VoiceTransformationInput {
  requestId: string;
  routingDecision: UnifiedRoutingDecision;
  selectedVoices: any[];
  routingStrategy: any;
  context: {
    phase?: string;
    iteration?: number;
    performanceTargets: any;
    previousResults?: any[];
  };
  constraints: {
    maxLatency: number;
    qualityThreshold: number;
    maxCost: number;
  };
}

interface MCPTransformationInput {
  requestId: string;
  voiceResult: UnifiedVoiceResult;
  requiredCapabilities: string[];
  voiceIntegrationRequests: VoiceIntegrationRequest[];
  constraints: {
    maxLatency: number;
    minReliability: number;
    securityLevel: string;
  };
}

interface VoiceIntegrationRequest {
  voiceId: string;
  content: string;
  capabilities: string[];
  priority: 'low' | 'medium' | 'high' | 'critical';
}

interface OrchestrationTransformationInput {
  requestId: string;
  mcpResult: UnifiedMCPResult;
  allSystemResults: SystemResult[];
  synthesisRequirements: {
    method: string;
    qualityThreshold: number;
    includeMetadata: boolean;
    preserveContext: boolean;
  };
  finalOutputFormat: string;
}

interface BatchTransformationRequest {
  data: any;
  sourceSystem: string;
  targetSystem: string;
}

interface BatchTransformationResult {
  success: boolean;
  results: TransformationResult<any>[];
  totalTransformations: number;
  successfulTransformations: number;
  failedTransformations: number;
}

interface CachedTransformation {
  cacheKey: string;
  result: TransformationResult<any>;
  transformationRecord: DataTransformation;
  timestamp: number;
  accessCount: number;
}

interface TransformationMetrics {
  totalTransformations: number;
  successfulTransformations: number;
  failedTransformations: number;
  averageTransformationTime: number;
  dataIntegrityScores: number[];
  transformerPerformance: Map<string, TransformerPerformance>;
  systemPairPerformance: Map<string, SystemPairPerformance>;
}

interface TransformerPerformance {
  totalTransformations: number;
  successfulTransformations: number;
  averageTime: number;
  successRate: number;
}

interface SystemPairPerformance {
  sourceSystem: string;
  targetSystem: string;
  totalTransformations: number;
  averageIntegrity: number;
  averageInformationPreserved: number;
}

interface PipelineHealthReport {
  overall: 'healthy' | 'degraded' | 'critical';
  transformerStatus: Map<string, 'healthy' | 'degraded' | 'unhealthy' | 'slow' | 'untested'>;
  systemPairStatus: Map<string, 'healthy' | 'degraded' | 'critical'>;
  recommendations: string[];
  metrics: TransformationMetrics;
}

// Export singleton instance
export const dataTransformationPipeline = DataTransformationPipeline.getInstance();