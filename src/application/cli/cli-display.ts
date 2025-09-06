/**
 * CLI Display Module
 * Handles all display and output formatting for the CLI
 */

import chalk from 'chalk';
// import ora from 'ora';
import { VoiceCoordinatorResult } from '../../voices/voice-system-coordinator.js';

export interface VoiceResponse {
  readonly voice: string;
  readonly content: string;
}

export class CLIDisplay {
  /**
   * Display synthesis results with proper formatting
   */
  public static displayResults(
    synthesis: Readonly<VoiceCoordinatorResult>,
    responses: readonly VoiceResponse[]
  ): void {
    console.log(chalk.green('\n🎯 Synthesis Complete!'));
    console.log(chalk.gray(`   Consensus: ${(synthesis.consensus * 100).toFixed(0)}/100`));
    console.log(chalk.gray(`   Voices Used: ${synthesis.voicesUsed.join(', ') || 'N/A'}`));

    // Show combined result
    console.log(chalk.bold('\n📄 Final Synthesis:'));
    console.log(synthesis.finalDecision || 'No decision available');

    // Show individual responses
    if (responses.length > 0) {
      console.log(chalk.bold('\n👥 Individual Voice Responses:'));
      responses.forEach((response, index) => {
        console.log(chalk.cyan(`\n   ${index + 1}. ${response.voice || 'Unknown Voice'}:`));
        console.log(
          response.content.substring(0, 200) + (response.content.length > 200 ? '...' : '')
        );
      });
    }
  }

  // Note: Streaming display methods were consolidated into CLI class
  // displayStreamingResponse method removed as it was unused

  /**
   * Show CLI help information
   */
  public static showHelp(): void {
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
  public static showModelRecommendations(): void {
    console.log(chalk.bold('\n🤖 Model Recommendations\n'));

    const models = [
      { name: 'llama3.1:8b', type: 'Function Calling', performance: 'Excellent', size: '4.7GB' },
      { name: 'deepseek-coder:8b', type: 'Coding', performance: 'High', size: '4.9GB' },
      { name: 'codestral:22b', type: 'Coding', performance: 'Very High', size: '13GB' },
    ];

    console.log(chalk.cyan('📋 Recommended Models:'));
    models.forEach((model: Readonly<(typeof models)[number]>) => {
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
  public static getModelPerformance(model: string): string {
    const highPerf = ['llama3.1', 'deepseek-coder', 'codestral'];
    const mediumPerf = ['mistral'];

    if (highPerf.some(h => model.includes(h))) return chalk.green('●');
    if (mediumPerf.some(m => model.includes(m))) return chalk.yellow('●');
    return chalk.gray('●');
  }
}
