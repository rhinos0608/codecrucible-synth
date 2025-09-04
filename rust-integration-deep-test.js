// Comprehensive Rust Integration Analysis Test
import {
  RustExecutor,
  createRustExecutor,
  initLogging,
} from './src/core/execution/rust-executor/rust-native-module.js';

async function deepTestRustIntegration() {
  try {
    console.log('🔍 DEEP ANALYSIS: Comprehensive Rust-TypeScript integration test...\n');

    // Initialize logging first
    console.log('📝 Initializing Rust logging...');
    await initLogging('debug');

    // Test creating an executor
    console.log('\n🔧 Creating RustExecutor instance...');
    const executor = new RustExecutor();

    console.log('Basic Info:');
    console.log('  🆔 Executor ID:', executor.id);
    console.log('  🛠️ Supported tools:', executor.getSupportedTools());
    console.log('  📁 Filesystem operations:', executor.getFilesystemOperations());
    console.log('  ⌨️ Supported commands:', executor.getSupportedCommands());

    // Test initialization
    console.log('\n⚙️ Initializing executor...');
    const initResult = executor.initialize();
    console.log('  ✅ Initialization result:', initResult);

    // Test health check
    console.log('\n❤️ Health check:');
    const healthResult = executor.healthCheck();
    console.log('  📊 Health status:', JSON.parse(healthResult));

    // Test performance metrics
    console.log('\n📊 Initial performance metrics:');
    console.log('  📈 Metrics:', JSON.parse(executor.getPerformanceMetrics()));

    console.log('\n🧪 TESTING ACTUAL IMPLEMENTATION vs PLACEHOLDERS:\n');

    // 1. Test Filesystem Operations
    console.log('📁 FILESYSTEM TESTS:');

    // Test 1: Check current directory exists
    console.log('  🔍 Testing exists operation on current directory...');
    const existsResult = executor.executeFilesystem('exists', '.', null, {
      securityLevel: 'medium',
      workingDirectory: process.cwd(),
    });
    console.log('    Result:', existsResult);
    console.log(
      '    🔬 Analysis: Success =',
      existsResult.success,
      ', Has actual result =',
      !!existsResult.result
    );

    // Test 2: List current directory
    console.log('\n  📋 Testing list operation on current directory...');
    const listResult = executor.executeFilesystem('list', '.', null, {
      securityLevel: 'medium',
      workingDirectory: process.cwd(),
    });
    console.log('    Result:', listResult);
    console.log(
      '    🔬 Analysis: Success =',
      listResult.success,
      ', Has actual result =',
      !!listResult.result
    );

    // Test 3: Try to read package.json
    console.log('\n  📖 Testing read operation on package.json...');
    const readResult = executor.executeFilesystem('read', 'package.json', null, {
      securityLevel: 'medium',
      workingDirectory: process.cwd(),
    });
    console.log('    Result:', readResult);
    console.log(
      '    🔬 Analysis: Success =',
      readResult.success,
      ', Has actual content =',
      readResult.result && readResult.result.length > 100
    );

    // 2. Test Command Operations
    console.log('\n⌨️ COMMAND TESTS:');

    // Test 1: Simple echo command
    console.log('  🗣️ Testing echo command...');
    const echoResult = executor.executeCommand('echo', ['hello', 'from', 'rust'], {
      securityLevel: 'medium',
      workingDirectory: process.cwd(),
      timeoutMs: 5000,
    });
    console.log('    Result:', echoResult);
    console.log(
      '    🔬 Analysis: Success =',
      echoResult.success,
      ', Contains expected output =',
      JSON.stringify(echoResult.result).includes('hello')
    );

    // Test 2: ls/dir command
    console.log('\n  📂 Testing ls/dir command...');
    const lsCommand = process.platform === 'win32' ? 'dir' : 'ls';
    const lsResult = executor.executeCommand(lsCommand, ['.'], {
      securityLevel: 'medium',
      workingDirectory: process.cwd(),
      timeoutMs: 5000,
    });
    console.log('    Result:', lsResult);
    console.log(
      '    🔬 Analysis: Success =',
      lsResult.success,
      ', Has directory listing =',
      JSON.stringify(lsResult.result).includes('package.json')
    );

    // 3. Test Generic Tool Execution
    console.log('\n🔧 GENERIC TOOL TESTS:');

    const genericResult = executor.execute(
      'filesystem',
      JSON.stringify({
        operation: 'exists',
        path: '.',
      }),
      {
        securityLevel: 'medium',
        workingDirectory: process.cwd(),
      }
    );
    console.log('  📋 Generic execute result:', genericResult);
    console.log('  🔬 Analysis: Success =', genericResult.success);

    // 4. Performance Analysis
    console.log('\n📊 PERFORMANCE ANALYSIS:');

    console.log('  📈 Final performance metrics:');
    const finalMetrics = JSON.parse(executor.getPerformanceMetrics());
    console.log('    Total requests:', finalMetrics.total_requests);
    console.log('    Successful requests:', finalMetrics.successful_requests);
    console.log('    Failed requests:', finalMetrics.failed_requests);
    console.log('    Average execution time:', finalMetrics.average_execution_time);

    // 5. Benchmark Test
    console.log('\n⚡ BENCHMARK TEST:');
    const benchmarkResult = executor.benchmark_execution
      ? executor.benchmark_execution(100)
      : 'Benchmark not available';
    console.log('  🏁 Benchmark (100 iterations):', benchmarkResult);

    console.log('\n🔍 IMPLEMENTATION STATUS ANALYSIS:');
    console.log('  ✅ Module Loading: WORKING');
    console.log('  ✅ Basic Interface: WORKING');
    console.log('  ✅ Health Checks: WORKING');
    console.log('  ❓ Filesystem Ops: NEEDS VERIFICATION');
    console.log('  ❓ Command Ops: NEEDS VERIFICATION');
    console.log('  ❓ Security Context: NEEDS VERIFICATION');
    console.log('  ❓ Performance Metrics: PLACEHOLDER STATUS');

    console.log('\n✅ Deep analysis completed!\n');
  } catch (error) {
    console.error('❌ Deep integration test failed:', error.message);
    console.error('Stack trace:', error.stack);
  }
}

deepTestRustIntegration();
