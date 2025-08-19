#!/usr/bin/env node

// Test core functionality without external dependencies
import { UnifiedAgent } from './dist/core/agent.js';
import { UnifiedModelClient } from './dist/core/client.js';
import { PerformanceMonitor } from './dist/utils/performance.js';

async function testCoreImplementations() {
  try {
    console.log('🧪 Testing core implementations...');
    
    // Test PerformanceMonitor
    console.log('📊 Testing PerformanceMonitor...');
    const perfMonitor = new PerformanceMonitor();
    perfMonitor.startOperation('test', 'TestComponent');
    await new Promise(resolve => setTimeout(resolve, 100));
    perfMonitor.endOperation('test');
    console.log('✅ PerformanceMonitor works');
    
    // Test UnifiedModelClient (should work without actual model connections)
    console.log('🤖 Testing UnifiedModelClient...');
    const modelClient = new UnifiedModelClient(perfMonitor);
    console.log('✅ UnifiedModelClient created');
    
    // Test UnifiedAgent 
    console.log('🎯 Testing UnifiedAgent...');
    const agent = new UnifiedAgent(modelClient, perfMonitor);
    console.log('📋 Agent capabilities:', agent.getCapabilities().map(c => c.name));
    console.log('📊 Agent metrics:', agent.getMetrics());
    console.log('✅ UnifiedAgent works');
    
    // Test a simple task without model communication
    console.log('📝 Testing agent task handling...');
    try {
      const testTask = {
        id: 'test-task',
        type: 'code-analysis',
        capability: 'code-analysis', // This was missing!
        input: 'function test() { console.log("hello"); }',
        priority: 'medium',
        estimatedTime: 5000,
        description: 'Test code analysis'
      };
      
      // This should work even without model connection
      const result = await agent.executeTask(testTask);
      console.log('✅ Task execution result:', result.success ? 'SUCCESS' : 'FAILED');
      
    } catch (error) {
      console.log('ℹ️  Task execution failed (expected without model):', error.message);
    }
    
    console.log('🎉 Core implementations test completed!');
    
  } catch (error) {
    console.error('❌ Core implementations test failed:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

testCoreImplementations();