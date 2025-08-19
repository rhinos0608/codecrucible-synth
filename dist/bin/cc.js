#!/usr/bin/env node

// Import the main application
import('../dist/index.js').catch(error => {
  console.error('Failed to start CodeCrucible Synth:', error);
  process.exit(1);
});