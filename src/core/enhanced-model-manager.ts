import axios, { AxiosInstance } from 'axios';
import { exec } from 'child_process';
import { promisify } from 'util';
import chalk from 'chalk';
import inquirer from 'inquirer';
import { logger } from './logger.js';

const execAsync = promisify(exec);

export interface ModelInfo {
  name: string;
  size: string;
  description: string;
  family?: string;
  parameters?: string;
  quantization?: string;
  available: boolean;
}

export interface PullProgress {
  status: string;
  digest?: string;
  total?: number;
  completed?: number;
  percentage?: number;
}

/**
 * Enhanced Model Manager for automatic model detection, installation, and management
 * Provides seamless Ollama integration with user-friendly model management
 */
export class EnhancedModelManager {
  private client: AxiosInstance;
  private ollamaEndpoint: string;
  
  // Recommended models in order of preference
  private recommendedModels: ModelInfo[] = [
    {
      name: 'qwq:32b-preview-q4_K_M',
      size: '18GB',
      description: 'Latest reasoning model with strong coding abilities',
      family: 'QwQ',
      parameters: '32B',
      quantization: 'Q4_K_M',
      available: false
    },
    {
      name: 'gemma2:27b',
      size: '15GB', 
      description: 'Google Gemma 2 - Excellent for coding and reasoning',
      family: 'Gemma',
      parameters: '27B',
      available: false
    },
    {
      name: 'qwen2.5:72b',
      size: '40GB',
      description: 'Alibaba Qwen 2.5 - Top-tier coding performance',
      family: 'Qwen',
      parameters: '72B',
      available: false
    },
    {
      name: 'llama3.1:70b',
      size: '39GB',
      description: 'Meta Llama 3.1 - Strong general capabilities',
      family: 'Llama',
      parameters: '70B',
      available: false
    },
    {
      name: 'codellama:34b',
      size: '19GB',
      description: 'Meta CodeLlama - Specialized for coding',
      family: 'CodeLlama',
      parameters: '34B',
      available: false
    },
    {
      name: 'gemma2:9b',
      size: '5.4GB',
      description: 'Google Gemma 2 9B - Good balance of size and performance',
      family: 'Gemma',
      parameters: '9B',
      available: false
    },
    {
      name: 'llama3.2:8b',
      size: '4.7GB',
      description: 'Meta Llama 3.2 8B - Efficient and capable',
      family: 'Llama',
      parameters: '8B',
      available: false
    },
    {
      name: 'qwen2.5:7b',
      size: '4.4GB',
      description: 'Alibaba Qwen 2.5 7B - Good for development',
      family: 'Qwen',
      parameters: '7B',
      available: false
    }
  ];

  constructor(endpoint: string = 'http://localhost:11434') {
    this.ollamaEndpoint = endpoint;
    this.client = axios.create({
      baseURL: endpoint,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * Check if Ollama is installed and running
   */
  async checkOllamaStatus(): Promise<{ installed: boolean; running: boolean; version?: string }> {
    try {
      // Check if Ollama is installed
      const { stdout } = await execAsync('ollama --version');
      const version = stdout.trim();
      
      // Check if Ollama is running
      try {
        await this.client.get('/api/tags');
        return { installed: true, running: true, version };
      } catch {
        return { installed: true, running: false, version };
      }
    } catch {
      return { installed: false, running: false };
    }
  }

  /**
   * Install Ollama automatically
   */
  async installOllama(): Promise<boolean> {
    console.log(chalk.blue('📦 Installing Ollama...'));
    
    let spinner: any;
    try {
      const { default: ora } = await import('ora');
      spinner = ora('Downloading and installing Ollama...').start();
    } catch (error) {
      console.log(chalk.blue('Downloading and installing Ollama...'));
      spinner = {
        succeed: (msg: string) => console.log(chalk.green('✓ ' + msg)),
        fail: (msg: string) => console.log(chalk.red('✗ ' + msg))
      };
    }
    
    try {
      // Determine OS and run appropriate install command
      const platform = process.platform;
      
      let installCommand = '';
      if (platform === 'linux' || platform === 'darwin') {
        installCommand = 'curl -fsSL https://ollama.ai/install.sh | sh';
      } else if (platform === 'win32') {
        // For Windows, we'll need to download the installer
        spinner.text = 'Please install Ollama manually from https://ollama.ai';
        spinner.warn();
        console.log(chalk.yellow('🪟 Windows Installation:'));
        console.log(chalk.gray('1. Visit https://ollama.ai'));
        console.log(chalk.gray('2. Download the Windows installer'));
        console.log(chalk.gray('3. Run the installer as administrator'));
        console.log(chalk.gray('4. Restart this application'));
        return false;
      }
      
      await execAsync(installCommand);
      spinner.succeed('Ollama installed successfully!');
      
      // Start Ollama service
      spinner.start('Starting Ollama service...');
      try {
        if (platform === 'darwin') {
          await execAsync('brew services start ollama');
        } else {
          // Try to start as systemd service on Linux
          try {
            await execAsync('sudo systemctl start ollama');
          } catch {
            // Fallback to manual start
            console.log(chalk.yellow('💡 Please start Ollama manually: ollama serve'));
          }
        }
        spinner.succeed('Ollama service started!');
        return true;
      } catch (error) {
        spinner.warn('Please start Ollama manually: ollama serve');
        return true;
      }
      
    } catch (error) {
      spinner.fail('Failed to install Ollama');
      logger.error('Ollama installation failed:', error);
      console.log(chalk.red('❌ Installation failed. Please install manually from https://ollama.ai'));
      return false;
    }
  }

  /**
   * Start Ollama server
   */
  async startOllama(): Promise<boolean> {
    // Dynamic import for ora to handle ESM compatibility
    let spinner: any;
    try {
      const { default: ora } = await import('ora');
      spinner = ora('Starting Ollama server...').start();
    } catch (error) {
      // Fallback without spinner if ora import fails
      console.log(chalk.blue('Starting Ollama server...'));
      spinner = {
        succeed: (msg: string) => console.log(chalk.green('✓ ' + msg)),
        fail: (msg: string) => console.log(chalk.red('✗ ' + msg))
      };
    }
    
    try {
      const platform = process.platform;
      
      if (platform === 'win32') {
        // On Windows, try to start the service
        await execAsync('net start "OllamaService" 2>nul || ollama serve &');
      } else if (platform === 'darwin') {
        // On macOS, use brew services or start manually
        try {
          await execAsync('brew services start ollama');
        } catch {
          await execAsync('ollama serve &');
        }
      } else {
        // On Linux, try systemd first, then manual
        try {
          await execAsync('sudo systemctl start ollama');
        } catch {
          await execAsync('ollama serve &');
        }
      }
      
      // Wait a bit for service to start
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Check if it's actually running
      const status = await this.checkOllamaStatus();
      if (status.running) {
        spinner.succeed('Ollama server started!');
        return true;
      } else {
        spinner.fail('Failed to start Ollama server');
        console.log(chalk.yellow('💡 Please start Ollama manually: ollama serve'));
        return false;
      }
      
    } catch (error) {
      spinner.fail('Failed to start Ollama server');
      logger.error('Failed to start Ollama:', error);
      console.log(chalk.yellow('💡 Please start Ollama manually: ollama serve'));
      return false;
    }
  }

  /**
   * Get list of available models from Ollama
   */
  async getAvailableModels(): Promise<ModelInfo[]> {
    try {
      const response = await this.client.get('/api/tags');
      const installedModels = response.data.models || [];
      
      // Update our recommended models list with availability
      const updatedModels = this.recommendedModels.map(model => ({
        ...model,
        available: installedModels.some((installed: any) => 
          installed.name === model.name || 
          installed.name.startsWith(model.name.split(':')[0])
        )
      }));
      
      // Add any installed models that aren't in our recommendations
      const additionalModels = installedModels
        .filter((installed: any) => 
          !this.recommendedModels.some(rec => 
            installed.name === rec.name || 
            installed.name.startsWith(rec.name.split(':')[0])
          )
        )
        .map((installed: any) => ({
          name: installed.name,
          size: this.formatSize(installed.size || 0),
          description: 'Installed model',
          available: true
        }));
      
      return [...updatedModels, ...additionalModels];
      
    } catch (error) {
      logger.error('Failed to get available models:', error);
      return this.recommendedModels;
    }
  }

  /**
   * Pull a model with progress tracking
   */
  async pullModel(modelName: string, onProgress?: (progress: PullProgress) => void): Promise<boolean> {
    let spinner: any;
    try {
      const { default: ora } = await import('ora');
      spinner = ora(`Pulling model: ${modelName}`).start();
    } catch (error) {
      console.log(chalk.blue(`Pulling model: ${modelName}...`));
      spinner = {
        succeed: (msg: string) => console.log(chalk.green('✓ ' + msg)),
        fail: (msg: string) => console.log(chalk.red('✗ ' + msg))
      };
    }
    
    try {
      const response = await this.client.post('/api/pull', {
        model: modelName,
        stream: true
      }, {
        responseType: 'stream',
        timeout: 0 // No timeout for model pulling
      });

      let lastProgress = 0;
      let buffer = '';

      return new Promise((resolve, reject) => {
        response.data.on('data', (chunk: Buffer) => {
          buffer += chunk.toString();
          
          // Process complete lines
          const lines = buffer.split('\n');
          buffer = lines.pop() || ''; // Keep incomplete line in buffer
          
          for (const line of lines) {
            if (line.trim()) {
              try {
                const progress: PullProgress = JSON.parse(line);
                
                if (progress.total && progress.completed) {
                  const percentage = Math.round((progress.completed / progress.total) * 100);
                  progress.percentage = percentage;
                  
                  if (percentage > lastProgress) {
                    spinner.text = `Pulling ${modelName}: ${percentage}% (${this.formatSize(progress.completed)}/${this.formatSize(progress.total)})`;
                    lastProgress = percentage;
                  }
                } else if (progress.status) {
                  spinner.text = `${modelName}: ${progress.status}`;
                }
                
                if (onProgress) {
                  onProgress(progress);
                }
                
                if (progress.status === 'success') {
                  spinner.succeed(`Successfully pulled ${modelName}!`);
                  resolve(true);
                  return;
                }
                
              } catch (parseError) {
                // Ignore JSON parse errors for incomplete chunks
              }
            }
          }
        });

        response.data.on('end', () => {
          spinner.succeed(`Successfully pulled ${modelName}!`);
          resolve(true);
        });

        response.data.on('error', (error: Error) => {
          spinner.fail(`Failed to pull ${modelName}`);
          logger.error('Model pull failed:', error);
          reject(error);
        });
      });

    } catch (error) {
      spinner.fail(`Failed to pull ${modelName}`);
      logger.error('Model pull failed:', error);
      return false;
    }
  }

  /**
   * Automatically setup the best available model
   */
  async autoSetup(interactive: boolean = true): Promise<{ model: string; success: boolean }> {
    console.log(chalk.blue('🚀 Setting up CodeCrucible with local AI models...\n'));
    
    // Step 1: Check Ollama status
    const status = await this.checkOllamaStatus();
    console.log(chalk.cyan('📋 System Status:'));
    console.log(chalk.gray(`   Ollama installed: ${status.installed ? '✅' : '❌'}`));
    console.log(chalk.gray(`   Ollama running: ${status.running ? '✅' : '❌'}`));
    if (status.version) {
      console.log(chalk.gray(`   Version: ${status.version}`));
    }
    console.log();
    
    // Step 2: Install/Start Ollama if needed
    if (!status.installed) {
      if (interactive) {
        const { shouldInstall } = await inquirer.prompt([{
          type: 'confirm',
          name: 'shouldInstall',
          message: 'Ollama is not installed. Would you like to install it now?',
          default: true
        }]);
        
        if (!shouldInstall) {
          console.log(chalk.yellow('⚠️  Ollama is required for CodeCrucible. Please install manually from https://ollama.ai'));
          return { model: '', success: false };
        }
      }
      
      const installed = await this.installOllama();
      if (!installed) {
        return { model: '', success: false };
      }
    }
    
    if (!status.running) {
      console.log(chalk.yellow('🔄 Starting Ollama server...'));
      const started = await this.startOllama();
      if (!started) {
        return { model: '', success: false };
      }
    }
    
    // Step 3: Check available models
    const availableModels = await this.getAvailableModels();
    const installedModels = availableModels.filter(m => m.available);
    
    if (installedModels.length > 0) {
      console.log(chalk.green('✅ Found installed models:'));
      installedModels.forEach(model => {
        console.log(chalk.gray(`   • ${model.name} (${model.size})`));
      });
      
      // Return the best available model
      const bestModel = installedModels[0];
      console.log(chalk.green(`🎯 Using model: ${bestModel.name}\n`));
      return { model: bestModel.name, success: true };
    }
    
    // Step 4: No models available, offer to install
    console.log(chalk.yellow('⚠️  No AI models found. CodeCrucible needs a local model to function.'));
    console.log(chalk.cyan('\n📚 Recommended models:\n'));
    
    const availableForInstall = this.recommendedModels.slice(0, 5);
    availableForInstall.forEach((model, i) => {
      console.log(chalk.white(`${i + 1}. ${model.name}`));
      console.log(chalk.gray(`   ${model.description}`));
      console.log(chalk.gray(`   Size: ${model.size} | Parameters: ${model.parameters}\n`));
    });
    
    if (interactive) {
      const { selectedModel } = await inquirer.prompt([{
        type: 'list',
        name: 'selectedModel',
        message: 'Which model would you like to install?',
        choices: availableForInstall.map((model, i) => ({
          name: `${model.name} (${model.size}) - ${model.description}`,
          value: model.name
        })).concat([
          { name: 'Skip for now (manual setup required)', value: 'skip' }
        ])
      }]);
      
      if (selectedModel === 'skip') {
        console.log(chalk.yellow('⚠️  Manual setup required. Run: ollama pull <model_name>'));
        return { model: '', success: false };
      }
      
      console.log(chalk.blue(`\n📥 Installing ${selectedModel}...`));
      const pullSuccess = await this.pullModel(selectedModel);
      
      if (pullSuccess) {
        console.log(chalk.green(`\n✅ Setup complete! CodeCrucible is ready with ${selectedModel}\n`));
        return { model: selectedModel, success: true };
      } else {
        console.log(chalk.red('❌ Model installation failed. Please try again or install manually.'));
        return { model: '', success: false };
      }
    } else {
      // Non-interactive: install the first recommended model
      const defaultModel = availableForInstall[0].name;
      console.log(chalk.blue(`📥 Auto-installing recommended model: ${defaultModel}...`));
      
      const pullSuccess = await this.pullModel(defaultModel);
      
      if (pullSuccess) {
        console.log(chalk.green(`\n✅ Setup complete! CodeCrucible is ready with ${defaultModel}\n`));
        return { model: defaultModel, success: true };
      } else {
        console.log(chalk.red('❌ Auto-installation failed. Please run setup manually.'));
        return { model: '', success: false };
      }
    }
  }

  /**
   * Get the best available model for use
   */
  async getBestAvailableModel(): Promise<string | null> {
    try {
      const availableModels = await this.getAvailableModels();
      const installedModels = availableModels.filter(m => m.available);
      
      if (installedModels.length === 0) {
        return null;
      }
      
      // Return the first (best) installed model
      return installedModels[0].name;
      
    } catch (error) {
      logger.error('Failed to get best available model:', error);
      return null;
    }
  }

  /**
   * Remove a model
   */
  async removeModel(modelName: string): Promise<boolean> {
    let spinner: any;
    try {
      const { default: ora } = await import('ora');
      spinner = ora(`Removing model: ${modelName}`).start();
    } catch (error) {
      console.log(chalk.blue(`Removing model: ${modelName}...`));
      spinner = {
        succeed: (msg: string) => console.log(chalk.green('✓ ' + msg)),
        fail: (msg: string) => console.log(chalk.red('✗ ' + msg))
      };
    }
    
    try {
      await execAsync(`ollama rm ${modelName}`);
      spinner.succeed(`Successfully removed ${modelName}!`);
      return true;
    } catch (error) {
      spinner.fail(`Failed to remove ${modelName}`);
      logger.error('Model removal failed:', error);
      return false;
    }
  }

  /**
   * Format bytes to human readable string
   */
  private formatSize(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  /**
   * Check if a specific model is available
   */
  async isModelAvailable(modelName: string): Promise<boolean> {
    try {
      const response = await this.client.get('/api/tags');
      const models = response.data.models || [];
      return models.some((model: any) => model.name === modelName);
    } catch {
      return false;
    }
  }

  /**
   * Test model connectivity
   */
  async testModel(modelName: string): Promise<boolean> {
    let spinner: any;
    try {
      const { default: ora } = await import('ora');
      spinner = ora(`Testing model: ${modelName}`).start();
    } catch (error) {
      console.log(chalk.blue(`Testing model: ${modelName}...`));
      spinner = {
        succeed: (msg: string) => console.log(chalk.green('✓ ' + msg)),
        fail: (msg: string) => console.log(chalk.red('✗ ' + msg))
      };
    }
    
    try {
      const response = await this.client.post('/api/generate', {
        model: modelName,
        prompt: 'Hello! Please respond with just "OK" to confirm you are working.',
        stream: false,
        options: {
          num_predict: 10
        }
      }, {
        timeout: 30000
      });
      
      if (response.data && response.data.response) {
        spinner.succeed(`Model ${modelName} is working correctly!`);
        return true;
      } else {
        spinner.fail(`Model ${modelName} test failed`);
        return false;
      }
      
    } catch (error) {
      spinner.fail(`Model ${modelName} test failed`);
      logger.error('Model test failed:', error);
      return false;
    }
  }
}
