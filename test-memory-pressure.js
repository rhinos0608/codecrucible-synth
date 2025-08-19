#!/usr/bin/env node

/**
 * Test Memory Pressure Management
 * Demonstrates automatic process termination and model switching under memory constraints
 */

import { UnifiedModelClient } from './dist/core/client.js';

async function testMemoryPressure() {
  console.log('🧪 Testing Memory Pressure Management...\n');

  // Create client with lower memory thresholds for testing
  const client = new UnifiedModelClient({
    providers: [
      { type: 'ollama', endpoint: 'http://localhost:11434' }
    ],
    executionMode: 'auto',
    fallbackChain: ['ollama'],
    security: { enableSandbox: false },
    performanceThresholds: {
      maxConcurrentRequests: 5,
      requestTimeout: 30000,
      memoryLimit: 512 // Lower limit for testing
    }
  });

  try {
    await client.initialize();
    console.log('✅ Client initialized\n');

    // Listen for memory warnings and model switches
    client.on('memoryWarning', (event) => {
      console.log(`⚠️  Memory Warning: ${(event.usage * 100).toFixed(1)}% usage with ${event.activeProcesses} active processes`);
    });

    client.on('modelSwitched', (event) => {
      console.log(`🔄 Model Switched: ${event.fromModel} → ${event.toModel} (${event.reason})`);
    });

    client.on('processTerminated', (event) => {
      console.log(`❌ Process Terminated: ${event.processId} due to ${event.reason}`);
    });

    // Simulate multiple concurrent requests that might stress memory
    console.log('🚀 Starting multiple concurrent requests...\n');

    const requests = [
      { prompt: 'Analyze this large codebase and provide detailed recommendations...' + 'x'.repeat(1000) },
      { prompt: 'Generate a comprehensive API documentation...' + 'y'.repeat(1000) },
      { prompt: 'Review this code for security vulnerabilities...' + 'z'.repeat(1000) },
      { prompt: 'Create a complex data structure...' + 'a'.repeat(1000) },
      { prompt: 'Analyze performance bottlenecks...' + 'b'.repeat(1000) }
    ];

    // Start all requests concurrently
    const promises = requests.map((request, index) => {
      return client.processRequest(request).catch(error => {
        console.log(`Request ${index + 1} failed: ${error.message}`);
        return null;
      });
    });

    // Simulate memory pressure by updating thresholds
    setTimeout(() => {
      console.log('\n🔥 Simulating Memory Pressure...');
      if (client.processManager) {
        client.processManager.updateThresholds({
          memoryWarning: 0.05,     // 5% - very low for testing
          memoryCritical: 0.10,    // 10%
          memoryEmergency: 0.15    // 15%
        });
      }
    }, 2000);

    // Wait for all requests
    const results = await Promise.allSettled(promises);
    
    console.log('\n📊 Results:');
    results.forEach((result, index) => {
      if (result.status === 'fulfilled' && result.value) {
        console.log(`✅ Request ${index + 1}: Completed`);
      } else {
        console.log(`❌ Request ${index + 1}: ${result.status === 'rejected' ? result.reason : 'Failed'}`);
      }
    });

    // Check final system state
    console.log('\n📈 Final System State:');
    const resourceUsage = client.processManager?.getCurrentResourceUsage();
    if (resourceUsage) {
      console.log(`Memory: ${(resourceUsage.memory * 100).toFixed(1)}%`);
      console.log(`CPU: ${(resourceUsage.cpu * 100).toFixed(1)}%`);
      console.log(`Active Processes: ${resourceUsage.processes}`);
    }

    const processStats = client.processManager?.getProcessStats();
    if (processStats) {
      console.log(`Process Stats:`, processStats);
    }

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    console.log('\n🛑 Shutting down...');
    await client.shutdown();
    console.log('✅ Test completed');
  }
}

// Run the test
testMemoryPressure().catch(console.error);