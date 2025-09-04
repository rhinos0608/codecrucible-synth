#!/usr/bin/env node

/**
 * Comprehensive Test Runner
 *
 * Orchestrates execution of the comprehensive AI workflow test suite
 * with proper reporting and analysis.
 *
 * PERMANENT SCRIPT - DO NOT DELETE
 */

import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import { join } from 'path';
import dotenv from 'dotenv';

// Load environment configuration
dotenv.config();

console.log('🧪 CodeCrucible Synth - Comprehensive Test Suite Runner');
console.log('═'.repeat(70));

class ComprehensiveTestRunner {
  constructor() {
    this.results = {
      timestamp: new Date().toISOString(),
      environment: this.getEnvironmentInfo(),
      tests: [],
      summary: null,
    };
  }

  getEnvironmentInfo() {
    return {
      nodeVersion: process.version,
      platform: process.platform,
      architecture: process.arch,
      memory: Math.round(process.memoryUsage().heapTotal / 1024 / 1024) + 'MB',
      hasOllama: !!process.env.OLLAMA_ENDPOINT,
      hasSmithery: !!process.env.SMITHERY_API_KEY,
      hasE2B: !!process.env.E2B_API_KEY,
      pwd: process.cwd(),
    };
  }

  async runTest(testFile, description) {
    console.log(`\n🚀 Running: ${description}`);
    console.log('-'.repeat(50));

    const startTime = Date.now();

    return new Promise((resolve, reject) => {
      const testProcess = spawn('npx', ['jest', testFile, '--verbose'], {
        stdio: 'pipe',
        shell: true,
        cwd: process.cwd(),
      });

      let stdout = '';
      let stderr = '';

      testProcess.stdout.on('data', data => {
        const output = data.toString();
        stdout += output;
        process.stdout.write(output);
      });

      testProcess.stderr.on('data', data => {
        const output = data.toString();
        stderr += output;
        process.stderr.write(output);
      });

      testProcess.on('close', code => {
        const duration = Date.now() - startTime;

        const result = {
          testFile,
          description,
          exitCode: code,
          duration,
          success: code === 0,
          stdout: stdout.substring(0, 5000), // Truncate for storage
          stderr: stderr.substring(0, 2000),
        };

        this.results.tests.push(result);

        if (code === 0) {
          console.log(`✅ ${description} completed successfully (${duration}ms)`);
          resolve(result);
        } else {
          console.log(`❌ ${description} failed with exit code ${code} (${duration}ms)`);
          resolve(result); // Don't reject, continue with other tests
        }
      });

      testProcess.on('error', error => {
        console.error(`❌ Failed to start test: ${error.message}`);

        const result = {
          testFile,
          description,
          exitCode: -1,
          duration: Date.now() - startTime,
          success: false,
          error: error.message,
        };

        this.results.tests.push(result);
        resolve(result);
      });
    });
  }

  async checkPrerequisites() {
    console.log('\n🔍 Checking prerequisites...');

    const checks = [
      {
        name: 'Node.js version',
        check: () => process.version,
        expected: 'v18.x or higher',
      },
      {
        name: 'Built application',
        check: async () => {
          try {
            await fs.access('./dist/index.js');
            return 'Found';
          } catch {
            return 'Missing';
          }
        },
        expected: 'Found',
      },
      {
        name: 'Environment variables',
        check: () => {
          const vars = ['SMITHERY_API_KEY', 'OLLAMA_ENDPOINT'];
          const found = vars.filter(v => process.env[v]);
          return `${found.length}/${vars.length} configured`;
        },
        expected: 'At least 1/2 configured',
      },
    ];

    for (const check of checks) {
      try {
        const result = typeof check.check === 'function' ? await check.check() : check.check;
        console.log(`  ✅ ${check.name}: ${result}`);
      } catch (error) {
        console.log(`  ❌ ${check.name}: ${error.message}`);
      }
    }
  }

  async ensureTestDirectories() {
    const dirs = ['tests', 'tests/integration'];

    for (const dir of dirs) {
      try {
        await fs.mkdir(dir, { recursive: true });
      } catch (error) {
        console.warn(`Warning: Could not create directory ${dir}:`, error.message);
      }
    }
  }

  generateSummaryReport() {
    const successful = this.results.tests.filter(t => t.success);
    const failed = this.results.tests.filter(t => !t.success);
    const totalDuration = this.results.tests.reduce((sum, t) => sum + t.duration, 0);

    this.results.summary = {
      total: this.results.tests.length,
      successful: successful.length,
      failed: failed.length,
      successRate:
        this.results.tests.length > 0 ? (successful.length / this.results.tests.length) * 100 : 0,
      totalDuration,
      averageDuration:
        this.results.tests.length > 0 ? totalDuration / this.results.tests.length : 0,
    };

    return this.results.summary;
  }

  async saveResults() {
    const resultsFile = `comprehensive-test-results-${Date.now()}.json`;

    try {
      await fs.writeFile(resultsFile, JSON.stringify(this.results, null, 2));
      console.log(`\n💾 Detailed results saved to: ${resultsFile}`);
    } catch (error) {
      console.warn(`Warning: Could not save results: ${error.message}`);
    }
  }

  printFinalReport() {
    const summary = this.results.summary;

    console.log('\n📊 COMPREHENSIVE TEST RESULTS');
    console.log('═'.repeat(70));
    console.log(`📅 Timestamp: ${this.results.timestamp}`);
    console.log(
      `🖥️  Environment: ${this.results.environment.platform} ${this.results.environment.architecture}`
    );
    console.log(`📦 Node.js: ${this.results.environment.nodeVersion}`);
    console.log(`💾 Memory: ${this.results.environment.memory}`);
    console.log('');
    console.log(`✅ Successful: ${summary.successful}/${summary.total}`);
    console.log(`❌ Failed: ${summary.failed}/${summary.total}`);
    console.log(`📈 Success Rate: ${summary.successRate.toFixed(1)}%`);
    console.log(`⏱️  Total Duration: ${Math.round(summary.totalDuration / 1000)}s`);
    console.log(`📊 Average Test Duration: ${Math.round(summary.averageDuration / 1000)}s`);

    if (summary.successRate >= 80) {
      console.log('\n🎉 EXCELLENT: System is production-ready!');
    } else if (summary.successRate >= 60) {
      console.log('\n⚠️ GOOD: System mostly functional, some issues need attention');
    } else {
      console.log('\n❌ NEEDS WORK: Significant issues detected, not production-ready');
    }

    // Detailed test breakdown
    console.log('\n📋 Test Breakdown:');
    this.results.tests.forEach(test => {
      const status = test.success ? '✅' : '❌';
      const duration = Math.round(test.duration / 1000);
      console.log(`  ${status} ${test.description} (${duration}s)`);

      if (!test.success && test.stderr) {
        const errorLines = test.stderr
          .split('\n')
          .filter(line => line.trim())
          .slice(0, 3); // Show first 3 error lines
        errorLines.forEach(line => {
          console.log(`      📄 ${line.trim()}`);
        });
      }
    });

    console.log('\n🔍 For detailed logs, check the generated JSON results file.');
  }

  async run() {
    const startTime = Date.now();

    try {
      await this.checkPrerequisites();
      await this.ensureTestDirectories();

      // Define test suite
      const testSuite = [
        {
          file: 'tests/integration/comprehensive-ai-workflow.test.js',
          description: 'Comprehensive AI Workflow Integration Tests',
        },
        {
          file: 'tests/integration/production-readiness.test.js',
          description: 'Production Readiness Validation Tests',
        },
      ];

      console.log(`\n🎯 Running ${testSuite.length} test suites...`);

      // Run all tests
      for (const test of testSuite) {
        await this.runTest(test.file, test.description);

        // Brief pause between test suites
        await new Promise(resolve => setTimeout(resolve, 2000));
      }

      // Generate and display results
      this.generateSummaryReport();
      await this.saveResults();
      this.printFinalReport();

      const totalTime = Date.now() - startTime;
      console.log(`\n🏁 Comprehensive testing completed in ${Math.round(totalTime / 1000)}s`);

      // Exit with appropriate code
      const success = this.results.summary.successRate >= 80;
      process.exit(success ? 0 : 1);
    } catch (error) {
      console.error('❌ Comprehensive test runner failed:', error);
      console.error(error.stack);
      process.exit(1);
    }
  }
}

// Main execution
if (import.meta.url === `file://${process.argv[1]}`) {
  const runner = new ComprehensiveTestRunner();
  runner.run().catch(console.error);
}

export default ComprehensiveTestRunner;
