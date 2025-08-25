#!/usr/bin/env node

/**
 * Final cleanup script for CLI command TypeScript errors
 * Handles remaining 55 TypeScript errors systematically
 */

const fs = require('fs');
const { execSync } = require('child_process');

console.log('🔧 Starting final CLI TypeScript error cleanup...\n');

function testCompilation() {
  try {
    execSync('npx tsc --noEmit', { stdio: 'pipe' });
    return { success: true, errors: [], totalErrors: 0 };
  } catch (error) {
    const output = error.stdout ? error.stdout.toString() : '';
    const errorOutput = error.stderr ? error.stderr.toString() : '';
    const fullOutput = output + errorOutput;
    
    const errorLines = fullOutput.split('\n').filter(line => 
      line.includes('error TS') && !line.includes('Found ')
    );
    
    return { 
      success: false, 
      errors: errorLines,
      totalErrors: errorLines.length
    };
  }
}

function createBackup(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const backupPath = `${filePath}.backup-${Date.now()}`;
  fs.writeFileSync(backupPath, content);
  return backupPath;
}

function restoreBackup(filePath, backupPath) {
  const backupContent = fs.readFileSync(backupPath, 'utf8');
  fs.writeFileSync(filePath, backupContent);
  fs.unlinkSync(backupPath);
}

function applyAndTestFix(filePath, fixFunction, description) {
  console.log(`🔧 Applying: ${description}`);
  
  const backupPath = createBackup(filePath);
  
  try {
    const originalContent = fs.readFileSync(filePath, 'utf8');
    const fixedContent = fixFunction(originalContent);
    
    if (fixedContent === originalContent) {
      console.log('  ➡️  No changes needed');
      fs.unlinkSync(backupPath);
      return true;
    }
    
    fs.writeFileSync(filePath, fixedContent);
    
    const compilationResult = testCompilation();
    
    if (compilationResult.success || compilationResult.totalErrors < initialErrors) {
      console.log(`  ✅ Success (${Math.max(0, initialErrors - compilationResult.totalErrors)} errors fixed)`);
      fs.unlinkSync(backupPath);
      return true;
    } else {
      console.log('  ❌ Caused compilation errors - rolled back');
      restoreBackup(filePath, backupPath);
      return false;
    }
    
  } catch (error) {
    console.log(`  ❌ Error applying fix: ${error.message}`);
    restoreBackup(filePath, backupPath);
    return false;
  }
}

// Specific fixes for remaining errors
function applySpecificFixes() {
  const fixes = [
    {
      file: 'src/core/search/search-cli-commands.ts',
      description: 'Fix CLI parameter type assertions and unknown types',
      apply: (content) => {
        let fixed = content;
        
        // Fix options parameter usage with proper type assertions
        fixed = fixed.replace(
          /handleSearchCommand\(query: string, options: unknown\)/g,
          'handleSearchCommand(query: string, options: Record<string, unknown>)'
        );
        
        fixed = fixed.replace(
          /handleFunctionSearch\(pattern: string, options: unknown\)/g,
          'handleFunctionSearch(pattern: string, options: Record<string, unknown>)'
        );
        
        fixed = fixed.replace(
          /handleClassSearch\(pattern: string, options: unknown\)/g,
          'handleClassSearch(pattern: string, options: Record<string, unknown>)'
        );
        
        fixed = fixed.replace(
          /handleImportSearch\(module: string, options: unknown\)/g,
          'handleImportSearch(module: string, options: Record<string, unknown>)'
        );
        
        fixed = fixed.replace(
          /handleFileSearch\(pattern: string, options: unknown\)/g,
          'handleFileSearch(pattern: string, options: Record<string, unknown>)'
        );
        
        // Fix option property accesses with proper type assertions
        fixed = fixed.replace(
          /options\.([a-zA-Z]+)/g,
          '(options as Record<string, unknown>).$1'
        );
        
        // Fix array index access
        fixed = fixed.replace(
          /options\[0\]/g,
          '(options as unknown[])[0]'
        );
        
        // Fix specific result processing
        fixed = fixed.replace(
          /results\.forEach\(\(r: unknown\)/g,
          'results.forEach((r: Record<string, unknown>)'
        );
        
        return fixed;
      }
    },
    {
      file: 'src/core/search/performance-monitor.ts',
      description: 'Fix logger method calls and nullish coalescing',
      apply: (content) => {
        let fixed = content;
        
        // Fix logger calls that need message parameter
        fixed = fixed.replace(
          /logger\.info\(\);/g,
          'logger.info("Performance monitoring complete");'
        );
        
        fixed = fixed.replace(
          /logger\.debug\(\);/g,
          'logger.debug("Debug checkpoint");'
        );
        
        // Fix nullish coalescing that should be logical OR
        fixed = fixed.replace(
          /(\w+\.\w+)\s*\?\?\s*(\w+\.\w+)\s*>/g,
          '$1 || $2 >'
        );
        
        return fixed;
      }
    }
  ];
  
  let totalSuccessful = 0;
  
  for (const fix of fixes) {
    const filePath = fix.file;
    if (fs.existsSync(filePath)) {
      const success = applyAndTestFix(filePath, fix.apply, fix.description);
      if (success) totalSuccessful++;
    } else {
      console.log(`⚠️  File not found: ${filePath}`);
    }
  }
  
  return totalSuccessful;
}

// Main execution
const initialCompilation = testCompilation();
let initialErrors = initialCompilation.totalErrors;

console.log(`📊 Initial compilation: ${initialErrors} errors\n`);

if (initialErrors === 0) {
  console.log('🎉 No TypeScript errors found!');
  process.exit(0);
}

const successfulFixes = applySpecificFixes();

// Final compilation check
const finalCompilation = testCompilation();
const finalErrors = finalCompilation.totalErrors;

console.log(`\n📊 Final Results:`);
console.log(`  - Successful fixes: ${successfulFixes}`);
console.log(`  - Initial errors: ${initialErrors}`);
console.log(`  - Final errors: ${finalErrors}`);
console.log(`  - Errors resolved: ${Math.max(0, initialErrors - finalErrors)}`);

if (finalErrors > 0 && finalErrors < 20) {
  console.log(`\n🔍 Remaining errors:`);
  finalCompilation.errors.slice(0, finalErrors).forEach(err => 
    console.log(`  ${err}`)
  );
} else if (finalErrors > 0) {
  console.log(`\n🔍 Remaining errors (first 15):`);
  finalCompilation.errors.slice(0, 15).forEach(err => 
    console.log(`  ${err}`)
  );
}

console.log('\n🎉 CLI error cleanup process complete!');

if (finalErrors === 0) {
  console.log('\n🚀 TypeScript compilation successful! All errors resolved.');
} else if (finalErrors < initialErrors) {
  console.log(`\n⏳ Significant progress made: ${initialErrors - finalErrors} errors fixed!`);
  console.log(`   ${finalErrors} errors remaining for manual review.`);
}