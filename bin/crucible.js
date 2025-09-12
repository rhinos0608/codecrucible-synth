#!/usr/bin/env node

/**
 * CodeCrucible Synth - One-liner CLI Entry Point
 * Supports: npx codecrucible-synth, npm i -g codecrucible-synth && crucible
 */

import { createRequire } from 'module';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';
import { spawn } from 'child_process';
import { promisify } from 'util';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const require = createRequire(import.meta.url);
const { version } = require('../package.json');

// Colors for output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logStep(message) {
  log(`🚀 ${message}`, 'cyan');
}

function logSuccess(message) {
  log(`✅ ${message}`, 'green');
}

function logError(message) {
  log(`❌ ${message}`, 'red');
}

function logWarning(message) {
  log(`⚠️  ${message}`, 'yellow');
}

function showBanner() {
  log('', 'blue');
  log('╔══════════════════════════════════════════════════════════════╗', 'blue');
  const bannerWidth = 62;
  const bannerText = `CodeCrucible Synth v${version}`;
  const padTotal = bannerWidth - bannerText.length;
  const padLeft = Math.floor(padTotal / 2);
  const padRight = bannerWidth - bannerText.length - padLeft;
  log(`║${' '.repeat(padLeft)}${bannerText}${' '.repeat(padRight)}║`, 'blue');
  log('║          Autonomous AI Coding Assistant for Local Models    ║', 'blue');
  log('╚══════════════════════════════════════════════════════════════╝', 'blue');
  log('');
}

async function checkAutoSetup() {
  try {
    // Check if auto-setup is needed
    const setupPath = join(__dirname, '../auto-setup.js');
    const setupUrl = new URL(`file:///${setupPath.replace(/\\/g, '/')}`);
    const setupModule = await import(setupUrl);
    const autoSetup = setupModule.autoSetup;

    const setupStatus = await autoSetup.checkSetupStatus();

    if (setupStatus.required) {
      logStep('First-time setup required...');

      const setupResult = await autoSetup.performSetup();

      if (setupResult.success) {
        logSuccess('Auto-setup completed successfully!');
        log(`Models: ${setupResult.details.models.join(', ')}`, 'green');
      } else {
        logWarning(`Setup partially completed: ${setupResult.message}`);

        if (!setupResult.details.ollama) {
          logError('Ollama installation failed. Please install manually:');
          log('  Windows: https://ollama.com/download/windows', 'yellow');
          log('  macOS/Linux: curl -fsSL https://ollama.com/install.sh | sh', 'yellow');
          process.exit(1);
        }

        if (setupResult.details.models.length === 0) {
          logWarning('No models installed. Continuing with basic functionality...');
        }
      }
    }
  } catch (error) {
    logWarning(`Auto-setup check failed: ${error.message}`);
    logStep('Continuing without auto-setup...');
  }
}

async function findMainEntry() {
  // Try different possible locations for the main entry
  const possiblePaths = [
    // Prefer built distribution first
    join(__dirname, '../dist/index.js'),
    join(__dirname, '../index.js'),
    join(__dirname, '../src/index.ts'),
    join(__dirname, '../cli.js'),
    join(__dirname, '../build/index.js'),
  ];

  for (const path of possiblePaths) {
    if (existsSync(path)) {
      return path;
    }
  }

  // If not found, try to build the project
  logStep('Built distribution not found, attempting to build...');

  try {
    const packageRoot = join(__dirname, '..');
    process.chdir(packageRoot);

    if (existsSync(join(packageRoot, 'package.json'))) {
      // Use spawn to stream output and avoid maxBuffer limits
      await new Promise((resolve, reject) => {
        const child = spawn(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', 'build'], {
          cwd: packageRoot,
          stdio: 'inherit',
          env: { ...process.env, NODE_OPTIONS: '--max_old_space_size=4096' },
        });
        child.on('exit', code => {
          if (code === 0) resolve();
          else reject(new Error(`Build failed with exit code ${code}`));
        });
        child.on('error', reject);
      });
      logSuccess('Build completed successfully');

      // Check again for dist files
      const distPath = join(__dirname, '../dist/index.js');
      if (existsSync(distPath)) {
        return distPath;
      }
    }
  } catch (error) {
    logError(`Build failed: ${error.message}`);
  }

  throw new Error('Could not find or build CodeCrucible Synth entry point');
}

async function main() {
  try {
    const args = process.argv.slice(2);

    if (args.includes('--version') || args.includes('-v')) {
      console.log(version);
      process.exit(0);
    }

    if (args.includes('--help') || args.includes('-h') || args.length === 0) {
      showBanner();
      console.log('Usage: crucible [options]');
      process.exit(0);
    }

    // Perform auto-setup if needed
    await checkAutoSetup();

    // Find and execute main entry point
    const mainEntry = await findMainEntry();

    // Import and run the main CLI
    const mainEntryUrl = new URL(`file:///${mainEntry.replace(/\\/g, '/')}`);
    const { main: cliMain } = await import(mainEntryUrl);

    if (typeof cliMain === 'function') {
      await cliMain();
    } else {
      logError('Invalid main entry point found');
      process.exit(1);
    }
  } catch (error) {
    logError(`Failed to start CodeCrucible Synth: ${error.message}`);

    if (error.message.includes('ENOENT') || error.message.includes('Cannot resolve')) {
      log('');
      log('🔧 Troubleshooting:', 'yellow');
      log('  1. Ensure Node.js 18+ is installed', 'yellow');
      log('  2. Try: npm install -g codecrucible-synth --force', 'yellow');
      log('  3. Or run from source: git clone && npm install && npm run dev', 'yellow');
      log('');
    }

    process.exit(1);
  }
}

// Handle process signals gracefully
process.on('SIGINT', () => {
  log('\n👋 Goodbye!', 'cyan');
  process.exit(0);
});

process.on('SIGTERM', () => {
  process.exit(0);
});

// Catch unhandled errors
process.on('unhandledRejection', error => {
  logError(`Unhandled error: ${error.message}`);
  process.exit(1);
});

// Run main function
main().catch(error => {
  logError(`Fatal error: ${error.message}`);
  process.exit(1);
});
