import { getVersion } from '../../utils/version.js';

export function showHelp(): void {
  console.log('🧪 CodeCrucible Synth - AI-Powered Development Assistant');
  console.log('=====================================================');
  console.log('');
  console.log('Usage:');
  console.log('  codecrucible [options] <prompt>');
  console.log('  crucible [options] <prompt>');
  console.log('  cc [options] <prompt>');
  console.log('');
  console.log('Commands:');
  console.log('  interactive, -i      Start interactive chat mode');
  console.log('  analyze <file>       Analyze a code file');
  console.log('  models              Manage AI models');
  console.log('  status              Show system status');
  console.log('  --help, -h          Show this help');
  console.log('  --version, -v       Show version');
  console.log('');
  console.log('Options:');
  console.log('  --verbose           Show detailed output');
  console.log('  --no-stream         Disable streaming responses');
  console.log('  --no-intelligence   Disable context awareness');
  console.log('  --no-autonomous     Disable autonomous mode');
  console.log('  --no-performance    Disable performance optimization');
  console.log('  --no-resilience     Disable error resilience');
}

export async function showStatus(): Promise<void> {
  console.log('📊 CodeCrucible Synth Status');
  console.log(''.padEnd(40, '─'));
  console.log(`Version: ${await getVersion()}`);
  console.log(`Node.js: ${process.version}`);
  console.log(`Platform: ${process.platform} ${process.arch}`);
  console.log(`Working Directory: ${process.cwd()}`);
  console.log('');
  console.log('🏗  Architecture: Unified Coordination System');
  console.log('⭕ Circular Dependencies: Eliminated');
  console.log('🧩 Code Complexity: Reduced via modular bootstrap');
  console.log('⚡ Performance: Optimized with lazy loading');
  console.log('🛡  Error Resilience: Automatic recovery enabled');
  console.log('🧠 Context Intelligence: Project-aware responses');
  console.log(''.padEnd(40, '─'));
}

