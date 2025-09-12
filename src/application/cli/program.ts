import { Command } from 'commander';
import { getVersion } from '../../utils/version.js';
import { runCLI } from './run-cli.js';
import type { CLIOptions } from '../interfaces/unified-cli.js';

export async function buildProgram(): Promise<Command> {
  const program = new Command();

  program
    .name('codecrucible')
    .description('CodeCrucible Synth - AI-Powered Development Assistant (Unified Architecture)')
    .version(await getVersion())
    .argument('[prompt...]', 'AI prompt to process')
    .option('-i, --interactive', 'Start interactive mode')
    .option('-v, --verbose', 'Verbose output')
    .option('--no-stream', 'Disable streaming responses')
    .option('--no-intelligence', 'Disable context awareness')
    .option('--no-autonomous', 'Disable autonomous mode')
    .option('--no-performance', 'Disable performance optimization')
    .option('--no-resilience', 'Disable error resilience')
    .action(
      async (
        prompt: readonly string[] = [],
        options: Readonly<{
          interactive?: boolean;
          verbose?: boolean;
          noStream?: boolean;
          noIntelligence?: boolean;
          noAutonomous?: boolean;
          noPerformance?: boolean;
          noResilience?: boolean;
        }>
      ) => {
        // Default to interactive mode if no arguments provided
        const shouldBeInteractive = options.interactive || (prompt.length === 0);
        const args = shouldBeInteractive ? ['interactive'] : prompt;
        const cliOptions: CLIOptions = {
          verbose: options.verbose ?? false,
          stream: !options.noStream,
          contextAware: !options.noIntelligence,
          autonomousMode: !options.noAutonomous,
          performance: !options.noPerformance,
          resilience: !options.noResilience,
        };
        await runCLI(args, cliOptions, shouldBeInteractive);
      }
    );

  program
    .command('models')
    .description('Manage AI models')
    .option('-l, --list', 'List all available models')
    .option('-s, --select', 'Interactive model selection')
    .option('-i, --interactive', 'Same as --select')
    .action(
      async (options: Readonly<{ list?: boolean; select?: boolean; interactive?: boolean }>) => {
        const { ModelsCommand } = await import('./models-command.js');
        const modelsCommand = new ModelsCommand();
        const modelsOptions = {
          list: !!options.list,
          select: !!options.select || !!options.interactive,
          interactive: !!options.interactive,
        };
        await modelsCommand.execute(modelsOptions);
      }
    );

  program
    .command('status')
    .description('Show system status')
    .action(async () => {
      const { showStatus } = await import('./help.js');
      await showStatus();
    });

  program
    .command('tools')
    .description('List available tools and telemetry')
    .option('--json', 'Output as JSON')
    .option('--limit <n>', 'Limit number of names shown', (v: string) => parseInt(v, 10), 50)
    .action(async (options: Readonly<{ json?: boolean; limit?: number }>) => {
      // Initialize MCP system before showing tools
      const { logger } = await import('../../infrastructure/logging/logger.js');
      logger.info('Initializing MCP system for tools command...');
      const { bootstrapMcpServers } = await import('../../mcp-servers/mcp-bootstrap.js');
      await bootstrapMcpServers();
      
      const { ToolsCommand } = await import('./tools-command.js');
      const cmd = new ToolsCommand();
      await cmd.execute({ json: !!options.json, limit: options.limit });
    });

  // Vector index commands
  const { attachIndexCommands } = await import('./index-command.js');
  attachIndexCommands(program);

  return program;
}

export default buildProgram;
