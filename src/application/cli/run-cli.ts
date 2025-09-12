import { CLIOptions } from '../interfaces/unified-cli.js';
import { logger } from '../../infrastructure/logging/logger.js';
import { getErrorMessage } from '../../utils/error-utils.js';
import { enterpriseErrorHandler } from '../../infrastructure/error-handling/enterprise-error-handler.js';
import { ErrorSeverity } from '../../infrastructure/error-handling/structured-error-system.js';
import { showHelp, showStatus } from './help.js';
import initialize from '../bootstrap/initialize.js';
import parseCLIArgs from './args-parser.js';
import { bootstrapToolRegistration } from './bootstrap/tool-registration.js';

export async function runCLI(
  args: readonly string[],
  cliOptions: Readonly<CLIOptions>,
  isInteractive: boolean
): Promise<void> {
  try {
    const parsed = parseCLIArgs(args);

    if (parsed.command === 'version') {
      const { getVersion } = await import('../../utils/version.js');
      console.log(`CodeCrucible Synth v${await getVersion()} (Unified Architecture)`);
      return;
    }

    if (parsed.command === 'help') {
      showHelp();
      return;
    }

    if (parsed.command === 'status') {
      await showStatus();
      return;
    }

    if (parsed.command === 'models') {
      const { ModelsCommand } = await import('./models-command.js');
      const modelsCommand = new ModelsCommand();
      await modelsCommand.execute(parsed.options);
      return;
    }

    if (parsed.command === 'tools') {
      await bootstrapToolRegistration();
      const { ToolsCommand } = await import('./tools-command.js');
      const toolsCommand = new ToolsCommand();
      await toolsCommand.execute(parsed.options);
      return;
    }

    const { cli, serviceFactory } = await initialize(cliOptions as CLIOptions, isInteractive);

    // Graceful shutdown
    let cleanedUp = false;
    const cleanup = async (): Promise<void> => {
      if (cleanedUp) return;
      cleanedUp = true;
      logger.info('Application shutdown initiated');
      console.log('\n🔻 Shutting down gracefully...');
      cli.shutdown();
      await serviceFactory.dispose();
    };

    process.on('SIGINT', () => {
      void cleanup();
    });
    process.on('SIGTERM', () => {
      void cleanup();
    });

    await cli.run(parsed.args);
    if (!isInteractive) {
      await cleanup();
    }
  } catch (error) {
    try {
      const structuredError = await enterpriseErrorHandler.handleEnterpriseError(error as Error, {
        operation: 'cli_startup',
        resource: 'main_application',
        requestId: `cli-${Date.now()}`,
        context: { args: args.join(' '), isInteractive },
      });

      logger.error('Application error occurred', {
        userMessage: structuredError.userMessage,
        suggestedActions: structuredError.suggestedActions,
        category: structuredError.category,
        severity: structuredError.severity,
      });

      console.error('✖ Application Error:', structuredError.userMessage);
      if (structuredError.suggestedActions?.length) {
        console.error('→ Suggested actions:');
        structuredError.suggestedActions.forEach(action => console.error(`  • ${action}`));
      }

      process.exitCode = structuredError.severity === ErrorSeverity.CRITICAL ? 1 : 2;
    } catch (handlerError) {
      logger.fatal('Fatal error with handler failure', undefined, {
        originalError: getErrorMessage(error),
        handlerError: getErrorMessage(handlerError),
      });
      console.error('✖ Fatal error:', getErrorMessage(error));
      console.error('✖ Error handler also failed:', getErrorMessage(handlerError));
      process.exitCode = 1;
    }
  }
}

export default runCLI;
