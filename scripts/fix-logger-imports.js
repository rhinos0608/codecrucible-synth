#!/usr/bin/env node
/**
 * Focused Logger Import Automation Script
 * Living Spiral Methodology - Automate mechanical, preserve architectural
 *
 * SAFETY: Only handles proven Logger patterns from manual testing
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// HIGH-CONFIDENCE patterns only (proven in manual testing)
const loggerPatterns = [
  {
    find: /import\s*{\s*Logger\s*}\s*from\s*(['"][^'"]*logger\.js['"])\s*;?/g,
    replace: 'import { logger } from $1;',
    description: 'Logger import → logger import',
  },
  {
    find: /private\s+logger:\s*Logger\s*;/g,
    replace: 'private logger: typeof logger;',
    description: 'Logger type → typeof logger',
  },
  {
    find: /this\.logger\s*=\s*new\s*Logger\([^)]*\)\s*;?/g,
    replace: 'this.logger = logger;',
    description: 'new Logger(...) → logger',
  },
];

let totalChanges = 0;
let filesProcessed = 0;
let errorsFixed = 0;

function fixLoggerInFile(filePath) {
  console.log(`\n📁 Processing: ${filePath}`);

  if (!fs.existsSync(filePath)) {
    console.log(`  ⚠️  File not found: ${filePath}`);
    return false;
  }

  const content = fs.readFileSync(filePath, 'utf8');
  let modified = content;
  let changeCount = 0;

  loggerPatterns.forEach(pattern => {
    const before = modified;
    modified = modified.replace(pattern.find, pattern.replace);

    const matches = (before.match(pattern.find) || []).length;
    if (matches > 0) {
      changeCount += matches;
      console.log(`    ✓ ${pattern.description}: ${matches} fixes`);
    }
  });

  if (changeCount > 0) {
    fs.writeFileSync(filePath, modified);
    console.log(`  📝 Applied ${changeCount} Logger fixes`);
    totalChanges += changeCount;
    filesProcessed++;
    return true;
  } else {
    console.log(`  ➡️  No Logger patterns found`);
    return false;
  }
}

function runTypecheck() {
  console.log('🔍 Running TypeScript validation...');
  try {
    const result = execSync('npm run build', {
      cwd: process.cwd(),
      encoding: 'utf8',
      stdio: 'pipe',
    });

    console.log('✅ TypeScript compilation completed (clean build)');
    return { success: true, output: result, errorCount: 0 };
  } catch (error) {
    const output = error.stdout || error.stderr || error.message;

    // Extract error count from TypeScript output
    let errorCount = 0;

    // Count individual error lines
    const errorLines = output
      .split('\n')
      .filter(line => line.match(/src\/.*\.ts\(\d+,\d+\): error TS\d+:/));
    errorCount = errorLines.length;

    // Also check for summary line like "Found 197 errors"
    const summaryMatch = output.match(/Found (\d+) errors?/);
    if (summaryMatch) {
      errorCount = Math.max(errorCount, parseInt(summaryMatch[1]));
    }

    console.log(`📊 TypeScript errors found: ${errorCount}`);
    return {
      success: false,
      output: output,
      errorCount: errorCount,
    };
  }
}

async function main() {
  console.log('🚀 Logger Import Automation Script - Living Spiral Approach');
  console.log('🎯 Target: Proven Logger patterns only (Zero business logic risk)');

  // Get baseline error count
  console.log('\n📊 BASELINE: Getting initial error count...');
  const baseline = runTypecheck();
  const baselineErrors = baseline.errorCount;
  console.log(`📈 Baseline: ${baselineErrors} TypeScript errors`);

  // First discover all files with Logger imports (use known list)
  console.log('\n🔍 DISCOVERY: Using known files with Logger imports...');
  const allLoggerFiles = [
    'src/application/interfaces/unified-cli.ts',
    'src/application/services/unified-orchestration-service.ts',
    'src/config/config-manager.ts',
    'src/core/cli/config-commands.ts',
    'src/core/model-management/intelligent-model-detector.ts',
    'src/core/model-selection-coordinator.ts',
    'src/core/observability/observability-system.ts',
    'src/core/rag/vector-rag-system.ts',
    'src/core/resilience/error-recovery-system.ts',
    'src/core/resilience/resilient-cli-wrapper.ts',
    'src/core/routing/intelligent-model-router.ts',
    'src/core/search/advanced-search-cache.ts',
    'src/core/search/cli-integration.ts',
    'src/core/search/hybrid-search-coordinator.ts',
    'src/core/search/search-cli-commands.ts',
    'src/core/unified-response-coordinator.ts',
    'src/domain/services/configuration-migrator.ts',
    'src/domain/services/living-spiral-coordinator.ts',
    'src/domain/config/config-manager.ts',
    'src/domain/services/unified-performance-system.ts',
    'src/domain/services/unified-security-validator.ts',
    'src/domain/services/unified-server-system.ts',
    'src/domain/tools/unified-tool-system.ts',
    'src/infrastructure/logging/logger-adapter.ts',
    'src/infrastructure/performance/active-process-manager.ts',
    'src/infrastructure/performance/hardware-aware-model-selector.ts',
    'src/infrastructure/production/setup-production-hardening.ts',
    'src/infrastructure/tools/tool-orchestrator.ts',
    'src/infrastructure/tools/workflow-engine.ts',
    'src/infrastructure/tools/dependency-resolver.ts',
    'src/infrastructure/tools/execution-scheduler.ts',
    'src/infrastructure/tools/result-aggregator.ts',
    'src/server/server-mode.ts',
    'src/voices/voice-archetype-system.ts',
  ];
  console.log(`📋 Processing ${allLoggerFiles.length} files with Logger imports`);

  if (allLoggerFiles.length === 0) {
    console.log('\n🎉 No Logger import files found - all patterns already fixed!');
    return;
  }

  // Test files (conservative approach - use first 3 files)
  const testFiles = allLoggerFiles.slice(0, 3);

  console.log('\n🧪 PHASE 1: Testing on subset first (Living Spiral: Conservative Validation)');
  let testChanges = 0;

  testFiles.forEach(filePath => {
    if (fixLoggerInFile(filePath)) {
      testChanges++;
    }
  });

  if (testChanges === 0) {
    console.log('\n⚠️  No Logger patterns found in test files - script may not be needed');
    return;
  }

  // Validate test changes
  console.log('\n🔍 VALIDATION: Measuring impact of test changes...');
  const testResult = runTypecheck();
  const testErrors = testResult.errorCount;
  const errorReduction = baselineErrors - testErrors;

  console.log(`📊 Before: ${baselineErrors} errors → After: ${testErrors} errors`);

  if (errorReduction > 0) {
    console.log(`✅ SUCCESS: Reduced ${errorReduction} errors with ${totalChanges} Logger fixes!`);
  } else if (errorReduction === 0) {
    console.log(`⚠️  NEUTRAL: No error reduction, but no regressions either`);
  } else {
    console.log(
      `❌ REGRESSION: Errors increased by ${Math.abs(errorReduction)} - reverting needed`
    );
    console.log('Output:', testResult.output.substring(0, 1000));
    return;
  }

  if (testChanges === 0) {
    console.log(
      '\n⚠️  No Logger patterns found in remaining test files - continuing with discovery'
    );
  }

  // Use remaining files (all discovered files minus test files)
  const remainingFiles = allLoggerFiles.slice(3); // Skip the first 3 used for testing
  console.log(`📋 ${remainingFiles.length} additional files to process after testing`);

  if (remainingFiles.length === 0) {
    console.log('\n🎉 All Logger imports already fixed!');
    console.log(`📊 SUMMARY: ${totalChanges} changes applied to ${filesProcessed} files`);
    return;
  }

  // Process remaining files
  console.log(`\n🔄 PHASE 2: Processing ${remainingFiles.length} remaining files...`);

  remainingFiles.forEach(filePath => {
    fixLoggerInFile(filePath);
  });

  // Final validation
  console.log('\n🔍 FINAL VALIDATION: Complete typecheck...');
  const finalResult = runTypecheck();
  const finalErrors = finalResult.errorCount;
  const totalErrorReduction = baselineErrors - finalErrors;

  console.log('\n🎯 AUTOMATION RESULTS:');
  console.log(`📝 Files processed: ${filesProcessed}`);
  console.log(`🔧 Total Logger fixes applied: ${totalChanges}`);
  console.log(
    `📊 Error reduction: ${baselineErrors} → ${finalErrors} (${totalErrorReduction >= 0 ? '-' : '+'}${Math.abs(totalErrorReduction)})`
  );

  if (totalErrorReduction > 0) {
    console.log(`\n🎉 SUCCESS: Eliminated ${totalErrorReduction} TypeScript errors!`);
    console.log('📈 Progress: Logger automation completed successfully');
    console.log('👨‍💻 Ready for manual iteration on remaining complex errors');
  } else if (totalErrorReduction === 0) {
    console.log('\n⚠️  NEUTRAL: No net error reduction, but Logger patterns normalized');
    console.log('👨‍💻 Proceeding to manual iteration on complex errors');
  } else {
    console.log(`\n❌ REGRESSION: Errors increased by ${Math.abs(totalErrorReduction)}`);
    console.log('🔍 Recommend git restore and manual review');
    console.log('📝 Output preview:', finalResult.output.substring(0, 800));
  }

  console.log(
    '\n💡 Next: Manual iteration using Living Spiral methodology on architectural issues'
  );
}

// Execute if run directly
if (import.meta.url.startsWith('file:') && import.meta.url.includes('fix-logger-imports.js')) {
  main().catch(console.error);
}

export { fixLoggerInFile, loggerPatterns };
