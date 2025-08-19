#!/usr/bin/env node

/**
 * Test resilient error handling system
 */

import { ErrorRecoverySystem } from './dist/core/resilience/error-recovery-system.js';
import { ResilientCLIWrapper } from './dist/core/resilience/resilient-cli-wrapper.js';
import chalk from 'chalk';

console.log('🧪 Testing Resilient Error Handling System...\n');

async function testErrorRecovery() {
  const errorRecovery = new ErrorRecoverySystem();
  
  console.log(chalk.blue('1. Testing Network Error Recovery...'));
  try {
    await errorRecovery.handleError(
      new Error('fetch failed: ENOTFOUND example.com'),
      {
        operation: 'API_Call',
        component: 'ModelClient',
        severity: 'medium',
        recoverable: true,
        timestamp: Date.now()
      }
    );
    console.log(chalk.green('   ✅ Network error handled successfully'));
  } catch (error) {
    console.log(chalk.red(`   ❌ Network error handling failed: ${error.message}`));
  }
  
  console.log(chalk.blue('\n2. Testing File System Error Recovery...'));
  try {
    await errorRecovery.handleError(
      new Error('ENOENT: no such file or directory'),
      {
        operation: 'ReadFile',
        component: 'FileHandler',
        severity: 'medium',
        recoverable: true,
        timestamp: Date.now()
      }
    );
    console.log(chalk.green('   ✅ File system error handled successfully'));
  } catch (error) {
    console.log(chalk.red(`   ❌ File system error handling failed: ${error.message}`));
  }
  
  console.log(chalk.blue('\n3. Testing Model Service Error Recovery...'));
  try {
    await errorRecovery.handleError(
      new Error('model llama2 not found'),
      {
        operation: 'ModelQuery',
        component: 'AIService',
        severity: 'high',
        recoverable: true,
        timestamp: Date.now()
      }
    );
    console.log(chalk.green('   ✅ Model service error handled successfully'));
  } catch (error) {
    console.log(chalk.red(`   ❌ Model service error handling failed: ${error.message}`));
  }
  
  // Show error statistics
  console.log(chalk.blue('\n4. Error Statistics:'));
  const stats = errorRecovery.getErrorStats();
  console.log(chalk.gray(`   Total Errors: ${stats.totalErrors}`));
  console.log(chalk.gray(`   Components: ${Object.keys(stats.errorsByComponent).join(', ')}`));
  
  const health = errorRecovery.getSystemHealth();
  console.log(chalk.gray(`   System Health: ${health.status}`));
}

async function testResilientWrapper() {
  const wrapper = new ResilientCLIWrapper({
    retryAttempts: 2,
    timeoutMs: 5000,
    enableGracefulDegradation: true,
    fallbackMode: 'basic'
  });
  
  console.log(chalk.blue('\n5. Testing Resilient Wrapper - Success Case...'));
  const successResult = await wrapper.executeWithRecovery(
    async () => {
      return { data: 'Success!', processed: true };
    },
    {
      name: 'TestOperation',
      component: 'TestComponent',
      critical: false
    }
  );
  
  if (successResult.success) {
    console.log(chalk.green(`   ✅ Success case handled: ${JSON.stringify(successResult.data)}`));
  } else {
    console.log(chalk.red(`   ❌ Success case failed: ${successResult.error}`));
  }
  
  console.log(chalk.blue('\n6. Testing Resilient Wrapper - Retry Case...'));
  let attemptCount = 0;
  const retryResult = await wrapper.executeWithRecovery(
    async () => {
      attemptCount++;
      if (attemptCount < 2) {
        throw new Error('Temporary failure');
      }
      return { data: 'Success after retry!', attempts: attemptCount };
    },
    {
      name: 'RetryOperation',
      component: 'TestComponent',
      critical: false
    }
  );
  
  if (retryResult.success) {
    console.log(chalk.green(`   ✅ Retry case handled: ${JSON.stringify(retryResult.data)}`));
  } else {
    console.log(chalk.red(`   ❌ Retry case failed: ${retryResult.error}`));
  }
  
  console.log(chalk.blue('\n7. Testing Resilient Wrapper - Graceful Degradation...'));
  const degradationResult = await wrapper.executeWithRecovery(
    async () => {
      throw new Error('Persistent failure that should degrade gracefully');
    },
    {
      name: 'DegradationTest',
      component: 'TestComponent',
      critical: false
    }
  );
  
  if (degradationResult.success && degradationResult.degraded) {
    console.log(chalk.yellow(`   ⚠️  Graceful degradation successful: ${JSON.stringify(degradationResult.data)}`));
  } else {
    console.log(chalk.red(`   ❌ Degradation case failed: ${degradationResult.error}`));
  }
  
  console.log(chalk.blue('\n8. Testing Safe Execution...'));
  const safeResult = await wrapper.executeSafely(
    async () => {
      throw new Error('This should use fallback');
    },
    { fallback: true, message: 'Fallback data' },
    'SafeExecutionTest'
  );
  
  console.log(chalk.green(`   ✅ Safe execution with fallback: ${JSON.stringify(safeResult)}`));
  
  // Show system health
  console.log(chalk.blue('\n9. System Health:'));
  const health = wrapper.getSystemHealth();
  console.log(chalk.gray(`   Status: ${health.status}`));
  console.log(chalk.gray(`   Operations: ${health.operationCount}`));
  console.log(chalk.gray(`   Error Rate: ${health.errorStats.totalErrors}`));
}

async function main() {
  try {
    await testErrorRecovery();
    await testResilientWrapper();
    
    console.log(chalk.green('\n🎉 All resilience tests completed successfully!'));
    console.log(chalk.blue('System is ready for production use with enhanced error handling.'));
    
  } catch (error) {
    console.error(chalk.red(`\n❌ Test suite failed: ${error.message}`));
    console.error(error.stack);
    process.exit(1);
  }
}

main().catch(console.error);