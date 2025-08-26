/**
 * Comprehensive Test Setup
 * Prepares environment for robust AI workflow testing
 */

import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Set up test environment
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'error'; // Reduce logging noise during tests

// Global test configuration
global.testConfig = {
  ai: {
    timeout: 120000,
    maxTokens: 500,
    retries: 3
  },
  performance: {
    maxMemoryGrowth: 200 * 1024 * 1024, // 200MB
    maxResponseTime: 60000, // 60 seconds
    concurrentRequests: 5
  },
  environment: {
    hasOllama: !!process.env.OLLAMA_ENDPOINT,
    hasSmithery: !!process.env.SMITHERY_API_KEY,
    hasE2B: !!process.env.E2B_API_KEY
  }
};

// Global setup
beforeAll(async () => {
  console.log('🔧 Setting up comprehensive test environment...');
  
  // Verify build exists
  try {
    await import('../../dist/index.js');
    console.log('✅ Built application found');
  } catch (error) {
    console.error('❌ Built application not found. Run "npm run build" first.');
    throw error;
  }
  
  // Verify AI models available
  if (!global.testConfig.environment.hasOllama && !global.testConfig.environment.hasSmithery) {
    console.warn('⚠️ No AI providers configured. Some tests may be skipped.');
  }
});

// Global cleanup
afterAll(() => {
  console.log('🧹 Cleaning up test environment...');
  
  // Force garbage collection if available
  if (global.gc) {
    global.gc();
  }
});