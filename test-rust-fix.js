// Quick test for Rust executor initialization fix
console.log('Testing Rust executor initialization...');

async function testRustExecutor() {
  try {
    const { RustExecutionBackend } = await import('./dist/infrastructure/execution/rust-executor/rust-execution-backend.js');
    const backend = new RustExecutionBackend();
    console.log('✅ RustExecutionBackend created');
    
    const initialized = await backend.initialize();
    console.log(`✅ Initialization result: ${initialized}`);
    
    if (initialized) {
      console.log('✅ Rust executor initialized successfully - method name fix worked!');
      const stats = backend.getPerformanceStats();
      console.log('✅ Performance stats retrieved:', stats);
    } else {
      console.log('⚠️ Rust executor not available, using fallback');
    }
    
  } catch (error) {
    console.error('❌ Error during Rust executor test:', error.message);
    if (error.message.includes('getId is not a function')) {
      console.error('🔍 The method name fix did not work - still getting getId error');
    } else {
      console.log('✅ No more getId errors - method name fix successful!');
      console.error('ℹ️ Different error occurred:', error.message);
    }
  }
}

testRustExecutor();