import { CLIOptions } from '../interfaces/unified-cli.js';
import { logger } from '../../infrastructure/logging/logger.js';
import { getErrorMessage } from '../../utils/error-utils.js';
import { enterpriseErrorHandler } from '../../infrastructure/error-handling/enterprise-error-handler.js';
import { ErrorSeverity } from '../../infrastructure/error-handling/structured-error-system.js';
import parseArguments from './parse-arguments.js';
import dispatchCommand from './command-dispatcher.js';
import initializeCLI from './initialize-cli.js';
import setupCleanup from './setup-cleanup.js';

export async function runCLI(
  args: readonly string[],
  cliOptions: Readonly<CLIOptions>,
  isInteractive: boolean
): Promise<void> {
  try {
    const parsed = parseArguments(args);
    const handled = await dispatchCommand(parsed);
    if (handled) {
      return;
    }

    const { cli, serviceFactory } = await initializeCLI(cliOptions, isInteractive);
    const cleanup = setupCleanup(cli, serviceFactory);

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
