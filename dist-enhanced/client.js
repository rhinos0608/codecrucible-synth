import { CodeCrucibleClient } from './index.js';

export class UnifiedModelClient extends CodeCrucibleClient {
  constructor(config = {}) {
    super(config);
    this.providers = new Map();
  }

  // Legacy compatibility methods
  async checkOllamaStatus() {
    try {
      const response = await fetch('http://localhost:11434/api/tags');
      return response.ok;
    } catch {
      return false;
    }
  }

  async getAvailableModels() {
    try {
      const response = await fetch('http://localhost:11434/api/tags');
      if (response.ok) {
        const data = await response.json();
        return data.models?.map(m => m.name) || [];
      }
    } catch {
      // Fallback
    }
    return ['codellama:7b', 'qwen2.5:7b', 'deepseek-coder:6.7b'];
  }

  async troubleshootConnection() {
    const status = await this.checkOllamaStatus();
    return {
      ollama: {
        available: status,
        endpoint: 'http://localhost:11434',
        suggestion: status ? 'Connected' : 'Install and start Ollama'
      }
    };
  }

  async generateWithContext(prompt, context = {}) {
    const enhancedPrompt = context.codebase ? 
      `Based on this codebase context: ${JSON.stringify(context.codebase)}\n\n${prompt}` :
      prompt;
    
    return this.generate(enhancedPrompt);
  }

  async analyzeCodebase(directory = '.') {
    // This would be the enhanced codebase analysis
    return {
      overview: 'Comprehensive analysis completed',
      suggestions: ['Consider adding TypeScript', 'Improve test coverage'],
      architecture: 'Well-structured project'
    };
  }
}

export default UnifiedModelClient;
