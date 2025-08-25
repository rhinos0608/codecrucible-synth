#!/usr/bin/env node

/**
 * Systematic TypeScript Compilation Error Fixer
 * Carefully fixes specific patterns without breaking functionality
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const SEARCH_DIR = './src/core/search';

// Define safe, targeted fixes
const TYPESCRIPT_FIXES = [
  // Variable scope fixes - restore parameter names where they're used in method body
  {
    name: 'Fix underscore-prefixed parameters that are used in code',
    pattern: /(\w+)\(([^)]*?)_([a-zA-Z][a-zA-Z0-9_]*)(: [^,)]+)([^)]*)\)\s*:\s*[^{]*\{([^}]*[^a-zA-Z_])\3([^a-zA-Z0-9_])/g,
    replacement: '$1($2$3$4$5): $6 {\n    const $3 = _$3; // Fix scope\n$6$3$7',
    test: (content, filePath) => {
      // Only apply if the parameter is actually used in the method body
      return content.includes('_query') || content.includes('_options') || content.includes('_format');
    }
  },
  
  // Simpler approach: just restore the parameter name if it's used
  {
    name: 'Restore parameter names that are used in method bodies',
    files: ['hybrid-search-coordinator.ts'],
    replacements: [
      { pattern: /_query: RAGQuery/g, replacement: 'query: RAGQuery' },
      { pattern: /_result: RAGResult/g, replacement: 'result: RAGResult' }
    ]
  },
  
  {
    name: 'Restore parameter names in error-handler.ts',
    files: ['error-handler.ts'],
    replacements: [
      { pattern: /_query: RAGQuery/g, replacement: 'query: RAGQuery' },
      { pattern: /_reason\??: string/g, replacement: 'reason?: string' }
    ]
  },
  
  {
    name: 'Restore parameter names in search-cli-commands.ts',
    files: ['search-cli-commands.ts'],
    replacements: [
      { pattern: /_options: unknown/g, replacement: 'options: Record<string, any>' },
      { pattern: /_format: string/g, replacement: 'format: string' },
      { pattern: /_metadata: unknown/g, replacement: 'metadata: Record<string, any>' }
    ]
  },

  // Interface fixes for SearchResult
  {
    name: 'Fix SearchResult interface consistency',
    files: ['cross-platform-search.ts'],
    replacements: [
      // Add missing content property
      { 
        pattern: /results\.push\(\{(\s*)file: ([^,]+),(\s*)line: ([^,]+),(\s*)match: ([^,]+),(\s*)column: ([^}]+)(\s*)\}\);/g,
        replacement: 'results.push({\n$1file: $2,\n$3line: $4,\n$5content: $6,\n$5match: $6,\n$7column: $8\n$9});'
      }
    ]
  },

  // Fix return type assertions
  {
    name: 'Fix return type issues in enhanced-search-integration.ts',
    files: ['enhanced-search-integration.ts'],
    replacements: [
      // Fix method return types that should be Promise<any> for flexibility
      { pattern: /Promise<Record<string, unknown>>/g, replacement: 'Promise<any>' }
    ]
  },

  // Fix generic type issues
  {
    name: 'Fix generic type constraints',
    files: ['command-line-search-engine.ts'],
    replacements: [
      // Restore original return type for cache method
      { pattern: /getCachedResults<T>\([^)]+\): T \| null/, replacement: 'getCachedResults<T>(key: string): T | null' },
      // Fix type assertion
      { pattern: /return cached as T;/, replacement: 'return cached as T | null;' }
    ]
  }
];

function getAllTypeScriptFiles(dir) {
  const files = [];
  
  function traverse(currentDir) {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      
      if (entry.isDirectory()) {
        traverse(fullPath);
      } else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.d.ts')) {
        files.push(fullPath);
      }
    }
  }
  
  traverse(dir);
  return files;
}

function testCompilation() {
  try {
    console.log('🧪 Testing TypeScript compilation...');
    execSync('npx tsc --noEmit', { stdio: 'pipe' });
    return { success: true, errors: [] };
  } catch (error) {
    const output = error.stdout ? error.stdout.toString() : '';
    const errorOutput = error.stderr ? error.stderr.toString() : '';
    const fullOutput = output + errorOutput;
    
    // Extract error count and details
    const errorLines = fullOutput.split('\n').filter(line => 
      line.includes('error TS') || line.includes('Found ') && line.includes('error')
    );
    
    return { 
      success: false, 
      errors: errorLines.slice(0, 10), // First 10 errors
      totalErrors: errorLines.length
    };
  }
}

function applyFixSafely(fix, files) {
  const changedFiles = [];
  const backups = new Map();
  
  try {
    // Create backups and apply fixes
    for (const filePath of files) {
      if (fix.files && !fix.files.some(f => filePath.includes(f))) {
        continue; // Skip files not in the target list
      }
      
      const originalContent = fs.readFileSync(filePath, 'utf8');
      backups.set(filePath, originalContent);
      
      let fixedContent = originalContent;
      let hasChanges = false;
      
      if (fix.replacements) {
        // Apply multiple replacements
        for (const repl of fix.replacements) {
          const beforeChange = fixedContent;
          fixedContent = fixedContent.replace(repl.pattern, repl.replacement);
          if (beforeChange !== fixedContent) {
            hasChanges = true;
          }
        }
      } else if (fix.pattern) {
        // Apply single pattern fix
        if (!fix.test || fix.test(originalContent, filePath)) {
          const beforeChange = fixedContent;
          fixedContent = fixedContent.replace(fix.pattern, fix.replacement);
          if (beforeChange !== fixedContent) {
            hasChanges = true;
          }
        }
      }
      
      if (hasChanges) {
        fs.writeFileSync(filePath, fixedContent);
        changedFiles.push(filePath);
        console.log(`  📝 Applied fix to ${path.basename(filePath)}`);
      }
    }
    
    // Test compilation
    const compilationResult = testCompilation();
    
    if (compilationResult.success) {
      console.log(`  ✅ Fix "${fix.name}" successful - compilation clean`);
      return { success: true, changedFiles };
    } else {
      console.log(`  ❌ Fix "${fix.name}" caused compilation errors - rolling back`);
      
      // Rollback all changes
      for (const filePath of changedFiles) {
        fs.writeFileSync(filePath, backups.get(filePath));
      }
      
      return { 
        success: false, 
        error: `Caused ${compilationResult.totalErrors} compilation errors`,
        sampleErrors: compilationResult.errors.slice(0, 3)
      };
    }
    
  } catch (error) {
    // Rollback on any error
    for (const filePath of changedFiles) {
      if (backups.has(filePath)) {
        fs.writeFileSync(filePath, backups.get(filePath));
      }
    }
    
    return { 
      success: false, 
      error: error.message 
    };
  }
}

async function main() {
  console.log('🔧 Starting systematic TypeScript error fixes...\n');
  
  // Get initial compilation status
  const initialTest = testCompilation();
  console.log(`📊 Initial state: ${initialTest.success ? 'Clean' : `${initialTest.totalErrors} errors`}\n`);
  
  if (initialTest.success) {
    console.log('✅ No compilation errors found!');
    return;
  }
  
  const files = getAllTypeScriptFiles(SEARCH_DIR);
  let totalSuccessfulFixes = 0;
  let totalErrorsFixed = 0;
  
  // Apply fixes one by one with testing
  for (const fix of TYPESCRIPT_FIXES) {
    console.log(`🔨 Applying fix: ${fix.name}`);
    
    const result = applyFixSafely(fix, files);
    
    if (result.success) {
      totalSuccessfulFixes++;
      console.log(`  📈 Changed ${result.changedFiles.length} files\n`);
    } else {
      console.log(`  ⚠️  Failed: ${result.error}`);
      if (result.sampleErrors) {
        result.sampleErrors.forEach(err => console.log(`    ${err}`));
      }
      console.log('');
    }
  }
  
  // Final compilation test
  const finalTest = testCompilation();
  console.log('📊 Final Results:');
  console.log(`  - Successful fixes applied: ${totalSuccessfulFixes}/${TYPESCRIPT_FIXES.length}`);
  console.log(`  - Final compilation status: ${finalTest.success ? 'Clean' : `${finalTest.totalErrors} errors`}`);
  
  if (!finalTest.success && finalTest.errors.length > 0) {
    console.log('\n🔍 Remaining compilation errors:');
    finalTest.errors.slice(0, 5).forEach(err => console.log(`  ${err}`));
    if (finalTest.totalErrors > 5) {
      console.log(`  ... and ${finalTest.totalErrors - 5} more errors`);
    }
  }
  
  console.log('\n🎉 TypeScript error fix process complete!');
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { applyFixSafely, testCompilation };