#!/usr/bin/env node

/**
 * Script to run the comprehensive file operations test and display the full report
 */

import { spawn } from 'child_process';
import chalk from 'chalk';

console.log(chalk.blue.bold('🚀 Running Comprehensive File Operations Test'));
console.log(
  chalk.gray("This test will thoroughly exercise the system's file handling capabilities...\n")
);

const testProcess = spawn('npm', ['test', 'tests/system/file-operations.test.ts'], {
  stdio: 'inherit',
  cwd: process.cwd(),
  env: { ...process.env, NODE_ENV: 'test' },
});

testProcess.on('close', code => {
  if (code === 0) {
    console.log(chalk.green.bold('\n✅ File Operations Test Suite Completed Successfully!'));
    console.log(
      chalk.gray('Check the detailed report above for comprehensive analysis and recommendations.')
    );
  } else {
    console.log(chalk.red.bold(`\n❌ Test suite exited with code ${code}`));
    console.log(chalk.gray('Some tests may have failed. Review the output above for details.'));
  }
  process.exit(code);
});

testProcess.on('error', error => {
  console.error(chalk.red.bold('❌ Failed to run test:'), error);
  process.exit(1);
});
