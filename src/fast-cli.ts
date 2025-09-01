/**
 * Fast CLI Entry Point - Minimal initialization for simple commands
 * Bypasses heavy imports for performance-critical operations
 */

import { readFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Get package version (async version)
async function getPackageVersion(): Promise<string> {
  try {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    const packagePath = join(__dirname, '..', 'package.json');
    const packageData = await readFile(packagePath, 'utf-8');
    const packageJson = JSON.parse(packageData);
    return packageJson.version;
  } catch {
    return '4.0.6'; // Updated fallback version
  }
}

function showBasicHelp() {
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

async function showQuickStatus() {
  console.log('📊 CodeCrucible Synth Status');
  console.log('━'.repeat(40));
  console.log(`Version: ${await getPackageVersion()}`);
  console.log(`Node.js: ${process.version}`);
  console.log(`Platform: ${process.platform}`);

  // Quick Ollama check with 1 second timeout
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 1000);

    const response = await fetch('http://localhost:11434/api/tags', {
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (response.ok) {
      console.log('✅ Ollama: Available');
    } else {
      console.log('❌ Ollama: Service error');
    }
  } catch (error) {
    console.log('❌ Ollama: Not available');
  }

  // Quick LM Studio check with 1 second timeout
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 1000);

    const response = await fetch('http://localhost:1234/v1/models', {
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (response.ok) {
      console.log('✅ LM Studio: Available');
    } else {
      console.log('❌ LM Studio: Service error');
    }
  } catch (error) {
    console.log('❌ LM Studio: Not available');
  }

  console.log('━'.repeat(40));
}

async function showAvailableModels() {
  console.log('🤖 Available Models');
  console.log('━'.repeat(40));
  console.log();

  // Quick Ollama models check
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);

    const response = await fetch('http://localhost:11434/api/tags', {
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      console.log('📦 Ollama Models:');
      if (data.models && data.models.length > 0) {
        data.models.forEach((model: any) => {
          console.log(`  • ${model.name}`);
        });
      } else {
        console.log('  No models installed');
      }
    }
  } catch (error) {
    console.log('❌ Ollama: Not available');
  }

  // Quick LM Studio models check
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);

    const response = await fetch('http://localhost:1234/v1/models', {
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      console.log();
      console.log('🏛️ LM Studio Models:');
      if (data.data && data.data.length > 0) {
        data.data.forEach((model: any) => {
          console.log(`  • ${model.id}`);
        });
      } else {
        console.log('  No models loaded');
      }
    }
  } catch (error) {
    console.log();
    console.log('❌ LM Studio: Not available');
  }

  console.log();
  console.log('━'.repeat(40));
  console.log('💡 Use "crucible status" for full system status');
}

export async function fastMain() {
  try {
    const args = process.argv.slice(2);

    // Fast commands that don't need AI models or full initialization
    if (args.includes('--help') || args.includes('-h')) {
      showBasicHelp();
      return;
    }

    if (args.includes('--version') || args.includes('-v')) {
      console.log(`CodeCrucible Synth v${await getPackageVersion()}`);
      return;
    }

    // Status command with minimal initialization
    if (args[0] === 'status') {
      await showQuickStatus();
      return;
    }

    // Models command with minimal initialization
    if (args[0] === 'models') {
      await showAvailableModels();
      return;
    }

    // For complex commands, delegate to the full system
    console.log('🔄 Loading full system for complex operations...');
    const { main } = await import('./index.js');
    return main();
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

// Auto-run when executed directly
if (
  process.argv[1] &&
  (process.argv[1].includes('fast-cli.js') || process.argv[1].endsWith('fast-cli.ts'))
) {
  fastMain().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}
