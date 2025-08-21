/**
 * CLI Display Module
 * Handles all display and output formatting for the CLI
 */

import chalk from 'chalk';
import ora from 'ora';
import { SynthesisResult, ExecutionRequest } from '../types.js';
import { StreamingAgentClient } from '../streaming/streaming-agent-client.js';

export class CLIDisplay {
  /**
   * Display synthesis results with proper formatting
   */
  static displayResults(synthesis: SynthesisResult, responses: any[]): void {
    console.log(chalk.green('\n🎯 Synthesis Complete!'));
    console.log(chalk.gray(`   Quality Score: ${(synthesis.qualityScore * 100).toFixed(0)}/100`));
    console.log(chalk.gray(`   Voices Used: ${synthesis.voicesUsed?.join(', ') || 'N/A'}`));

    // Show combined result
    console.log(chalk.bold('\n📄 Final Synthesis:'));
    console.log(synthesis.content || synthesis.combinedCode || 'No content available');

    // Show individual responses
    if (responses && responses.length > 0) {
      console.log(chalk.bold('\n👥 Individual Voice Responses:'));
      responses.forEach((response, index) => {
        console.log(chalk.cyan(`\n   ${index + 1}. ${response.voice || 'Unknown Voice'}:`));
        console.log(
          response.content?.substring(0, 200) + (response.content?.length > 200 ? '...' : '')
        );
      });
    }
  }

  /**
   * Display streaming responses in real-time
   */
  static async displayStreamingResponse(
    request: ExecutionRequest,
    streamingClient: StreamingAgentClient
  ): Promise<void> {
    let buffer = '';
    let lastUpdate = Date.now();
    const spinner = ora('🤖 Generating response...').start();

    try {
      for await (const chunk of streamingClient.executeStreaming(request)) {
        const now = Date.now();

        switch (chunk.type) {
          case 'progress':
            spinner.text = `🤖 ${chunk.chunk} (${Math.round(chunk.metadata.estimatedCompletion * 100)}%)`;
            break;

          case 'partial':
            buffer += chunk.chunk;

            // Update display every 100ms to prevent flickering
            if (now - lastUpdate > 100) {
              spinner.stop();
              process.stdout.write('\r\x1b[K'); // Clear current line
              process.stdout.write(chalk.cyan('🤖 ') + buffer + chalk.gray('▋')); // Show cursor
              lastUpdate = now;
            }
            break;

          case 'complete':
            spinner.stop();
            process.stdout.write('\r\x1b[K'); // Clear current line
            console.log(chalk.green('\n📝 Response:'));
            console.log(buffer);
            break;

          case 'error':
            spinner.stop();
            console.error(chalk.red('\n❌ Error:'), chunk.chunk);
            break;
        }
      }
    } catch (error) {
      spinner.stop();
      console.error(chalk.red('\n❌ Streaming Error:'), error);
    }
  }

  /**
   * Show CLI help information
   */
  static showHelp(): void {
    console.log(chalk.bold('\n🔨 CodeCrucible Synth - AI-Powered Development Tool\n'));

    console.log(chalk.cyan('📖 USAGE:'));
    console.log('  crucible [options] [command]');
    console.log('  crucible <prompt>');
    console.log('  crucible analyze [files...]');
    console.log('  crucible generate <prompt>');

    console.log(chalk.cyan('\n⚡ COMMANDS:'));
    console.log('  analyze [files...]     Analyze files or directories');
    console.log('  generate <prompt>      Generate code from prompt');
    console.log('  status                 Show system status');
    console.log('  models                 List available models');
    console.log('  configure              Configure the system');

    console.log(chalk.cyan('\n🎛️  OPTIONS:'));
    console.log('  --voices <names>       Specific voices to use');
    console.log('  --mode <mode>          Synthesis mode (competitive, collaborative, consensus)');
    console.log('  --interactive          Enter interactive mode');
    console.log('  --spiral               Use spiral methodology');
    console.log('  --autonomous           Enable autonomous mode');
    console.log('  --no-stream            Disable streaming responses (streaming is default)');
    console.log('  --fast                 Use fast mode');
    console.log('  --verbose              Verbose output');
    console.log('  --quiet                Quiet mode');
    console.log('  --help                 Show this help');

    console.log(chalk.cyan('\n📚 EXAMPLES:'));
    console.log('  crucible "Create a REST API for user management"');
    console.log('  crucible analyze src/');
    console.log('  crucible --voices Explorer,Architect "Design a microservice"');
    console.log('  crucible --spiral --autonomous "Refactor this codebase"');

    console.log(
      chalk.gray(
        '\n💡 For more information, visit: https://github.com/rhinos0608/codecrucible-synth'
      )
    );
  }

  /**
   * Display model recommendations
   */
  static async showModelRecommendations(): Promise<void> {
    console.log(chalk.bold('\n🤖 Model Recommendations\n'));

    const models = [
      { name: 'qwen2.5-coder:7b', type: 'Coding', performance: 'High', size: '4.4GB' },
      { name: 'deepseek-coder:8b', type: 'Coding', performance: 'High', size: '4.9GB' },
      { name: 'llama3.1:8b', type: 'General', performance: 'Medium', size: '4.7GB' },
      { name: 'codestral:22b', type: 'Coding', performance: 'Very High', size: '13GB' },
    ];

    console.log(chalk.cyan('📋 Recommended Models:'));
    models.forEach(model => {
      const perfColor =
        model.performance === 'Very High'
          ? 'green'
          : model.performance === 'High'
            ? 'yellow'
            : 'gray';
      console.log(
        `  ${chalk.bold(model.name)} - ${model.type} (${chalk[perfColor](model.performance)} - ${model.size})`
      );
    });

    console.log(chalk.gray('\n💡 Install with: ollama pull <model-name>'));
  }

  /**
   * Get performance indicator for a model
   */
  static getModelPerformance(model: string): string {
    const highPerf = ['qwen2.5-coder', 'deepseek-coder', 'codestral'];
    const mediumPerf = ['llama3.1', 'mistral'];

    if (highPerf.some(h => model.includes(h))) return chalk.green('●');
    if (mediumPerf.some(m => model.includes(m))) return chalk.yellow('●');
    return chalk.gray('●');
  }
}
