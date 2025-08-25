#!/usr/bin/env node

// Simple test to trace evidence collection issue
// Run a basic tool execution and log exactly what happens

console.log('🔍 Starting evidence collection debugging...');
console.log('⏰ Time:', new Date().toISOString());

import('./dist/index.js').then(() => {
  console.log('✅ Import successful');
}).catch(error => {
  console.error('❌ Import failed:', error);
});