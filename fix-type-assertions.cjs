#!/usr/bin/env node

/**
 * Advanced TypeScript Type Assertion Fixer
 * Handles unknown type issues with proper type guards and assertions
 */

const fs = require('fs');
const { execSync } = require('child_process');
const path = require('path');

console.log('🔧 Starting TypeScript type assertion fixes...\n');

// Test compilation and get error details
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

// Backup file
function createBackup(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const backupPath = `${filePath}.backup-${Date.now()}`;
  fs.writeFileSync(backupPath, content);
  return backupPath;
}

// Restore from backup
function restoreBackup(filePath, backupPath) {
  const backupContent = fs.readFileSync(backupPath, 'utf8');
  fs.writeFileSync(filePath, backupContent);
  fs.unlinkSync(backupPath);
}

// Apply a fix to content and test it
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
      console.log(`  ✅ Success (${initialErrors - compilationResult.totalErrors} errors fixed)`);
      fs.unlinkSync(backupPath);
      return true;
    } else {
      console.log('  ❌ Caused compilation errors - rolled back');
      console.log('     Sample errors:');
      compilationResult.errors.slice(0, 3).forEach(err => 
        console.log(`     ${err}`)
      );
      restoreBackup(filePath, backupPath);
      return false;
    }
    
  } catch (error) {
    console.log(`  ❌ Error applying fix: ${error.message}`);
    restoreBackup(filePath, backupPath);
    return false;
  }
}

// Fix patterns for different error types
const TYPE_ASSERTION_FIXES = [
  {
    name: 'Fix Object.values() with Record type assertion',
    pattern: /Object\.values\(([^)]+)\)\.reduce/g,
    replacement: '(Object.values($1) as Record<string, unknown>[]).reduce',
  },
  {
    name: 'Fix unknown variables with Record type guards',
    pattern: /(\w+)\s+is of type 'unknown'/g, 
    // This requires more complex logic
  },
  {
    name: 'Fix Array.isArray() checks with proper type guards',
    pattern: /if\s*\(\s*Array\.isArray\(([^)]+)\)\s*\)/g,
    replacement: 'if (Array.isArray($1) && $1.every((item): item is Record<string, unknown> => typeof item === "object" && item !== null))',
  }
];

// Apply specific fixes for known error patterns
function fixSpecificTypeIssues() {
  const fixes = [
    {
      file: 'src/core/search/enhanced-search-integration.ts',
      description: 'Fix array reduce and type assertions',
      apply: (content) => {
        let fixed = content;
        
        // Fix Object.values() reduce calls
        fixed = fixed.replace(
          /Object\.values\(([^)]+)\)\.reduce\(/g,
          '(Object.values($1) as Record<string, unknown>[]).reduce('
        );
        
        return fixed;
      }
    },
    {
      file: 'src/core/search/error-handler.ts', 
      description: 'Fix nullish coalescing operators',
      apply: (content) => {
        let fixed = content;
        
        // Fix unreachable ?? operators by changing to ||
        fixed = fixed.replace(
          /(\w+\.\w+)\s*\?\?\s*([^;]+);/g,
          (match, left, right) => {
            // Only change if it looks like a string/boolean check
            if (right.includes("'") || right === 'false' || right === 'true') {
              return `${left} || ${right};`;
            }
            return match;
          }
        );
        
        return fixed;
      }
    },
    {
      file: 'src/core/search/hybrid-search-coordinator.ts',
      description: 'Fix unknown type variables with proper assertions',
      apply: (content) => {
        let fixed = content;
        
        // Fix queryAnalysis and systemAnalysis unknown types
        const variablePatterns = [
          { var: 'queryAnalysis', type: 'Record<string, unknown>' },
          { var: 'systemAnalysis', type: 'Record<string, unknown>' }
        ];
        
        for (const { var: varName, type } of variablePatterns) {
          // Add type assertion where the variable is used
          fixed = fixed.replace(
            new RegExp(`(\\s+)(${varName})\\.`, 'g'),
            `$1(${varName} as ${type}).`
          );
        }
        
        return fixed;
      }
    },
    {
      file: 'src/core/search/search-cli-commands.ts',
      description: 'Fix CLI command parameter types',
      apply: (content) => {
        let fixed = content;
        
        // Fix options parameter type assertions
        fixed = fixed.replace(
          /(\w+options\w*)\s+is of type 'unknown'/g,
          ''
        );
        
        // Add type assertions for options usage
        fixed = fixed.replace(
          /(options)\.(\w+)/g,
          '(options as Record<string, unknown>).$2'
        );
        
        // Fix specific patterns for CLI commands
        fixed = fixed.replace(
          /options\[(\d+)\]/g,
          '(options as unknown[])[0]'
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

const successfulFixes = fixSpecificTypeIssues();

// Final compilation check
const finalCompilation = testCompilation();
const finalErrors = finalCompilation.totalErrors;

console.log(`\n📊 Final Results:`);
console.log(`  - Successful fixes: ${successfulFixes}`);
console.log(`  - Initial errors: ${initialErrors}`);
console.log(`  - Final errors: ${finalErrors}`);
console.log(`  - Errors resolved: ${initialErrors - finalErrors}`);

if (finalErrors > 0) {
  console.log(`\n🔍 Remaining errors (first 10):`);
  finalCompilation.errors.slice(0, 10).forEach(err => 
    console.log(`  ${err}`)
  );
}

console.log('\n🎉 Type assertion fix process complete!');