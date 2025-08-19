/**
 * Auto-Setup Module for CodeCrucible Synth
 * Handles first-time setup and environment configuration
 */

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface SetupStatus {
  required: boolean;
  ollama: boolean;
  models: string[];
  lmStudio: boolean;
}

export interface SetupResult {
  success: boolean;
  message: string;
  details: {
    ollama: boolean;
    models: string[];
    lmStudio: boolean;
  };
}

export class AutoSetup {
  async checkSetupStatus(): Promise<SetupStatus> {
    const ollama = await this.checkOllama();
    const models = await this.checkModels();
    const lmStudio = await this.checkLMStudio();
    
    // Only require setup for commands that need AI models
    // Allow basic commands (help, version, status) to work without models
    const isBasicCommand = process.argv.some(arg => 
      ['--help', '-h', '--version', '-v', 'status', 'help'].includes(arg)
    );
    
    return {
      required: !isBasicCommand && (!ollama || models.length === 0),
      ollama,
      models,
      lmStudio
    };
  }

  async performSetup(): Promise<SetupResult> {
    const result: SetupResult = {
      success: false,
      message: '',
      details: {
        ollama: false,
        models: [],
        lmStudio: false
      }
    };

    try {
      // Check Ollama installation
      result.details.ollama = await this.checkOllama();
      
      if (!result.details.ollama) {
        console.log('⚠️ Ollama not detected. Running in degraded mode.');
        result.message = 'Running without AI models';
        result.success = true; // Allow degraded mode
        return result;
      }

      // Check models
      result.details.models = await this.checkModels();
      
      if (result.details.models.length === 0) {
        console.log('⚠️ No models found. Continuing in degraded mode.');
        result.message = 'No models available';
      }

      // Check LM Studio
      result.details.lmStudio = await this.checkLMStudio();

      result.success = result.details.ollama;
      result.message = result.success ? 'Setup completed' : 'Partial setup';
      
      return result;
    } catch (error) {
      result.message = `Setup failed: ${error.message}`;
      return result;
    }
  }

  private async checkOllama(): Promise<boolean> {
    try {
      await execAsync('ollama --version');
      return true;
    } catch {
      return false;
    }
  }

  private async checkModels(): Promise<string[]> {
    try {
      const { stdout } = await execAsync('ollama list');
      const lines = stdout.split('\n').slice(1); // Skip header
      const models = lines
        .filter(line => line.trim())
        .map(line => line.split(/\s+/)[0])
        .filter(model => model && !model.includes('NAME'));
      return models;
    } catch {
      return [];
    }
  }

  private async checkLMStudio(): Promise<boolean> {
    try {
      // Check if LM Studio is running by trying to connect to default port
      const response = await fetch('http://localhost:1234/v1/models', {
        method: 'GET',
        signal: AbortSignal.timeout(2000)
      });
      return response.ok;
    } catch {
      return false;
    }
  }
}

export const autoSetup = new AutoSetup();