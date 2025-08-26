/**
 * Test Sequencer for Comprehensive AI Tests
 * Ensures tests run in optimal order for AI model stability
 */

class ComprehensiveTestSequencer {
  sort(tests) {
    // Sort tests to run in order of complexity/resource usage
    const testOrder = [
      'comprehensive-ai-workflow.test.js',
      'production-readiness.test.js'
    ];
    
    return tests.sort((testA, testB) => {
      const indexA = testOrder.findIndex(name => testA.path.includes(name));
      const indexB = testOrder.findIndex(name => testB.path.includes(name));
      
      // If both tests are in our ordering, sort by index
      if (indexA !== -1 && indexB !== -1) {
        return indexA - indexB;
      }
      
      // If only one is in ordering, prioritize it
      if (indexA !== -1) return -1;
      if (indexB !== -1) return 1;
      
      // Otherwise, maintain original order
      return 0;
    });
  }
}

module.exports = ComprehensiveTestSequencer;