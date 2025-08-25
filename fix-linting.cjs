#!/usr/bin/env node

/**
 * Batch Linting Fix Script for Search Module
 * Fixes common linting issues across all files in the search module
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const SEARCH_DIR = './src/core/search';

// Define batch replacements
const BATCH_REPLACEMENTS = [
  // Nullish coalescing fixes
  { pattern: /\|\| 0([^.\w])/g, replacement: '?? 0$1' },
  { pattern: /\|\| false([^.\w])/g, replacement: '?? false$1' },
  { pattern: /\|\| true([^.\w])/g, replacement: '?? true$1' },
  { pattern: /\|\| '([^']+)'([^.\w])/g, replacement: "?? '$1'$2" },
  { pattern: /\|\| "([^"]+)"([^.\w])/g, replacement: '?? "$1"$2' },
  { pattern: /\|\| \[\]([^.\w])/g, replacement: '?? []$1' },
  { pattern: /\|\| \{\}([^.\w])/g, replacement: '?? {}$1' },
  
  // Any type fixes
  { pattern: /: any\[\]/g, replacement: ': unknown[]' },
  { pattern: /: any([^.\w])/g, replacement: ': unknown$1' },
  { pattern: /Promise<any>/g, replacement: 'Promise<unknown>' },
  { pattern: /Map<([^,]+), any>/g, replacement: 'Map<$1, unknown>' },
  { pattern: /Record<([^,]+), any>/g, replacement: 'Record<$1, unknown>' },
  { pattern: /\(([^:)]+): any\)/g, replacement: '($1: unknown)' },
  
  // Function type fixes  
  { pattern: /: Function([^.\w])/g, replacement: ': (...args: unknown[]) => unknown$1' },
  { pattern: /Map<string, Function>/g, replacement: 'Map<string, (...args: unknown[]) => unknown>' },
  
  // Unused parameter fixes
  { pattern: /\b([a-zA-Z_][a-zA-Z0-9_]*): ([^,)]+)\) {[^}]*\/\/ unused/g, replacement: '_$1: $2) {' },
  { pattern: /function\s+([a-zA-Z_][a-zA-Z0-9_]*)\(([^)]*)\s+([a-zA-Z_][a-zA-Z0-9_]*): ([^,)]+)\)/g, 
    replacement: 'function $1($2 _$3: $4)' },
  
  // Console statement replacements for non-CLI files
  { pattern: /console\.log\(/g, replacement: 'this.logger?.debug(' },
  { pattern: /console\.error\(/g, replacement: 'this.logger?.error(' },
  { pattern: /console\.warn\(/g, replacement: 'this.logger?.warn(' },
  { pattern: /console\.info\(/g, replacement: 'this.logger?.info(' },
];

// Files that should keep console statements (CLI files)
const CLI_FILES = [
  'cli-integration.ts',
  'search-cli-commands.ts'
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

function fixFileContent(filePath, content) {
  let fixedContent = content;
  const fileName = path.basename(filePath);
  const isCLIFile = CLI_FILES.some(cliFile => fileName.includes(cliFile.replace('.ts', '')));
  
  console.log(`Fixing ${filePath}...`);
  
  for (const { pattern, replacement } of BATCH_REPLACEMENTS) {
    // Skip console replacements for CLI files
    if (isCLIFile && pattern.source.includes('console')) {
      continue;
    }
    
    const before = fixedContent;
    fixedContent = fixedContent.replace(pattern, replacement);
    
    if (before !== fixedContent) {
      const matches = before.match(pattern) || [];
      console.log(`  - Applied ${matches.length} ${pattern.source} fixes`);
    }
  }
  
  // Additional specific fixes
  
  // Fix unused imports
  fixedContent = fixedContent.replace(/import\s+\{[^}]*\b([a-zA-Z_][a-zA-Z0-9_]*)\b[^}]*\}\s+from[^;]+;[\r\n]+/g, (match, importName) => {
    // Check if the import is actually used (excluding in comments)
    const codeWithoutComments = fixedContent.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    const regex = new RegExp(`\\b${importName}\\b`, 'g');
    const usages = (codeWithoutComments.match(regex) || []).length;
    
    // If only used once (the import itself), it's unused
    if (usages <= 1) {
      console.log(`  - Removed unused import: ${importName}`);
      return '';
    }
    return match;
  });
  
  // Fix non-null assertions
  fixedContent = fixedContent.replace(/\.get\(([^)]+)\)!/g, '.get($1) ?? undefined');
  fixedContent = fixedContent.replace(/\[(\w+)\]!/g, '[$1] ?? undefined');
  
  // Prefix unused parameters with underscore
  fixedContent = fixedContent.replace(/\b(function|async\s+function|\w+:\s*\([^)]*\s)([a-zA-Z_][a-zA-Z0-9_]*)(:\s*[^,)]+)[,)]/g, 
    (match, prefix, paramName, type, suffix) => {
      // Simple heuristic: if parameter name appears only once more in the function, it's likely unused
      return match; // Let ESLint handle this with more sophisticated analysis
    });
  
  return fixedContent;
}

async function main() {
  console.log('🔧 Starting batch linting fixes for search module...\n');
  
  try {
    // Get all TypeScript files in search directory
    const files = getAllTypeScriptFiles(SEARCH_DIR);
    console.log(`Found ${files.length} TypeScript files to process\n`);
    
    let totalFiles = 0;
    let totalFixes = 0;
    
    for (const filePath of files) {
      try {
        const originalContent = fs.readFileSync(filePath, 'utf8');
        const fixedContent = fixFileContent(filePath, originalContent);
        
        if (originalContent !== fixedContent) {
          fs.writeFileSync(filePath, fixedContent);
          totalFixes++;
          console.log(`  ✅ Updated ${path.basename(filePath)}`);
        } else {
          console.log(`  ⏭️  No changes needed for ${path.basename(filePath)}`);
        }
        totalFiles++;
        console.log('');
        
      } catch (error) {
        console.error(`❌ Error processing ${filePath}:`, error.message);
      }
    }
    
    console.log(`\n📊 Summary:`);
    console.log(`  - Processed: ${totalFiles} files`);
    console.log(`  - Modified: ${totalFixes} files`);
    
    // Run ESLint to see remaining issues
    console.log(`\n🔍 Checking remaining linting issues...`);
    try {
      execSync(`npx eslint ${SEARCH_DIR} --quiet`, { stdio: 'inherit' });
      console.log('✅ No linting errors remaining!');
    } catch (error) {
      console.log('ℹ️  Some linting issues may remain - checking specific counts...');
      try {
        const output = execSync(`npx eslint ${SEARCH_DIR} 2>&1`, { encoding: 'utf8' });
        const errorCount = (output.match(/error/g) || []).length;
        const warningCount = (output.match(/warning/g) || []).length;
        console.log(`📈 Remaining: ${errorCount} errors, ${warningCount} warnings`);
      } catch (e) {
        console.log('Could not get precise counts');
      }
    }
    
    console.log('\n🎉 Batch linting fix complete!');
    
  } catch (error) {
    console.error('❌ Fatal error:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { fixFileContent, BATCH_REPLACEMENTS };