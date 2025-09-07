import { logger } from '../infrastructure/logging/logger.js';

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
   * Helper method to make HTTP requests with 2025 best practices
   */
  private async makeRequest<T>(url: string): Promise<T> {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(this.config.timeout),
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return response.json() as Promise<T>;
  }

  /**
   * Search for models with advanced filtering
   */
  public async searchModels(
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

      const response = await this.makeRequest<{ 
        id: string;
        name?: string;
        description?: string;
        downloads?: number;
        likes?: number;
        tags?: string[];
        pipeline_tag?: string;
        library_name?: string;
        language?: string[];
        license?: string;
      }[]>(`${this.config.baseUrl}/models?${params.toString()}`);

      this.requestCount++;

      return Array.isArray(response)
        ? response.map((model) => this.processModelInfo(model))
        : [];
    } catch (error) {
      logger.error('Hugging Face model search failed:', error);
      this.handleError(error);
      throw error;
    }
  }

  /**
   * Get detailed information about a specific model
   */
  public async getModelInfo(modelId: string): Promise<ModelInfo> {
    if (!this.config.enabled) {
      throw new Error('Hugging Face integration is not enabled');
    }

    try {
      const response = await this.makeRequest<{
        id: string;
        name?: string;
        description?: string;
        downloads?: number;
        likes?: number;
        tags?: string[];
        pipeline_tag?: string;
        library_name?: string;
        language?: string[];
        license?: string;
      }>(`${this.config.baseUrl}/models/${modelId}`);

      this.requestCount++;

      return this.processModelInfo(response);
    } catch (error) {
      logger.error('Failed to get model info:', error);
      this.handleError(error);
      throw error;
    }
  }

  /**
   * Search for datasets
   */
  public async searchDatasets(
    query: string,
    options: Readonly<{
      task?: string;
      language?: string;
      size?: string;
      license?: string;
      sort?: 'downloads' | 'likes' | 'updated' | 'created';
      direction?: 'asc' | 'desc';
      limit?: number;
    }> = {}
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

      const response = await this.makeRequest<Array<{
        id: string;
        name?: string;
        description?: string;
        downloads?: number;
        likes?: number;
        tags?: string[];
        size_categories?: string[];
        language?: string[];
        license?: string;
      }>>(`${this.config.baseUrl}/datasets?${params.toString()}`);

      this.requestCount++;

      return Array.isArray(response)
        ? response.map((dataset) => this.processDatasetInfo(dataset))
        : [];
    } catch (error) {
      logger.error('Hugging Face dataset search failed:', error);
      this.handleError(error);
      throw error;
    }
  }

  /**
   * Search for Spaces (demos/applications)
   */
  public async searchSpaces(
    query: string,
    options: Readonly<{
      sdk?: string;
      sort?: 'likes' | 'updated' | 'created';
      direction?: 'asc' | 'desc';
      limit?: number;
    }> = {}
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

      const response = await this.makeRequest<Array<{
        id: string;
        name?: string;
        description?: string;
        likes?: number;
        sdk?: string;
        tags?: string[];
        runtime?: string;
      }>>(`${this.config.baseUrl}/spaces?${params.toString()}`);

      this.requestCount++;

      return Array.isArray(response)
        ? response.map((space) => this.processSpaceInfo(space))
        : [];
    } catch (error) {
      logger.error('Hugging Face spaces search failed:', error);
      this.handleError(error);
      throw error;
    }
  }

  /**
   * Find models suitable for a specific coding task
   */
  public async findCodeModels(
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

    const searchQuery = `${task} ${language ?? 'code'}`;

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
  public async getTrendingModels(
    category: string = 'text-generation'
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
  public async findModelsByCriteria(
    criteria: Readonly<{
      language?: string[];
      size?: 'small' | 'medium' | 'large';
      performance?: 'fast' | 'balanced' | 'quality';
      license?: 'commercial' | 'research' | 'open';
      task?: string;
    }>
  ): Promise<ModelInfo[]> {
    let query = '';
    const options: {
      task?: string;
      library?: string;
      language?: string;
      license?: string;
      sort?: 'downloads' | 'likes' | 'updated' | 'created';
      direction?: 'asc' | 'desc';
      limit?: number;
      filter?: string;
    } = {
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
      const licenseMap: Record<'commercial' | 'research' | 'open', string> = {
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
  public async getModelRecommendations(
    useCase: string,
    constraints: Readonly<{
      maxSize?: string;
      requiresCommercialLicense?: boolean;
      preferredLibrary?: string;
      performanceRequirement?: 'speed' | 'quality' | 'balanced';
    }> = {}
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
  private processModelInfo(data: Readonly<{
    id?: string;
    modelId?: string;
    name?: string;
    description?: string;
    downloads?: number;
    likes?: number;
    tags?: string[];
    pipeline_tag?: string;
    library_name?: string;
    language?: string[];
    license?: string;
  }>): ModelInfo {
    return {
      id: data.id ?? data.modelId ?? '',
      name: data.name ?? data.id ?? '',
      description: data.description ?? '',
      downloads: data.downloads ?? 0,
      likes: data.likes ?? 0,
      tags: data.tags ?? [],
      pipeline_tag: data.pipeline_tag,
      library_name: data.library_name,
      language: data.language,
      license: data.license,
      modelType: this.categorizeModel(data.pipeline_tag, data.tags ?? []),
    };
  }

  private processDatasetInfo(data: Readonly<{
    id?: string;
    name?: string;
    description?: string;
    downloads?: number;
    likes?: number;
    tags?: string[];
    size_categories?: string[];
    language?: string[];
    license?: string;
  }>): DatasetInfo {
    return {
      id: data.id ?? '',
      name: data.name ?? data.id ?? '',
      description: data.description ?? '',
      downloads: data.downloads ?? 0,
      likes: data.likes ?? 0,
      tags: data.tags ?? [],
      size: data.size_categories?.[0],
      language: data.language,
      license: data.license,
    };
  }

  private processSpaceInfo(data: {
    id?: string;
    name?: string;
    description?: string;
    likes?: number;
    sdk?: string;
    tags?: string[];
    runtime?: string;
  }): SpaceInfo {
    return {
      id: data.id ?? '',
      name: data.name ?? data.id ?? '',
      description: data.description ?? '',
      likes: data.likes ?? 0,
      sdk: data.sdk,
      tags: data.tags ?? [],
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
  private filterModelsByConstraints(
    models: ReadonlyArray<ModelInfo>,
    constraints: Readonly<{
      maxSize?: string;
      requiresCommercialLicense?: boolean;
      preferredLibrary?: string;
      performanceRequirement?: 'speed' | 'quality' | 'balanced';
    }>
  ): ModelInfo[] {
    return models
      .filter((model: Readonly<ModelInfo>) => {
        // Size constraint - extract parameter count from tags or model name
        if (constraints.maxSize) {
          const modelSize = this.extractModelSize(model);
          const maxSizeBytes = this.parseModelSize(constraints.maxSize);
          
          if (modelSize !== null && maxSizeBytes !== null && modelSize > maxSizeBytes) {
            return false;
          }
        }

        // Commercial license constraint
        if (constraints.requiresCommercialLicense) {
          const commercialLicenses = [
            'apache-2.0',
            'mit',
            'bsd-3-clause',
            'bsd-2-clause',
            'cc0-1.0',
            'unlicense',
            'apache',
            'bsd'
          ];
          
          if (model.license) {
            const normalizedLicense = model.license.toLowerCase().trim();
            const isCommercial = commercialLicenses.some(license => 
              normalizedLicense.includes(license) || 
              normalizedLicense === license
            );
            
            if (!isCommercial) {
              return false;
            }
          } else {
            // If no license specified and commercial is required, exclude
            return false;
          }
        }

        // Preferred library constraint
        if (constraints.preferredLibrary) {
          const preferredLib = constraints.preferredLibrary.toLowerCase();
          const modelLibrary = model.library_name?.toLowerCase();
          
          if (modelLibrary && modelLibrary !== preferredLib) {
            // Allow if library is mentioned in tags as fallback
            const hasLibraryTag = model.tags.some(tag => 
              tag.toLowerCase().includes(preferredLib)
            );
            
            if (!hasLibraryTag) {
              return false;
            }
          }
        }

        return true;
      })
      .sort((a, b) => {
        // Sort based on performance requirement
        if (constraints.performanceRequirement === 'speed') {
          // Prioritize smaller models and higher download counts
          const aSize = this.extractModelSize(a) ?? 0;
          const bSize = this.extractModelSize(b) ?? 0;
          const sizeDiff = aSize - bSize;
          
          if (Math.abs(sizeDiff) > 1e9) { // 1B parameter difference
            return sizeDiff;
          }
          
          return b.downloads - a.downloads;
        } else if (constraints.performanceRequirement === 'quality') {
          // Prioritize models with more likes and larger sizes
          const likeDiff = b.likes - a.likes;
          
          if (Math.abs(likeDiff) > 100) {
            return likeDiff;
          }
          
          const aSize = this.extractModelSize(a) ?? 0;
          const bSize = this.extractModelSize(b) ?? 0;
          return bSize - aSize;
        } else {
          // Balanced: combination of downloads and likes
          const aScore = a.downloads * 0.6 + a.likes * 0.4;
          const bScore = b.downloads * 0.6 + b.likes * 0.4;
          return bScore - aScore;
        }
      });
  }

  /**
   * Extract model size in parameters from model information
   */
  private extractModelSize(model: Readonly<ModelInfo>): number | null {
    // Check model name for size indicators
    const nameSize = this.extractSizeFromText(model.name);
    if (nameSize !== null) return nameSize;

    // Check model ID for size indicators
    const idSize = this.extractSizeFromText(model.id);
    if (idSize !== null) return idSize;

    // Check tags for size information
    for (const tag of model.tags) {
      const tagSize = this.extractSizeFromText(tag);
      if (tagSize !== null) return tagSize;
    }

    // Check description for size information
    if (model.description) {
      const descSize = this.extractSizeFromText(model.description);
      if (descSize !== null) return descSize;
    }

    return null;
  }

  /**
   * Extract parameter count from text using various patterns
   */
  private extractSizeFromText(text: string): number | null {
    if (!text) return null;

    const normalizedText = text.toLowerCase();
    
    // Patterns to match parameter counts
    const patterns = [
      // Exact patterns: "7b", "13b", "70b", etc.
      /(\d+(?:\.\d+)?)\s*b(?:illion)?(?:\s*param(?:eter)?s?)?/g,
      /(\d+(?:\.\d+)?)\s*m(?:illion)?(?:\s*param(?:eter)?s?)?/g,
      /(\d+(?:\.\d+)?)\s*k(?:ilo)?(?:\s*param(?:eter)?s?)?/g,
      
      // Hyphenated patterns: "llama-7b", "gpt-3.5"
      /-(\d+(?:\.\d+)?)\s*b/g,
      /-(\d+(?:\.\d+)?)\s*m/g,
      
      // Parameter patterns: "7 billion parameters"
      /(\d+(?:\.\d+)?)\s*billion\s*param/g,
      /(\d+(?:\.\d+)?)\s*million\s*param/g,
      /(\d+(?:\.\d+)?)\s*thousand\s*param/g,
      
      // Model size patterns: "small", "base", "large", "xl"
      /\b(tiny|small|mini|base|medium|large|xl|xxl|3xl)\b/g
    ];

    for (const pattern of patterns) {
      const matches = [...normalizedText.matchAll(pattern)];
      
      for (const match of matches) {
        if (match[1] && !isNaN(Number(match[1]))) {
          const value = parseFloat(match[1]);
          const unit = match[0].toLowerCase();
          
          if (unit.includes('b')) {
            return value * 1e9; // billion parameters
          } else if (unit.includes('m')) {
            return value * 1e6; // million parameters
          } else if (unit.includes('k')) {
            return value * 1e3; // thousand parameters
          }
        } else if (match[1]) {
          // Handle named sizes
          const sizeMap: Record<string, number> = {
            tiny: 100e6, // 100M
            mini: 100e6, // 100M
            small: 300e6, // 300M
            base: 700e6, // 700M
            medium: 1.5e9, // 1.5B
            large: 7e9, // 7B
            xl: 13e9, // 13B
            xxl: 30e9, // 30B
            '3xl': 70e9, // 70B
          };
          
          const size = sizeMap[match[1]];
          if (size) return size;
        }
      }
    }

    return null;
  }

  /**
   * Parse size constraint string to parameter count
   */
  private parseModelSize(sizeConstraint: string): number | null {
    const normalizedConstraint = sizeConstraint.toLowerCase().trim();
    
    // Handle size categories
    const categorySizes: Record<string, number> = {
      tiny: 100e6,
      small: 1e9,
      medium: 10e9,
      large: 50e9,
      huge: 100e9,
      xl: 100e9,
      xxl: 500e9
    };

    if (categorySizes[normalizedConstraint]) {
      return categorySizes[normalizedConstraint];
    }

    // Handle explicit parameter counts
    const sizePatterns = [
      /(\d+(?:\.\d+)?)\s*b(?:illion)?/,
      /(\d+(?:\.\d+)?)\s*m(?:illion)?/,
      /(\d+(?:\.\d+)?)\s*k(?:ilo)?/,
      /(\d+(?:\.\d+)?)\s*param/
    ];

    for (const pattern of sizePatterns) {
      const match = normalizedConstraint.match(pattern);
      if (match?.[1]) {
        const [unit, valueStr] = match;
        const value = parseFloat(valueStr);
        
        if (unit.includes('b')) {
          return value * 1e9;
        } else if (unit.includes('m')) {
          return value * 1e6;
        } else if (unit.includes('k')) {
          return value * 1e3;
        } else {
          return value; // Assume raw parameter count
        }
      }
    }

    // Try to parse as a raw number
    const rawNumber = parseFloat(normalizedConstraint);
    if (!isNaN(rawNumber)) {
      // If it's a large number, assume it's parameter count
      // If it's small, assume it's in billions
      return rawNumber > 1000 ? rawNumber : rawNumber * 1e9;
    }

    return null;
  }

  private generateRecommendationReasoning(
    taskAnalysis: { primaryTask: string; confidence: number },
    constraints: Readonly<{
      maxSize?: string;
      requiresCommercialLicense?: boolean;
      preferredLibrary?: string;
      performanceRequirement?: 'speed' | 'quality' | 'balanced';
    }>,
    models: ReadonlyArray<ModelInfo>
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
      headers.Authorization = `Bearer ${this.config.apiKey}`;
    }

    return headers;
  }

  private handleError(error: unknown): void {
    // Type guard for AxiosError
    const err = error as { response?: { status?: number }, code?: string };
    if (err.response?.status === 401) {
      logger.error('Hugging Face API authentication failed');
    } else if (err.response?.status === 429) {
      logger.error('Hugging Face API rate limit exceeded');
    } else if (err.code === 'ECONNABORTED') {
      logger.error('Hugging Face API request timed out');
    }
  }

  /**
   * Public utility methods
   */

  /**
   * Test API connectivity
   */
  public async testConnection(): Promise<boolean> {
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
  public getUsageStats(): { requestCount: number; isEnabled: boolean; hasApiKey: boolean } {
    return {
      requestCount: this.requestCount,
      isEnabled: this.config.enabled,
      hasApiKey: !!this.config.apiKey,
    };
  }

  /**
   * Get model download URL for local use
   */
  public getModelDownloadUrl(modelId: string): string {
    return `${this.config.baseUrl.replace('/api', '')}/${modelId}`;
  }

  /**
   * Get model card URL for detailed information
   */
  public getModelCardUrl(modelId: string): string {
    return `https://huggingface.co/${modelId}`;
  }
}
