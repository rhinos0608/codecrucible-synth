/**
 * Direct test of Rust module loading (CommonJS)
 * Tests cross-platform loading without TypeScript compilation
 */

const { existsSync } = require('fs');
const { join } = require('path');

console.log('🧪 Testing Direct Rust Module Loading');
console.log('=' .repeat(50));

// Test platform detection
console.log('\n📋 Platform Information:');
console.log(`Platform: ${process.platform}`);
console.log(`Architecture: ${process.arch}`);

// Generate expected binary names
function generateBinaryNames(baseName) {
  const platform = process.platform;
  const arch = process.arch;
  
  const platformMap = {
    'win32': 'win32',
    'darwin': 'darwin', 
    'linux': 'linux'
  };
  
  const archMap = {
    'x64': 'x64',
    'arm64': 'arm64',
    'ia32': 'ia32'
  };
  
  const napiPlatform = platformMap[platform] || platform;
  const napiArch = archMap[arch] || arch;
  
  const names = [];
  
  // Platform-specific with ABI (Windows)
  if (platform === 'win32') {
    names.push(`${baseName}.${napiPlatform}-${napiArch}-msvc.node`);
  }
  
  // Platform-specific without ABI
  names.push(`${baseName}.${napiPlatform}-${napiArch}.node`);
  
  // Generic fallbacks
  names.push(`${baseName}.node`);
  names.push('index.node');
  
  return names;
}

// Find NAPI binary
function findNAPIBinary(searchPaths, baseName) {
  const binaryNames = generateBinaryNames(baseName);
  
  console.log('\n🔍 Expected Binary Names:');
  binaryNames.forEach((name, index) => {
    console.log(`${index + 1}. ${name}`);
  });
  
  console.log('\n📁 Search Paths:');
  searchPaths.forEach((path, index) => {
    console.log(`${index + 1}. ${path}`);
  });
  
  for (const searchPath of searchPaths) {
    for (const binaryName of binaryNames) {
      const fullPath = join(searchPath, binaryName);
      
      if (existsSync(fullPath)) {
        console.log(`\n✅ Found NAPI binary: ${fullPath}`);
        return fullPath;
      }
    }
  }
  
  console.log('\n❌ No NAPI binary found');
  return null;
}

// Test binary search
const searchPaths = [
  join(__dirname, 'rust'),
  __dirname,
  join(__dirname, '../rust'),
];

const binaryPath = findNAPIBinary(searchPaths, 'codecrucible-rust-executor');

if (!binaryPath) {
  console.log('\n💥 FAILED: No Rust binary found');
  process.exit(1);
}

// Test loading the binary
console.log('\n🦀 Testing Rust Module Loading:');
try {
  const rustModule = require(binaryPath);
  console.log('✅ SUCCESS: Rust module loaded successfully!');
  
  // Check available exports
  console.log('\n📦 Available Exports:');
  const exports = Object.keys(rustModule);
  exports.forEach((exportName, index) => {
    console.log(`${index + 1}. ${exportName} (${typeof rustModule[exportName]})`);
  });
  
  // Test basic functionality
  if (rustModule.RustExecutor) {
    console.log('\n🔧 Testing RustExecutor:');
    try {
      const executor = new rustModule.RustExecutor();
      console.log('✅ RustExecutor instance created');
      
      // Test initialization
      executor.initialize();
      console.log('✅ RustExecutor initialized');
      
      // Test health check
      const health = executor.healthCheck();
      console.log('✅ Health check result:', JSON.stringify(health, null, 2));
      
      console.log('\n🔧 Testing Available Methods:');
      const methods = Object.getOwnPropertyNames(Object.getPrototypeOf(executor))
        .filter(name => name !== 'constructor' && typeof executor[name] === 'function');
      
      methods.forEach((method, index) => {
        console.log(`${index + 1}. ${method}()`);
      });
      
    } catch (funcError) {
      console.log('⚠️  RustExecutor test failed:', funcError.message);
    }
  }
  
  // Test version if available
  if (rustModule.getVersion) {
    try {
      const version = rustModule.getVersion();
      console.log('\n📋 Version:', version);
    } catch (e) {
      console.log('\n⚠️  Version check failed:', e.message);
    }
  }
  
} catch (error) {
  console.log('💥 FAILED to load Rust module:', error.message);
  console.log('Stack:', error.stack);
}

console.log('\n' + '='.repeat(50));
console.log('🏁 Direct Rust loading test completed');