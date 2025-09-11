/**
 * Test script to verify cross-platform Rust module loading
 */

import {
  loadRustExecutorSafely,
  getPlatformInfo,
  generateBinaryNames,
} from './dist/utils/rust-module-loader.js';

console.log('🧪 Testing Cross-Platform Rust Module Loader');
console.log('='.repeat(50));

// Test platform detection
console.log('\n📋 Platform Information:');
const platformInfo = getPlatformInfo();
console.log(`Platform: ${platformInfo.platform}`);
console.log(`Architecture: ${platformInfo.arch}`);
if (platformInfo.abi) {
  console.log(`ABI: ${platformInfo.abi}`);
}

// Test binary name generation
console.log('\n🔍 Expected Binary Names:');
const binaryNames = generateBinaryNames('codecrucible-rust-executor');
binaryNames.forEach((name, index) => {
  console.log(`${index + 1}. ${name}`);
});

// Test Rust module loading
console.log('\n🦀 Rust Module Loading Test:');
try {
  const result = loadRustExecutorSafely();

  if (result.available) {
    console.log('✅ SUCCESS: Rust module loaded successfully!');
    console.log(`📍 Binary path: ${result.binaryPath}`);

    // Test basic functionality
    console.log('\n🔧 Testing Basic Functionality:');
    try {
      const executor = new result.module.RustExecutor();
      console.log('✅ RustExecutor instance created successfully');

      // Test initialization
      executor.initialize();
      console.log('✅ RustExecutor initialized successfully');

      // Test health check
      const health = executor.healthCheck();
      console.log('✅ Health check passed:', JSON.stringify(health, null, 2));

      // Test version
      if (result.module.getVersion) {
        const version = result.module.getVersion();
        console.log('✅ Version:', version);
      }
    } catch (funcError) {
      console.log('⚠️  Module loaded but function test failed:', funcError.message);
    }
  } else {
    console.log('❌ FAILED: Rust module not available');
    console.log(`💥 Error: ${result.error}`);

    console.log('\n🔍 Troubleshooting Information:');
    console.log('Expected binary names (in order of preference):');
    binaryNames.forEach((name, index) => {
      console.log(`  ${index + 1}. ${name}`);
    });

    console.log('\nSuggested actions:');
    console.log('1. Run "npm run build:rust" to build the Rust executor');
    console.log('2. Check that the binary exists in the rust/ directory');
    console.log('3. Verify the binary name matches your platform');
  }
} catch (error) {
  console.log('💥 CRITICAL ERROR during module loading:', error.message);
  console.log('Stack:', error.stack);
}

console.log('\n' + '='.repeat(50));
console.log('🏁 Cross-platform Rust module loading test completed');
