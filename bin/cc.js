#!/usr/bin/env node

// Import and explicitly call the main function
import('../dist/index.js')
  .then(module => {
    // Explicitly call main() to ensure proper initialization
    if (module.main) {
      return module.main();
    }
  })
  .catch(error => {
    console.error('Failed to start CodeCrucible Synth:', error);
    process.exit(1);
  });
