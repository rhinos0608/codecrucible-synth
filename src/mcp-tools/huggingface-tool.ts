import { logger } from '../infrastructure/logging/logger.js';
import axios from 'axios';

export interface HuggingFaceConfig {
  enabled: boolean;
  apiKey?: string;
  baseUrl: string;
  timeout: number;
}

export interface ModelInfo {
  id: string;
  name: string;
  description: string;
  downloads: number;
  likes: number;
  tags: string[];
  pipeline_tag?: string;
  library_name?: string;
  language?: string[];
  license?: string;
  modelType:
    | 'text-generation'
    | 'text-classification'
    | 'translation'
    | 'summarization'
    | 'question-answering'
    | 'other';
}

export interface DatasetInfo {
  id: string;
  name: string;
  description: string;
  downloads: number;
  likes: number;
  tags: string[];
  size?: string;
  language?: string[];
  license?: string;
}

export interface SpaceInfo {
  id: string;
  name: string;
  description: string;
  likes: number;
  sdk?: string;
  tags: string[];
  runtime?: string;
}

/**
 * Hugging Face MCP Tool Integration
 *
 * Provides access to Hugging Face Hub for model discovery,
 * dataset exploration, and space browsing.
 */
export class HuggingFaceTool {
  private config: HuggingFaceConfig;
  private requestCount: number = 0;

  constructor(config: HuggingFaceConfig) {
    this.config = {
      ...config,
      baseUrl: config.baseUrl || 'https://huggingface.co/api',
      timeout: config.timeout || 30000,
    };
  }

  /**
   * Search for models with advanced filtering
   */
  async searchModels(
    query: string,
    options: {
      task?: string;
      library?: string;
      language?: string;
      license?: string;
      sort?: 'downloads' | 'likes' | 'updated' | 'created';
      direction?: 'asc' | 'desc';
      limit?: number;
      filter?: string;
    } = {}
  ): Promise<ModelInfo[]> {
    if (!this.config.enabled) {
      throw new Error('Hugging Face integration is not enabled');
    }

    try {
      const params = new URLSearchParams();

      if (query) params.append('search', query);
      if (options.task) params.append('pipeline_tag', options.task);
      if (options.library) params.append('library', options.library);
      if (options.language) params.append('language', options.language);
      if (options.license) params.append('license', options.license);
      if (options.sort) params.append('sort', options.sort);
      if (options.direction) params.append('direction', options.direction);
      if (options.limit) params.append('limit', Math.min(options.limit, 100).toString());
      if (options.filter) params.append('filter', options.filter);

      const response = await axios.get(`${this.config.baseUrl}/models?${params.toString()}`, {
        headers: this.getHeaders(),
        timeout: this.config.timeout,
      });

      this.requestCount++;

      return response.data.map((model: any) => this.processModelInfo(model));
    } catch (error: any) {
      logger.error('Hugging Face model search failed:', error);
      this.handleError(error);
      throw error;
    }
  }

  /**
   * Get detailed information about a specific model
   */
  async getModelInfo(modelId: string): Promise<ModelInfo> {
    if (!this.config.enabled) {
      throw new Error('Hugging Face integration is not enabled');
    }

    try {
      const response = await axios.get(`${this.config.baseUrl}/models/${modelId}`, {
        headers: this.getHeaders(),
        timeout: this.config.timeout,
      });

      this.requestCount++;

      return this.processModelInfo(response.data);
    } catch (error: any) {
      logger.error('Failed to get model info:', error);
      this.handleError(error);
      throw error;
    }
  }

  /**
   * Search for datasets
   */
  async searchDatasets(
    query: string,
    options: {
      task?: string;
      language?: string;
      size?: string;
      license?: string;
      sort?: 'downloads' | 'likes' | 'updated' | 'created';
      direction?: 'asc' | 'desc';
      limit?: number;
    } = {}
  ): Promise<DatasetInfo[]> {
    if (!this.config.enabled) {
      throw new Error('Hugging Face integration is not enabled');
    }

    try {
      const params = new URLSearchParams();

      if (query) params.append('search', query);
      if (options.task) params.append('task_categories', options.task);
      if (options.language) params.append('language', options.language);
      if (options.size) params.append('size_categories', options.size);
      if (options.license) params.append('license', options.license);
      if (options.sort) params.append('sort', options.sort);
      if (options.direction) params.append('direction', options.direction);
      if (options.limit) params.append('limit', Math.min(options.limit, 100).toString());

      const response = await axios.get(`${this.config.baseUrl}/datasets?${params.toString()}`, {
        headers: this.getHeaders(),
        timeout: this.config.timeout,
      });

      this.requestCount++;

      return response.data.map((dataset: any) => this.processDatasetInfo(dataset));
    } catch (error: any) {
      logger.error('Hugging Face dataset search failed:', error);
      this.handleError(error);
      throw error;
    }
  }

  /**
   * Search for Spaces (demos/applications)
   */
  async searchSpaces(
    query: string,
    options: {
      sdk?: string;
      sort?: 'likes' | 'updated' | 'created';
      direction?: 'asc' | 'desc';
      limit?: number;
    } = {}
  ): Promise<SpaceInfo[]> {
    if (!this.config.enabled) {
      throw new Error('Hugging Face integration is not enabled');
    }

    try {
      const params = new URLSearchParams();

      if (query) params.append('search', query);
      if (options.sdk) params.append('sdk', options.sdk);
      if (options.sort) params.append('sort', options.sort);
      if (options.direction) params.append('direction', options.direction);
      if (options.limit) params.append('limit', Math.min(options.limit, 100).toString());

      const response = await axios.get(`${this.config.baseUrl}/spaces?${params.toString()}`, {
        headers: this.getHeaders(),
        timeout: this.config.timeout,
      });

      this.requestCount++;

      return response.data.map((space: any) => this.processSpaceInfo(space));
    } catch (error: any) {
      logger.error('Hugging Face spaces search failed:', error);
      this.handleError(error);
      throw error;
    }
  }

  /**
   * Find models suitable for a specific coding task
   */
  async findCodeModels(
    task:
      | 'code-generation'
      | 'code-completion'
      | 'code-explanation'
      | 'bug-fixing'
      | 'code-translation',
    language?: string
  ): Promise<ModelInfo[]> {
    const taskMappings = {
      'code-generation': 'text-generation',
      'code-completion': 'text-generation',
      'code-explanation': 'text-generation',
      'bug-fixing': 'text-generation',
      'code-translation': 'translation',
    };

    const searchQuery = `${task} ${language || 'code'}`;

    return this.searchModels(searchQuery, {
      task: taskMappings[task],
      sort: 'downloads',
      direction: 'desc',
      limit: 20,
      filter: 'code',
    });
  }

  /**
   * Get trending models in a specific category
   */
  async getTrendingModels(
    category: string = 'text-generation',
    timeframe: 'day' | 'week' | 'month' = 'week'
  ): Promise<ModelInfo[]> {
    return this.searchModels('', {
      task: category,
      sort: 'downloads',
      direction: 'desc',
      limit: 15,
    });
  }

  /**
   * Find models by specific criteria for coding assistance
   */
  async findModelsByCriteria(criteria: {
    language?: string[];
    size?: 'small' | 'medium' | 'large';
    performance?: 'fast' | 'balanced' | 'quality';
    license?: 'commercial' | 'research' | 'open';
    task?: string;
  }): Promise<ModelInfo[]> {
    let query = '';
    const options: any = {
      limit: 25,
      sort: 'downloads',
      direction: 'desc',
    };

    if (criteria.language) {
      query += ` ${criteria.language.join(' ')}`;
    }

    if (criteria.task) {
      options.task = criteria.task;
    }

    if (criteria.size) {
      const sizeFilters = {
        small: '< 1B',
        medium: '1B - 10B',
        large: '> 10B',
      };
      query += ` ${sizeFilters[criteria.size]} parameters`;
    }

    if (criteria.license) {
      const licenseMap = {
        commercial: 'apache-2.0',
        research: 'cc-by-nc-4.0',
        open: 'mit',
      };
      options.license = licenseMap[criteria.license];
    }

    return this.searchModels(query.trim(), options);
  }

  /**
   * Get model recommendations based on a use case description
   */
  async getModelRecommendations(
    useCase: string,
    constraints: {
      maxSize?: string;
      requiresCommercialLicense?: boolean;
      preferredLibrary?: string;
      performanceRequirement?: 'speed' | 'quality' | 'balanced';
    } = {}
  ): Promise<{
    recommended: ModelInfo[];
    alternatives: ModelInfo[];
    reasoning: string;
  }> {
    // Analyze use case to determine task type
    const taskAnalysis = this.analyzeUseCase(useCase);

    // Search for models
    const models = await this.searchModels(useCase, {
      task: taskAnalysis.primaryTask,
      library: constraints.preferredLibrary,
      license: constraints.requiresCommercialLicense ? 'apache-2.0' : undefined,
      sort: constraints.performanceRequirement === 'speed' ? 'downloads' : 'likes',
      limit: 30,
    });

    // Filter and rank models
    const filtered = this.filterModelsByConstraints(models, constraints);

    return {
      recommended: filtered.slice(0, 5),
      alternatives: filtered.slice(5, 10),
      reasoning: this.generateRecommendationReasoning(taskAnalysis, constraints, filtered),
    };
  }

  /**
   * Private helper methods
   */
  private processModelInfo(data: any): ModelInfo {
    return {
      id: data.id || data.modelId || '',
      name: data.name || data.id || '',
      description: data.description || '',
      downloads: data.downloads || 0,
      likes: data.likes || 0,
      tags: data.tags || [],
      pipeline_tag: data.pipeline_tag,
      library_name: data.library_name,
      language: data.language,
      license: data.license,
      modelType: this.categorizeModel(data.pipeline_tag, data.tags),
    };
  }

  private processDatasetInfo(data: any): DatasetInfo {
    return {
      id: data.id || '',
      name: data.name || data.id || '',
      description: data.description || '',
      downloads: data.downloads || 0,
      likes: data.likes || 0,
      tags: data.tags || [],
      size: data.size_categories?.[0],
      language: data.language,
      license: data.license,
    };
  }

  private processSpaceInfo(data: any): SpaceInfo {
    return {
      id: data.id || '',
      name: data.name || data.id || '',
      description: data.description || '',
      likes: data.likes || 0,
      sdk: data.sdk,
      tags: data.tags || [],
      runtime: data.runtime,
    };
  }

  private categorizeModel(pipeline_tag?: string, tags: string[] = []): ModelInfo['modelType'] {
    if (pipeline_tag) {
      switch (pipeline_tag) {
        case 'text-generation':
        case 'text2text-generation':
          return 'text-generation';
        case 'text-classification':
          return 'text-classification';
        case 'translation':
          return 'translation';
        case 'summarization':
          return 'summarization';
        case 'question-answering':
          return 'question-answering';
        default:
          return 'other';
      }
    }

    // Fallback to tag analysis
    if (tags.some(tag => tag.includes('generation'))) return 'text-generation';
    if (tags.some(tag => tag.includes('classification'))) return 'text-classification';
    if (tags.some(tag => tag.includes('translation'))) return 'translation';

    return 'other';
  }

  private analyzeUseCase(useCase: string): { primaryTask: string; confidence: number } {
    const useCaseLower = useCase.toLowerCase();

    if (
      useCaseLower.includes('generat') ||
      useCaseLower.includes('creat') ||
      useCaseLower.includes('writ')
    ) {
      return { primaryTask: 'text-generation', confidence: 0.9 };
    }

    if (useCaseLower.includes('classif') || useCaseLower.includes('categor')) {
      return { primaryTask: 'text-classification', confidence: 0.8 };
    }

    if (useCaseLower.includes('translat')) {
      return { primaryTask: 'translation', confidence: 0.9 };
    }

    if (useCaseLower.includes('summar')) {
      return { primaryTask: 'summarization', confidence: 0.8 };
    }

    if (useCaseLower.includes('question') || useCaseLower.includes('answer')) {
      return { primaryTask: 'question-answering', confidence: 0.8 };
    }

    return { primaryTask: 'text-generation', confidence: 0.5 };
  }

  private filterModelsByConstraints(models: ModelInfo[], constraints: any): ModelInfo[] {
    return models.filter(model => {
      // Size constraint
      if (constraints.maxSize) {
        const hasSize = model.tags.some(tag => tag.includes('size') || tag.includes('param'));
        // This is a simplified check - in practice, you'd parse size information
      }

      // Commercial license constraint
      if (constraints.requiresCommercialLicense) {
        const commercialLicenses = ['apache-2.0', 'mit', 'bsd-3-clause'];
        if (model.license && !commercialLicenses.includes(model.license.toLowerCase())) {
          return false;
        }
      }

      return true;
    });
  }

  private generateRecommendationReasoning(
    taskAnalysis: any,
    constraints: any,
    models: ModelInfo[]
  ): string {
    let reasoning = `Based on your use case, I identified this as a ${taskAnalysis.primaryTask} task with ${taskAnalysis.confidence * 100}% confidence. `;

    if (models.length > 0) {
      reasoning += `I found ${models.length} suitable models. `;
      reasoning += `The top recommendation is ${models[0].name} due to its ${models[0].downloads} downloads and popularity. `;
    }

    if (constraints.requiresCommercialLicense) {
      reasoning += `Filtered for commercial-friendly licenses. `;
    }

    if (constraints.preferredLibrary) {
      reasoning += `Prioritized ${constraints.preferredLibrary} library compatibility. `;
    }

    return reasoning;
  }

  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'User-Agent': 'CodeCrucible-Synth',
    };

    if (this.config.apiKey) {
      headers['Authorization'] = `Bearer ${this.config.apiKey}`;
    }

    return headers;
  }

  private handleError(error: any): void {
    if (error.response?.status === 401) {
      logger.error('Hugging Face API authentication failed');
    } else if (error.response?.status === 429) {
      logger.error('Hugging Face API rate limit exceeded');
    } else if (error.code === 'ECONNABORTED') {
      logger.error('Hugging Face API request timed out');
    }
  }

  /**
   * Public utility methods
   */

  /**
   * Test API connectivity
   */
  async testConnection(): Promise<boolean> {
    if (!this.config.enabled) {
      return false;
    }

    try {
      await this.searchModels('test', { limit: 1 });
      return true;
    } catch (error) {
      logger.warn('Hugging Face connection test failed:', error);
      return false;
    }
  }

  /**
   * Get usage statistics
   */
  getUsageStats(): any {
    return {
      requestCount: this.requestCount,
      isEnabled: this.config.enabled,
      hasApiKey: !!this.config.apiKey,
    };
  }

  /**
   * Get model download URL for local use
   */
  getModelDownloadUrl(modelId: string): string {
    return `${this.config.baseUrl.replace('/api', '')}/${modelId}`;
  }

  /**
   * Get model card URL for detailed information
   */
  getModelCardUrl(modelId: string): string {
    return `https://huggingface.co/${modelId}`;
  }
}
