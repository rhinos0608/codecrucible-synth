import { showHelp, showStatus } from './help.js';
import { bootstrapToolRegistration } from './bootstrap/tool-registration.js';
import type { ParsedCLIArgs } from './args-parser.js';

export async function dispatchCommand(parsed: ParsedCLIArgs): Promise<boolean> {
  switch (parsed.command) {
    case 'version': {
      const { getVersion } = await import('../../utils/version.js');
      console.log(`CodeCrucible Synth v${await getVersion()} (Unified Architecture)`);
      return true;
    }
    case 'help': {
      showHelp();
      return true;
    }
    case 'status': {
      await showStatus();
      return true;
    }
    case 'models': {
      const { ModelsCommand } = await import('./models-command.js');
      const modelsCommand = new ModelsCommand();
      await modelsCommand.execute(parsed.options);
      return true;
    }
    case 'tools': {
      await bootstrapToolRegistration();
      const { ToolsCommand } = await import('./tools-command.js');
      const toolsCommand = new ToolsCommand();
      await toolsCommand.execute(parsed.options);
      return true;
    }
    default:
      return false;
  }
}

export default dispatchCommand;
