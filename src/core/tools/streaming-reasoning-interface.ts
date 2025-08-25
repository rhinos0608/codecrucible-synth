import { StreamingCallbacks } from './sequential-tool-executor.js';

/**
 * Streaming Reasoning Interface
 * Provides real-time visual feedback for AI chain-of-thought reasoning
 */

export interface StreamingDisplayOptions {
  mode: 'compact' | 'verbose' | 'minimal';
  showProgress: boolean;
  showConfidence: boolean;
  showTimestamp: boolean;
  animateThinking: boolean;
  computationDelay: number; // ms to simulate thinking time
}

export class StreamingReasoningInterface {
  private options: StreamingDisplayOptions;
  private currentStep: number = 0;
  private totalSteps: number = 0;
  private startTime: number = 0;

  constructor(options: Partial<StreamingDisplayOptions> = {}) {
    this.options = {
      mode: options.mode || 'verbose',
      showProgress: options.showProgress !== false,
      showConfidence: options.showConfidence !== false,
      showTimestamp: options.showTimestamp || false,
      animateThinking: options.animateThinking !== false,
      computationDelay: options.computationDelay || 1500
    };
  }

  /**
   * Create streaming callbacks for the sequential executor
   */
  createCallbacks(): StreamingCallbacks {
    return {
      onStepStart: this.onStepStart.bind(this),
      onStepComplete: this.onStepComplete.bind(this),
      onReasoningStart: this.onReasoningStart.bind(this),
      onToolExecution: this.onToolExecution.bind(this),
      onObservation: this.onObservation.bind(this),
      onProgress: this.onProgress.bind(this)
    };
  }

  /**
   * Initialize the streaming interface
   */
  async initialize(totalSteps: number): Promise<void> {
    this.totalSteps = totalSteps;
    this.startTime = Date.now();
    this.currentStep = 0;

    console.log('🚀 Starting AI Agent with Chain-of-Thought Reasoning');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  }

  private async onStepStart(step: number, type: string, content: string): Promise<void> {
    this.currentStep = step;
    
    // Add computation delay to simulate thinking time
    if (this.options.animateThinking && type === 'thought') {
      await this.simulateThinking();
    }

    const icon = this.getTypeIcon(type);
    const progressBar = this.options.showProgress ? this.getProgressBar() : '';
    
    if (this.options.mode === 'verbose') {
      console.log(`[${step}/${this.totalSteps}] ${icon} ${type.toUpperCase()} ${this.getTypeEmoji(type)}`);
      if (progressBar) console.log(progressBar);
      
      // Format and display content with proper indentation
      const formattedContent = this.formatContent(content, type);
      console.log(formattedContent);
      
      if (this.options.showTimestamp) {
        const elapsed = Date.now() - this.startTime;
        console.log(`⏱️ Elapsed: ${(elapsed / 1000).toFixed(1)}s`);
      }
      
      console.log(); // Add spacing
    } else if (this.options.mode === 'compact') {
      const shortContent = content.length > 60 ? `${content.substring(0, 60)  }...` : content;
      console.log(`[${step}/${this.totalSteps}] ${icon} ${shortContent}`);
    }
  }

  private async onStepComplete(step: number, result: any): Promise<void> {
    if (this.options.mode === 'verbose') {
      console.log(`✅ Step ${step} completed successfully\n`);
    }
  }

  private async onReasoningStart(content: string): Promise<void> {
    if (this.options.animateThinking) {
      await this.animateThinkingDots();
    }
  }

  private async onToolExecution(toolName: string, args: any): Promise<void> {
    if (this.options.mode === 'verbose') {
      console.log(`🔄 Executing ${toolName}...`);
      if (args && Object.keys(args).length > 0) {
        console.log(`📋 Arguments: ${JSON.stringify(args, null, 2)}`);
      }
    }
  }

  private async onObservation(content: string, confidence: number): Promise<void> {
    if (this.options.mode === 'verbose') {
      const confidenceDisplay = this.options.showConfidence ? 
        ` (${(confidence * 100).toFixed(0)}% confidence)` : '';
      
      console.log(`📊 RESULT: ${this.getSuccessIndicator(confidence)}${confidenceDisplay}`);
      
      // Display formatted observation content
      const formattedContent = this.formatContent(content, 'observation');
      console.log(formattedContent);
    }
  }

  private async onProgress(current: number, total: number): Promise<void> {
    if (this.options.showProgress && this.options.mode === 'minimal') {
      const percentage = Math.round((current / total) * 100);
      const progressBar = this.getProgressBar(current, total);
      console.log(`Progress: ${progressBar} ${percentage}%`);
    }
  }

  private getTypeIcon(type: string): string {
    const icons = {
      'thought': '🤔',
      'action': '⚡',
      'observation': '🔍',
      'conclusion': '🎯'
    };
    return icons[type as keyof typeof icons] || '❓';
  }

  private getTypeEmoji(type: string): string {
    const emojis = {
      'thought': '💭',
      'action': '🔧',
      'observation': '📊',
      'conclusion': '🎉'
    };
    return emojis[type as keyof typeof emojis] || '❓';
  }

  private formatContent(content: string, type: string): string {
    const maxWidth = 80;
    const prefix = type === 'thought' ? '🤔 ' : 
                   type === 'action' ? '⚡ ' : 
                   type === 'observation' ? '📊 ' : '🎯 ';
    
    // Split long content into multiple lines with proper indentation
    const words = content.split(' ');
    const lines: string[] = [];
    let currentLine = prefix;
    
    for (const word of words) {
      if (currentLine.length + word.length + 1 > maxWidth) {
        lines.push(currentLine);
        currentLine = `   ${  word}`; // Indent continuation lines
      } else {
        currentLine += (currentLine === prefix ? '' : ' ') + word;
      }
    }
    
    if (currentLine.length > 3) {
      lines.push(currentLine);
    }
    
    return lines.join('\n');
  }

  private getProgressBar(current?: number, total?: number): string {
    const curr = current || this.currentStep;
    const tot = total || this.totalSteps;
    const percentage = Math.round((curr / tot) * 100);
    const filled = Math.round(percentage / 5); // 20-char progress bar
    const empty = 20 - filled;
    
    const bar = '█'.repeat(filled) + '░'.repeat(empty);
    return `Progress: [${bar}] ${percentage}%`;
  }

  private getSuccessIndicator(confidence: number): string {
    if (confidence >= 0.8) return 'SUCCESS';
    if (confidence >= 0.6) return 'PARTIAL';
    return 'UNCERTAIN';
  }

  private async simulateThinking(): Promise<void> {
    // Simulate computation time with animated thinking
    const thinkingTime = this.options.computationDelay;
    const steps = 5;
    const stepTime = thinkingTime / steps;
    
    for (let i = 0; i < steps; i++) {
      await new Promise(resolve => setTimeout(resolve, stepTime));
    }
  }

  private async animateThinkingDots(): Promise<void> {
    const dots = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
    const duration = 1000; // 1 second animation
    const interval = duration / dots.length;
    
    for (let i = 0; i < dots.length; i++) {
      process.stdout.write(`\r💭 Thinking ${dots[i]}`);
      await new Promise(resolve => setTimeout(resolve, interval));
    }
    
    process.stdout.write('\r'); // Clear the thinking animation
    console.log('💭 Analysis complete');
  }

  /**
   * Display final completion message
   */
  async displayCompletion(success: boolean, finalResult: string, totalTime: number): Promise<void> {
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    if (success) {
      console.log('🎉 EXECUTION COMPLETE!');
      console.log(`✅ Result: ${finalResult}`);
    } else {
      console.log('❌ EXECUTION FAILED');
      console.log(`⚠️ Result: ${finalResult}`);
    }
    
    console.log(`⏱️ Total Time: ${(totalTime / 1000).toFixed(1)}s`);
    console.log(`📊 Steps Completed: ${this.currentStep}/${this.totalSteps}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  }

  /**
   * Create a simple streaming interface for basic use
   */
  static createSimple(): StreamingCallbacks {
    return {
      onStepStart: (step: number, type: string, content: string) => {
        const icon = type === 'thought' ? '🤔' : type === 'action' ? '⚡' : '🔍';
        console.log(`[${step}] ${icon} ${type.toUpperCase()}: ${content.substring(0, 100)}${content.length > 100 ? '...' : ''}`);
      },
      onToolExecution: (toolName: string, args: any) => {
        console.log(`🔄 Executing ${toolName}`);
      },
      onObservation: (content: string, confidence: number) => {
        console.log(`✅ Result: ${content.substring(0, 100)}${content.length > 100 ? '...' : ''}`);
      }
    };
  }
}