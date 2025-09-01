#!/usr/bin/env node

/**
 * Coverage Check Script
 * 
 * Validates that code coverage meets the minimum threshold.
 * Designed to fail CI when coverage is below the specified threshold.
 */

import { promises as fs } from 'fs';
import { join } from 'path';

const COVERAGE_THRESHOLD = parseInt(process.env.COVERAGE_THRESHOLD || '80');

async function checkCoverage() {
  console.log(`🔍 Checking coverage threshold: ${COVERAGE_THRESHOLD}%`);
  
  try {
    // Check if coverage report exists
    const coverageFile = join(process.cwd(), 'coverage', 'coverage-summary.json');
    
    try {
      await fs.access(coverageFile);
    } catch (error) {
      console.error('❌ Coverage report not found. Please run tests with coverage first.');
      process.exit(1);
    }
    
    const coverageData = JSON.parse(await fs.readFile(coverageFile, 'utf-8'));
    
    if (!coverageData.total) {
      console.error('❌ Invalid coverage report format');
      process.exit(1);
    }
    
    const { lines, functions, branches, statements } = coverageData.total;
    
    console.log('\n📊 Coverage Summary:');
    console.log(`  Lines:      ${lines.pct}%`);
    console.log(`  Functions:  ${functions.pct}%`);
    console.log(`  Branches:   ${branches.pct}%`);
    console.log(`  Statements: ${statements.pct}%`);
    console.log('');
    
    // Check if any metric is below threshold
    const belowThreshold = [];
    
    if (lines.pct < COVERAGE_THRESHOLD) {
      belowThreshold.push(`Lines: ${lines.pct}% (required: ${COVERAGE_THRESHOLD}%)`);
    }
    
    if (statements.pct < COVERAGE_THRESHOLD) {
      belowThreshold.push(`Statements: ${statements.pct}% (required: ${COVERAGE_THRESHOLD}%)`);
    }
    
    if (belowThreshold.length > 0) {
      console.error('❌ Coverage below threshold:');
      belowThreshold.forEach(metric => console.error(`  - ${metric}`));
      console.error('');
      console.error('Please improve test coverage before merging.');
      process.exit(1);
    }
    
    console.log('✅ Coverage check passed!');
    console.log(`All metrics meet or exceed ${COVERAGE_THRESHOLD}% threshold.`);
    
  } catch (error) {
    console.error('❌ Coverage check failed:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (process.argv[1] === new URL(import.meta.url).pathname) {
  checkCoverage().catch(console.error);
}

export default checkCoverage;