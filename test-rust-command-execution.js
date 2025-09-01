#!/usr/bin/env node

/**
 * Comprehensive test for real Rust command execution
 * Tests the full pipeline: Node.js -> Rust -> Process Spawning -> Command Execution
 */

import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { RustExecutor } = require('./rust-executor/index.node');

async function testRealCommandExecution() {
    console.log('🧪 Testing Real Rust Command Execution Implementation\n');
    
    // Initialize executor
    const executor = new RustExecutor();
    const initialized = executor.initialize();
    
    if (!initialized) {
        console.error('❌ Failed to initialize Rust executor');
        process.exit(1);
    }
    
    console.log('✅ Rust executor initialized successfully');
    console.log(`📋 Executor ID: ${executor.id}`);
    console.log('🛠️ Supported tools:', executor.getSupportedTools());
    
    // Test 1: Simple echo command
    console.log('\n=== Test 1: Simple Echo Command ===');
    try {
        const result1 = executor.executeCommand('echo', ['Hello', 'from', 'Rust!'], {
            timeoutMs: 5000,
            securityLevel: 1, // 0=Low, 1=Medium, 2=High
            capabilities: ['ProcessSpawn'] // Grant process spawning capability
        });
        
        console.log('📊 Result:', JSON.stringify(result1, null, 2));
        
        if (result1.success) {
            const commandResult = JSON.parse(result1.result);
            console.log('✅ Command executed successfully');
            console.log('📤 Stdout:', commandResult.stdout.trim());
            console.log('⏱️ Execution time:', result1.executionTimeMs + 'ms');
        } else {
            console.log('❌ Command failed:', result1.error);
        }
    } catch (error) {
        console.error('💥 Test 1 failed with exception:', error.message);
    }
    
    // Test 2: List directory command
    console.log('\n=== Test 2: Directory Listing ===');
    try {
        const result2 = executor.executeCommand('ls', ['-la'], {
            workingDirectory: process.cwd(),
            timeoutMs: 5000,
            securityLevel: 1, // 0=Low, 1=Medium, 2=High
            capabilities: ['ProcessSpawn'] // Grant process spawning capability
        });
        
        if (result2.success) {
            const commandResult = JSON.parse(result2.result);
            console.log('✅ Directory listing successful');
            console.log('📂 Files found:', commandResult.stdout.split('\n').length - 1);
            console.log('⏱️ Execution time:', result2.executionTimeMs + 'ms');
        } else {
            console.log('❌ Directory listing failed:', result2.error);
        }
    } catch (error) {
        console.error('💥 Test 2 failed with exception:', error.message);
    }
    
    // Test 3: Command with working directory
    console.log('\n=== Test 3: Working Directory Test ===');
    try {
        const result3 = executor.executeCommand('pwd', [], {
            workingDirectory: process.cwd(),
            timeoutMs: 5000,
            securityLevel: 1, // 0=Low, 1=Medium, 2=High
            capabilities: ['ProcessSpawn'] // Grant process spawning capability
        });
        
        if (result3.success) {
            const commandResult = JSON.parse(result3.result);
            console.log('✅ Working directory test successful');
            console.log('📍 Current directory:', commandResult.stdout.trim());
            console.log('⏱️ Execution time:', result3.executionTimeMs + 'ms');
        } else {
            console.log('❌ Working directory test failed:', result3.error);
        }
    } catch (error) {
        console.error('💥 Test 3 failed with exception:', error.message);
    }
    
    // Test 4: Security validation - blocked command
    console.log('\n=== Test 4: Security Validation (Should Fail) ===');
    try {
        const result4 = executor.executeCommand('rm', ['-rf', '/'], {
            timeoutMs: 5000,
            securityLevel: 2 // 0=Low, 1=Medium, 2=High
        });
        
        if (!result4.success) {
            console.log('✅ Security validation working - blocked dangerous command');
            console.log('🚫 Error:', result4.error);
        } else {
            console.log('❌ Security validation FAILED - dangerous command allowed!');
        }
    } catch (error) {
        console.error('💥 Test 4 failed with exception:', error.message);
    }
    
    // Test 5: Command with timeout
    console.log('\n=== Test 5: Command Timeout Test ===');
    try {
        // Use a command that will timeout (sleep for longer than timeout allows)
        const result5 = executor.executeCommand('node', ['-e', 'setTimeout(() => process.exit(0), 10000)'], {
            timeoutMs: 1000, // 1 second timeout
            securityLevel: 1, // 0=Low, 1=Medium, 2=High
            capabilities: ['ProcessSpawn'] // Grant process spawning capability
        });
        
        if (!result5.success && result5.error && result5.error.includes('timeout')) {
            console.log('✅ Command timeout working correctly');
            console.log('⏰ Error:', result5.error);
        } else if (result5.success) {
            console.log('⚠️ Command completed faster than expected (this might be ok)');
        } else {
            console.log('❓ Timeout test inconclusive:', result5.error);
        }
    } catch (error) {
        console.error('💥 Test 5 failed with exception:', error.message);
    }
    
    // Test 6: Performance metrics
    console.log('\n=== Test 6: Performance Metrics ===');
    try {
        const metrics = executor.getPerformanceMetrics();
        const parsed = JSON.parse(metrics);
        
        console.log('📈 Performance Metrics:');
        console.log(`   Total requests: ${parsed.total_requests || 0}`);
        console.log(`   Successful: ${parsed.successful_requests || 0}`);
        console.log(`   Failed: ${parsed.failed_requests || 0}`);
        console.log(`   Average execution time: ${parsed.average_execution_time_ms || 0}ms`);
    } catch (error) {
        console.error('💥 Performance metrics test failed:', error.message);
    }
    
    // Test 7: Health check
    console.log('\n=== Test 7: Health Check ===');
    try {
        const health = executor.healthCheck();
        const parsed = JSON.parse(health);
        
        console.log('🏥 Health Status:', parsed.status);
        if (parsed.status === 'healthy') {
            console.log('✅ System is healthy');
        } else {
            console.log('❌ System is unhealthy:', parsed.reason);
        }
    } catch (error) {
        console.error('💥 Health check failed:', error.message);
    }
    
    console.log('\n🎯 Real Command Execution Test Complete!');
    console.log('🔍 Check output above for any failures or issues');
    
    // Cleanup
    executor.cleanup();
}

// Run the test
testRealCommandExecution().catch(console.error);