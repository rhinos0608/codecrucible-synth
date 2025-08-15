import { exec } from 'child_process';
import { promisify } from 'util';
import { existsSync, writeFileSync } from 'fs';
import { mkdir } from 'fs/promises';
import { join } from 'path';
import { logger } from './logger.js';

const execAsync = promisify(exec);

export interface SetupResult {
  success: boolean;
  message: string;
  details: {
    ollama: boolean;
    models: string[];
    config: boolean;
  };
}

export class AutoSetup {
  private static instance: AutoSetup;
  private setupCompleted = false;

  static getInstance(): AutoSetup {
    if (!AutoSetup.instance) {
      AutoSetup.instance = new AutoSetup();
    }
    return AutoSetup.instance;
  }

  async performSetup(force = false): Promise<SetupResult> {
    if (this.setupCompleted && !force) {
      return {
        success: true,
        message: 'Setup already completed',
        details: { ollama: true, models: [], config: true }
      };
    }

    const result: SetupResult = {
      success: false,
      message: '',
      details: { ollama: false, models: [], config: false }
    };

    try {
      // Check and install Ollama
      const ollamaSetup = await this.setupOllama();
      result.details.ollama = ollamaSetup.success;

      if (!ollamaSetup.success) {
        result.message = ollamaSetup.message;
        return result;
      }

      // Pull required models
      const modelSetup = await this.setupModels();
      result.details.models = modelSetup.models;

      // Create configuration
      const configSetup = await this.setupConfiguration();
      result.details.config = configSetup;

      result.success = result.details.ollama && result.details.models.length > 0 && result.details.config;
      result.message = result.success ? 'Setup completed successfully' : 'Setup partially completed';

      this.setupCompleted = result.success;
      return result;

    } catch (error) {
      logger.error('Setup failed:', error);
      result.message = error instanceof Error ? error.message : 'Setup failed';
      return result;
    }
  }

  private async setupOllama(): Promise<{ success: boolean; message: string }> {
    try {
      const { stdout } = await execAsync('ollama --version');
      logger.info(`Ollama already installed: ${stdout.trim()}`);
      
      const running = await this.checkOllamaRunning();
      if (!running) {
        await this.startOllama();
      }
      
      return { success: true, message: 'Ollama ready' };
    } catch (error) {
      return await this.installOllama();
    }
  }

  private async installOllama(): Promise<{ success: boolean; message: string }> {
    const platform = process.platform;
    
    switch (platform) {
      case 'linux':
      case 'darwin':
        try {
          logger.info('Installing Ollama for Unix systems...');
          await execAsync('curl -fsSL https://ollama.com/install.sh | sh');
          await this.startOllama();
          return { success: true, message: 'Ollama installed successfully' };
        } catch (error) {
          return { 
            success: false, 
            message: 'Failed to install Ollama. Please install manually from https://ollama.com/' 
          };
        }

      case 'win32':
        return { 
          success: false, 
          message: 'Please install Ollama manually from https://ollama.com/download/windows' 
        };

      default:
        return { 
          success: false, 
          message: `Unsupported platform: ${platform}` 
        };
    }
  }

  private async checkOllamaRunning(): Promise<boolean> {
    try {
      await execAsync('curl -s http://localhost:11434/api/tags');
      return true;
    } catch {
      return false;
    }
  }

  private async startOllama(): Promise<void> {
    logger.info('Starting Ollama service...');
    
    if (process.platform === 'win32') {
      exec('ollama serve');
    } else {
      exec('nohup ollama serve > /dev/null 2>&1 &');
    }

    // Wait for service to start
    for (let i = 0; i < 30; i++) {
      if (await this.checkOllamaRunning()) {
        logger.info('Ollama service started');
        return;
      }
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    throw new Error('Failed to start Ollama service');
  }

  private async setupModels(): Promise<{ models: string[] }> {
    const modelTiers = [
      // Tier 1: High-capability models (longer timeout)
      { models: ['qwen2.5:7b', 'gemma2:9b'], timeout: 600000, description: 'high-capability' },
      // Tier 2: Medium models (moderate timeout)
      { models: ['llama3.2:8b', 'codellama:7b'], timeout: 450000, description: 'medium-capability' },
      // Tier 3: Fast models (short timeout)
      { models: ['gemma:2b', 'phi3:mini', 'qwen2.5:3b'], timeout: 180000, description: 'fast-lightweight' },
      // Tier 4: Emergency fallbacks (very short timeout)
      { models: ['phi:latest', 'tinyllama:latest'], timeout: 120000, description: 'emergency-fallback' }
    ];

    const installedModels: string[] = [];
    let currentTier = 0;

    // Check if any models are already installed
    const existingModels = await this.checkExistingModels();
    if (existingModels.length > 0) {
      logger.info(`Found existing models: ${existingModels.join(', ')}`);
      return { models: existingModels };
    }

    while (installedModels.length === 0 && currentTier < modelTiers.length) {
      const tier = modelTiers[currentTier];
      logger.info(`Attempting ${tier.description} models (Tier ${currentTier + 1}/${modelTiers.length})`);

      for (const model of tier.models) {
        try {
          logger.info(`Pulling ${model} (timeout: ${tier.timeout / 1000}s)...`);
          
          // Progressive pull with chunks and progress monitoring
          await this.pullModelWithProgress(model, tier.timeout);
          
          installedModels.push(model);
          logger.info(`✅ Successfully pulled: ${model}`);
          
          // For high-capability models, try to get one more as backup
          if (currentTier === 0 && installedModels.length < 2) {
            continue;
          } else {
            break; // Got enough models for this tier
          }
        } catch (error) {
          logger.warn(`❌ Failed to pull ${model}: ${error instanceof Error ? error.message : 'Unknown error'}`);
          
          // If it's a network timeout, try smaller model immediately
          if (error instanceof Error && error.message.includes('timeout')) {
            logger.info('Network timeout detected, switching to faster models...');
            currentTier = Math.min(currentTier + 1, modelTiers.length - 1);
            break;
          }
          continue;
        }
      }
      currentTier++;
    }

    if (installedModels.length === 0) {
      throw new Error('Failed to install any models. Please check your internet connection and Ollama installation.');
    }

    logger.info(`🎉 Successfully installed ${installedModels.length} model(s): ${installedModels.join(', ')}`);
    return { models: installedModels };
  }

  private async checkExistingModels(): Promise<string[]> {
    try {
      const { stdout } = await execAsync('ollama list');
      return stdout.split('\n')
        .slice(1)
        .filter(line => line.trim())
        .map(line => line.split(/\s+/)[0])
        .filter(model => model && !model.includes('NAME'));
    } catch {
      return [];
    }
  }

  private async pullModelWithProgress(model: string, timeout: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const child = exec(`ollama pull ${model}`);
      const timer = setTimeout(() => {
        child.kill();
        reject(new Error(`Timeout after ${timeout / 1000}s`));
      }, timeout);

      let lastProgress = Date.now();
      
      if (child.stdout) {
        child.stdout.on('data', (data: string) => {
          lastProgress = Date.now();
          // Log progress but filter out excessive output
          if (data.includes('pulling') || data.includes('verifying') || data.includes('success')) {
            logger.info(`  ${data.trim()}`);
          }
        });
      }

      if (child.stderr) {
        child.stderr.on('data', (data: string) => {
          lastProgress = Date.now();
          logger.warn(`  ${data.trim()}`);
        });
      }

      // Monitor for stalled downloads
      const stallMonitor = setInterval(() => {
        if (Date.now() - lastProgress > 60000) { // 1 minute without progress
          logger.warn(`  Model ${model} appears stalled, continuing...`);
          lastProgress = Date.now(); // Reset to avoid spam
        }
      }, 30000);

      child.on('close', (code) => {
        clearTimeout(timer);
        clearInterval(stallMonitor);
        
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Pull failed with exit code ${code}`));
        }
      });

      child.on('error', (error) => {
        clearTimeout(timer);
        clearInterval(stallMonitor);
        reject(error);
      });
    });
  }

  private async setupConfiguration(): Promise<boolean> {
    try {
      const configDir = join(process.cwd(), '.codecrucible');
      if (!existsSync(configDir)) {
        await mkdir(configDir, { recursive: true });
      }

      const configPath = join(configDir, 'auto-config.json');
      const config = {
        model: {
          endpoint: 'http://localhost:11434',
          name: 'llama3.2:latest',
          timeout: 30000,
          maxTokens: 20000,
          temperature: 0.7
        },
        features: {
          autoSetup: true,
          gpu: true,
          fileWatching: true
        },
        setupCompleted: true,
        setupTimestamp: Date.now()
      };

      writeFileSync(configPath, JSON.stringify(config, null, 2));
      logger.info('Configuration created');
      return true;
    } catch (error) {
      logger.error('Failed to create configuration:', error);
      return false;
    }
  }

  async checkSetupStatus(): Promise<{ required: boolean; details: any }> {
    const checks: {
      ollama: boolean;
      running: boolean;
      models: string[];
      config: boolean;
    } = {
      ollama: false,
      running: false,
      models: [],
      config: false
    };

    try {
      await execAsync('ollama --version');
      checks.ollama = true;
    } catch {}

    checks.running = await this.checkOllamaRunning();

    if (checks.running) {
      try {
        const { stdout } = await execAsync('ollama list');
        checks.models = stdout.split('\n')
          .slice(1)
          .filter(line => line.trim())
          .map(line => line.split(/\s+/)[0]);
      } catch {}
    }

    const configPath = join(process.cwd(), '.codecrucible', 'auto-config.json');
    checks.config = existsSync(configPath);

    const required = !checks.ollama || !checks.running || checks.models.length === 0;

    return { required, details: checks };
  }
}

export const autoSetup = AutoSetup.getInstance();