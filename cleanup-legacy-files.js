#!/usr/bin/env node

/**
 * Test Files and Legacy Documentation Cleanup
 * Remove redundant test files and outdated documentation
 */

import fs from 'fs/promises';
import path from 'path';

// Legacy test files to remove (keep essential tests)
const LEGACY_TEST_FILES = [
  // Root-level test files (should be in tests/ directory)
  'test-actual-models.cjs',
  'test-advanced-optimizations.js',
  'test-agent-comprehensive.js',
  'test-agent-fixes.js',
  'test-agent-focused.js',
  'test-agent-prompts.js',
  'test-agent-quick.cjs',
  'test-agent-simple.js',
  'test-agent-simple.txt',
  'test-agent-workflow.js',
  'test-agentic.js',
  'test-agents.js',
  'test-all-commands-timeout-optimization.cjs',
  'test-autonomous-model-selection.cjs',
  'test-complex-scenarios.cjs',
  'test-comprehensive-prompts.js',
  'test-doc-guided-improvements.js',
  'test-dynamic-models.js',
  'test-e2b-integration.js',
  'test-e2b-tool.js',
  'test-electron-import.ts',
  'test-final-integration-validation.cjs',
  'test-final-timeout-validation.cjs',
  'test-final-validation.js',
  'test-focused-improvements.js',
  'test-git-manager.js',
  'test-huggingface.cjs',
  'test-hybrid-final.js',
  'test-hybrid-fixed.js',
  'test-hybrid-integration.js',
  'test-hybrid-quick.js',
  'test-hybrid-simple.js',
  'test-improved-fallback.js',
  'test-improved-system.js',
  'test-integration-system.js',
  'test-lightweight-mode.js',
  'test-lightweight-mode.mjs',
  'test-lm-studio-direct.js',
  'test-model-validation.js',
  'test-performance-optimizations.js',
  'test-sequential-models.js',
  'test-simple-integration.js',
  'test-simple-responses.cjs',
  'test-simple-responses.js',
  'test-simple.js',
  'test-simple.txt',
  'test-smithery-integration.ts',
  'test-timeout-fixes.js',
  'test-timeout-optimizations.js',
  'test-voice-agent.js',
  'test-voices-improved.js',
  'test-voices.js',
  'test_complete_stripe_flow.js',
  'test_stripe_webhook.js',
  'webhook_test.js',
  
  // Validation/debug scripts
  'validate-optimizations.js',
  'vram-check.cjs',
  'diagnose-timeout-issues.js',
  'debug-agent.js',
  'debug-lm-studio.js',
  'debug-voice-system.js',
  
  // Fix scripts (post-consolidation these are obsolete)
  'apply-agent-fixes.js',
  'fix-agent-loops-safe.cjs',
  'fix-agent-loops-safe.js',
  'fix-agent-loops.js',
  'fix-all-react-imports.cjs',
  'fix-gpu-optimization.js',
  'fix-model-detection.cjs',
  'fix-react-imports-comprehensive.js',
  'fix-react-imports.cjs',
  'fix-react-imports.js',
  'fix-timeout-issues.js',
  
  // Analysis scripts (we've completed the analysis)
  'analyze-architecture.cjs',
  'analyze-architecture.js',
  'consolidate-architecture.js',
  'consolidate-architecture.ts',
  'post-consolidation-analysis.cjs',
  'execute-consolidation.js',
  'phase2-consolidation.js',
  'phase3-final-consolidation.js',
  'CONSOLIDATION_SUCCESS_REPORT.js',
  'CONSOLIDATION_SUMMARY.js'
];

// Legacy documentation files to remove
const LEGACY_DOCS = [
  // Outdated audit reports
  'ADVANCED_OPTIMIZATION_SUMMARY.md',
  'AGENT_ANALYSIS_REPORT.md',
  'AGENT_AUDIT_REPORT.md',
  'AUDIT_ITERATION_SUMMARY.md',
  'AUTONOMOUS_MODEL_SELECTION_COMPLETE.md',
  'CODECRUCIBLE_AUDIT_REPORT.md',
  'COMPREHENSIVE_AGENT_EVALUATION.md',
  'COMPREHENSIVE_AUDIT_REPORT.md',
  'DEEP_AUDIT_REPORT.md',
  'DOCUMENTATION_COMPLIANCE_REPORT.md',
  'ENHANCED_MODEL_MANAGEMENT.md',
  'ENHANCEMENTS.md',
  'FIX_IMPLEMENTATION_GUIDE.md',
  'HYBRID_IMPLEMENTATION_SUMMARY.md',
  'IMPLEMENTATION_REPORT.md',
  'ITERATION_FIXES_REPORT.md',
  'ITERATION_REPORT.md',
  'ITERATION_SUMMARY.md',
  'PERFORMANCE_OPTIMIZATION_SUMMARY.md',
  'SMITHERY_MCP_INTEGRATION_SUMMARY.md',
  'SMITHERY_MCP_USAGE_GUIDE.md',
  'SYSTEM_INTEGRATION_REPORT.md',
  'TIMEOUT_OPTIMIZATION_COMPLETE.md',
  
  // Redundant setup files
  'CI_CD_SETUP.md',
  'CLAUDE.md',
  'PUBLISH.md',
  
  // Build/error logs
  'build-errors.log',
  'lint-errors.log',
  'test-errors.log',
  
  // Legacy files
  'hello.txt',
  'huggingface-api-key.txt',
  'simple-electron-main.ts',
  'tsc'
];

// Directories to remove
const LEGACY_DIRECTORIES = [
  'test-project',
  'test-scenarios',
  'audit-reports',
  '.codecrucible',
  '.local',
  'extensions'
];

async function cleanupLegacyFiles() {
  console.log('🧹 LEGACY FILES & DOCUMENTATION CLEANUP');
  console.log('=======================================\n');
  
  let removedFiles = 0;
  let removedDirs = 0;
  let errors = 0;

  // Remove legacy test files
  console.log('🗑️  Removing legacy test files...');
  for (const fileName of LEGACY_TEST_FILES) {
    try {
      const fullPath = path.join(process.cwd(), fileName);
      try {
        await fs.access(fullPath);
        await fs.unlink(fullPath);
        console.log(`  ✅ Removed: ${fileName}`);
        removedFiles++;
      } catch (accessError) {
        console.log(`  ⏭️  Not found: ${fileName}`);
      }
    } catch (error) {
      console.log(`  ❌ Error removing ${fileName}:`, error.message);
      errors++;
    }
  }

  // Remove legacy documentation
  console.log('\n📄 Removing legacy documentation...');
  for (const fileName of LEGACY_DOCS) {
    try {
      const fullPath = path.join(process.cwd(), fileName);
      try {
        await fs.access(fullPath);
        await fs.unlink(fullPath);
        console.log(`  ✅ Removed: ${fileName}`);
        removedFiles++;
      } catch (accessError) {
        console.log(`  ⏭️  Not found: ${fileName}`);
      }
    } catch (error) {
      console.log(`  ❌ Error removing ${fileName}:`, error.message);
      errors++;
    }
  }

  // Remove legacy directories
  console.log('\n🗂️  Removing legacy directories...');
  for (const dirName of LEGACY_DIRECTORIES) {
    try {
      const fullPath = path.join(process.cwd(), dirName);
      try {
        await fs.access(fullPath);
        await fs.rm(fullPath, { recursive: true, force: true });
        console.log(`  ✅ Removed directory: ${dirName}`);
        removedDirs++;
      } catch (accessError) {
        console.log(`  ⏭️  Directory not found: ${dirName}`);
      }
    } catch (error) {
      console.log(`  ❌ Error removing directory ${dirName}:`, error.message);
      errors++;
    }
  }

  // Summary
  console.log('\n🎯 CLEANUP COMPLETE');
  console.log('===================');
  console.log(`✅ Files removed: ${removedFiles}`);
  console.log(`📁 Directories removed: ${removedDirs}`);
  console.log(`❌ Errors: ${errors}`);
  
  // Show what should remain
  console.log('\n📋 ESSENTIAL FILES REMAINING:');
  console.log('- README.md           (Main documentation)');
  console.log('- QUICK_START.md      (Getting started guide)');
  console.log('- SETUP.md            (Setup instructions)');
  console.log('- package.json        (Dependencies)');
  console.log('- tsconfig.json       (TypeScript config)');
  console.log('- jest.config.cjs     (Test configuration)');
  console.log('- src/                (Source code)');
  console.log('- tests/              (Proper test directory)');
  console.log('- bin/                (CLI binaries)');
  console.log('- config/             (Configuration files)');
  console.log('- scripts/            (Build scripts)');
  
  if (errors === 0) {
    console.log('\n🚀 Legacy cleanup successful!');
    console.log('Project is now clean and focused on essential files only.');
  } else {
    console.log('\n⚠️  Cleanup completed with some errors. Please review manually.');
  }
}

// Run cleanup
cleanupLegacyFiles().catch(error => {
  console.error('💥 Legacy cleanup failed:', error);
  process.exit(1);
});
