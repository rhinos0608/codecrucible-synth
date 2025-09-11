// Test Rust-TypeScript integration
import {
  RustExecutor,
  createRustExecutor,
  initLogging,
} from './src/core/execution/rust/rust-native-module.js';

async function testRustIntegration() {
  try {
    console.log('🚀 Testing Rust-TypeScript integration...');

    // Test module loading
    console.log('📦 Available exports:', { RustExecutor, createRustExecutor, initLogging });

    // Test creating an executor
    console.log('🔧 Creating RustExecutor instance...');
    const executor = new RustExecutor();

    // Test basic functionality
    console.log('🆔 Executor ID:', executor.id);
    console.log('🛠️ Supported tools:', executor.getSupportedTools());
    console.log('📁 Filesystem operations:', executor.getFilesystemOperations());
    console.log('⌨️ Supported commands:', executor.getSupportedCommands());

    // Test initialization
    console.log('⚙️ Initializing executor...');
    const initResult = executor.initialize();
    console.log('✅ Initialization result:', initResult);

    // Test health check
    console.log('❤️ Health check:', executor.healthCheck());

    // Test execution
    console.log('🏃 Testing execution...');
    const execResult = executor.execute('filesystem', '{"operation":"read","path":"test.txt"}');
    console.log('📋 Execution result:', execResult);

    // Test performance metrics
    console.log('📊 Performance metrics:', executor.getPerformanceMetrics());

    console.log('✅ All tests passed! Rust-TypeScript integration is working.');
  } catch (error) {
    console.error('❌ Integration test failed:', error.message);
    console.error('Stack trace:', error.stack);
  }
}

testRustIntegration();
