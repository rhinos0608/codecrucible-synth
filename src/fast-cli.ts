/**
 * Fast CLI Entry Point - Minimal initialization for simple commands
 * Bypasses heavy imports for performance-critical operations
 */

import { getVersion } from './utils/version.js';
import { logger } from './infrastructure/logging/logger.js';

function showBasicHelp(): void {
  console.log('Usage:');
  console.log('  crucible [options] <prompt>');
  console.log('  cc [options] <prompt>');
  console.log();
  console.log('Options:');
  console.log('  --help, -h           Show this help message');
  console.log('  --version, -v        Show version');
  console.log('  --file <path>        Write output to file');
  console.log('  --stream             Enable real-time streaming responses (default: enabled)');
  console.log('  --no-stream          Disable streaming, show complete response at once');
  console.log('  --no-autonomous      Disable autonomous mode (not recommended)');
  console.log('  --context-aware      Enable enhanced context awareness (default: enabled)');
  console.log('  --no-intelligence    Disable project intelligence analysis');
  console.log('  --smart-suggestions  Enable intelligent command suggestions');
  console.log('  --project-analysis   Perform comprehensive project analysis');
  console.log('  --verbose            Show detailed output');
  console.log('  --server             Start server mode');
  console.log('  --port <number>      Server port (default: 3002)');
  console.log();
  console.log('Commands:');
  console.log('  status               Show system status');
  console.log('  models               List available models');
  console.log('  interactive, -i      Start interactive chat mode (default with no args)');
  console.log('  recommend            Show intelligent model recommendations');
  console.log('  analyze <file>       Analyze a code file');
  console.log('  analyze-dir [dir]    Analyze a directory/project');
  console.log('  intelligence         Show comprehensive project intelligence');
  console.log('  suggestions [ctx]    Get smart suggestions for current context');
  console.log();
  console.log('Examples:');
  console.log('  cc                   Start interactive mode');
  console.log('  crucible "Create a React component for a todo list"');
  console.log('  cc --interactive     Explicitly start interactive chat');
  console.log('  cc --voices explorer,developer "Analyze this codebase"');
}

async function showQuickStatus(): Promise<void> {
  console.log('CodeCrucible Synth Status');
  console.log('-'.repeat(40));
  console.log(`Version: ${await getVersion()}`);
  console.log(`Node.js: ${process.version}`);
  console.log(`Platform: ${process.platform}`);

  try {
    const controller = new AbortController();
    const healthCheckTimeout = Number.parseInt(process.env.HEALTH_CHECK_TIMEOUT || '3000', 10);
    const timeoutId = setTimeout(() => controller.abort(), healthCheckTimeout);

    const ollamaEndpoint = process.env.OLLAMA_ENDPOINT || 'http://localhost:11434';
    const response = await fetch(`${ollamaEndpoint}/api/tags`, { signal: controller.signal });
    clearTimeout(timeoutId);
    console.log(response.ok ? 'Ollama: Available' : 'Ollama: Service error');
  } catch {
    console.log('Ollama: Not available');
  }

  try {
    const controller = new AbortController();
    const healthCheckTimeout = Number.parseInt(process.env.HEALTH_CHECK_TIMEOUT || '3000', 10);
    const timeoutId = setTimeout(() => controller.abort(), healthCheckTimeout);

    const lmStudioEndpoint = process.env.LM_STUDIO_ENDPOINT || 'http://localhost:1234';
    const response = await fetch(`${lmStudioEndpoint}/v1/models`, { signal: controller.signal });
    clearTimeout(timeoutId);
    console.log(response.ok ? 'LM Studio: Available' : 'LM Studio: Service error');
  } catch {
    console.log('LM Studio: Not available');
  }

  console.log('-'.repeat(40));
}

async function showAvailableModels(): Promise<void> {
  console.log('Available Models');
  console.log('-'.repeat(40));
  console.log();

  // Ollama models
  try {
    const controller = new AbortController();
    const modelListTimeout = Number.parseInt(process.env.MODEL_LIST_TIMEOUT || '5000', 10);
    const timeoutId = setTimeout(() => controller.abort(), modelListTimeout);

    const ollamaEndpoint = process.env.OLLAMA_ENDPOINT || 'http://localhost:11434';
    const response = await fetch(`${ollamaEndpoint}/api/tags`, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (response.ok) {
      type OllamaTags = { models?: Array<{ name: string }> };
      const data: OllamaTags = await response.json();
      console.log('Ollama Models:');
      if (Array.isArray(data.models) && data.models.length > 0) {
        for (const m of data.models) {
          console.log(`  - ${m.name}`);
        }
      } else {
        console.log('  No models installed');
      }
    }
  } catch {
    console.log('Ollama: Not available');
  }

  // LM Studio models
  try {
    const controller = new AbortController();
    const modelListTimeout = Number.parseInt(process.env.MODEL_LIST_TIMEOUT || '5000', 10);
    const timeoutId = setTimeout(() => controller.abort(), modelListTimeout);

    const lmStudioEndpoint = process.env.LM_STUDIO_ENDPOINT || 'http://localhost:1234';
    const response = await fetch(`${lmStudioEndpoint}/v1/models`, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (response.ok) {
      type LMStudioModels = { data?: Array<{ id: string }> };
      const data: LMStudioModels = await response.json();
      console.log();
      console.log('LM Studio Models:');
      if (Array.isArray(data.data) && data.data.length > 0) {
        for (const m of data.data) {
          console.log(`  - ${m.id}`);
        }
      } else {
        console.log('  No models loaded');
      }
    }
  } catch {
    console.log();
    console.log('LM Studio: Not available');
  }

  console.log();
  console.log('-'.repeat(40));
  console.log('Use "crucible status" for full system status');
}

export async function fastMain(): Promise<void> {
  try {
    const args = process.argv.slice(2);

    if (args.includes('--help') || args.includes('-h')) {
      showBasicHelp();
      return;
    }

    if (args.includes('--version') || args.includes('-v')) {
      console.log(`CodeCrucible Synth v${await getVersion()}`);
      return;
    }

    if (args[0] === 'status') {
      await showQuickStatus();
      return;
    }

    if (args[0] === 'models') {
      await showAvailableModels();
      return;
    }

    console.log('Loading full system for complex operations...');
    const { main } = await import('./index.js');
    return main();
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Fast CLI error occurred', { error: errorMessage });
    console.error('Error:', error);
    process.exitCode = 1;
  }
}

if (
  process.argv[1] &&
  (process.argv[1].includes('fast-cli.js') || process.argv[1].endsWith('fast-cli.ts'))
) {
  fastMain().catch((error: unknown) => {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.fatal('Fast CLI fatal error', err);
    console.error('Fatal error:', error);
    process.exitCode = 1;
  });
}
