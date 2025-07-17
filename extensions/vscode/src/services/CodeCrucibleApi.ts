// VS Code Extension - CodeCrucible API Service
// Following AI_INSTRUCTIONS.md security patterns and CodingPhilosophy.md consciousness principles

import axios, { AxiosInstance } from 'axios';
import * as vscode from 'vscode';
import { AuthenticationService } from './AuthenticationService';

export interface GenerationRequest {
  prompt: string;
  context?: {
    language?: string;
    filePath?: string;
    projectType?: string;
    dependencies?: string[];
    surroundingCode?: string;
  };
  voices: {
    perspectives: string[];
    roles: string[];
  };
  synthesisMode?: 'consensus' | 'competitive' | 'collaborative';
  maxSolutions?: number;
}

export interface GenerationResponse {
  sessionId: number;
  solutions: Array<{
    id: number;
    code: string;
    explanation: string;
    voiceType: string;
    confidence: number;
    metadata: any;
  }>;
  synthesisAvailable: boolean;
}

export interface SynthesisRequest {
  solutions: Array<{
    code: string;
    explanation: string;
    voiceType: string;
    confidence: number;
  }>;
  synthesisGoal: 'best_practices' | 'performance' | 'readability' | 'maintainability';
}

export interface SynthesisResponse {
  synthesizedCode: string;
  explanation: string;
  qualityScore: number;
  improvementSuggestions: string[];
  metadata: any;
}

export interface VoiceRecommendationResponse {
  recommendations: Array<{
    voiceType: string;
    confidence: number;
    reasoning: string;
    category: string;
  }>;
  metadata: any;
}

export class CodeCrucibleApi {
  private api: AxiosInstance;
  private authService: AuthenticationService;

  constructor(authService: AuthenticationService) {
    this.authService = authService;
    
    const config = vscode.workspace.getConfiguration('codecrucible');
    const baseURL = config.get('apiUrl', 'https://api.codecrucible.com');

    this.api = axios.create({
      baseURL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'CodeCrucible-VSCode-Extension/1.0.0'
      }
    });

    // Setup request interceptor to add API key
    this.api.interceptors.request.use((config) => {
      const apiKey = this.authService.getApiKey();
      if (apiKey) {
        config.headers['x-codecrucible-api-key'] = apiKey;
      }
      return config;
    });

    // Setup response interceptor for error handling
    this.api.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          this.authService.clearApiKey();
          vscode.window.showErrorMessage('CodeCrucible API key is invalid. Please re-authenticate.');
        }
        return Promise.reject(error);
      }
    );
  }

  async generate(request: GenerationRequest): Promise<GenerationResponse> {
    try {
      const response = await this.api.post('/api/extensions/generate', request);
      return response.data;
    } catch (error: any) {
      throw new Error(`Generation failed: ${error.response?.data?.error || error.message}`);
    }
  }

  async synthesize(request: SynthesisRequest): Promise<SynthesisResponse> {
    try {
      const response = await this.api.post('/api/extensions/synthesize', request);
      return response.data;
    } catch (error: any) {
      throw new Error(`Synthesis failed: ${error.response?.data?.error || error.message}`);
    }
  }

  async getRecommendations(prompt: string, context?: any): Promise<VoiceRecommendationResponse> {
    try {
      const response = await this.api.post('/api/extensions/recommendations', {
        prompt,
        context
      });
      return response.data;
    } catch (error: any) {
      throw new Error(`Recommendations failed: ${error.response?.data?.error || error.message}`);
    }
  }

  async checkHealth(): Promise<any> {
    try {
      const response = await this.api.get('/api/extensions/health');
      return response.data;
    } catch (error: any) {
      throw new Error(`Health check failed: ${error.response?.data?.error || error.message}`);
    }
  }

  async getUsage(): Promise<any> {
    try {
      const response = await this.api.get('/api/extensions/usage');
      return response.data;
    } catch (error: any) {
      throw new Error(`Usage fetch failed: ${error.response?.data?.error || error.message}`);
    }
  }

  // Test API connection and authentication
  async testConnection(): Promise<boolean> {
    try {
      await this.checkHealth();
      return true;
    } catch (error) {
      console.error('API connection test failed:', error);
      return false;
    }
  }

  // Get API status for display
  async getApiStatus(): Promise<{ connected: boolean; authenticated: boolean; error?: string }> {
    try {
      if (!this.authService.isAuthenticated()) {
        return { connected: false, authenticated: false, error: 'Not authenticated' };
      }

      await this.checkHealth();
      return { connected: true, authenticated: true };
    } catch (error: any) {
      return { 
        connected: false, 
        authenticated: this.authService.isAuthenticated(),
        error: error.message 
      };
    }
  }
}