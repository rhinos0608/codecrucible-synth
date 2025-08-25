#!/usr/bin/env node

/**
 * Interface and Type Consistency Fixer
 * Fixes specific interface mismatches and type issues
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const SEARCH_DIR = './src/core/search';

// Specific interface fixes
const INTERFACE_FIXES = [
  {
    name: 'Fix SearchResult interface consistency in cross-platform-search.ts',
    file: 'cross-platform-search.ts',
    apply: (content) => {
      // Add content property to SearchResult objects
      return content
        .replace(
          /results\.push\(\{\s*file: ([^,]+),\s*line: ([^,]+),\s*match: ([^,]+),\s*column: ([^}]+)\s*\}\);/g,
          'results.push({\n        file: $1,\n        line: $2,\n        content: $3,\n        match: $3,\n        column: $4\n      });'
        )
        .replace(
          /return \{\s*file: ([^,]+),\s*line: ([^,]+),\s*match: ([^,]+),\s*column: ([^}]+)\s*\}/g,
          'return {\n        file: $1,\n        line: $2,\n        content: $3,\n        match: $3,\n        column: $4\n      }'
        );
    }
  },
  
  {
    name: 'Fix CLI interface types in search-cli-commands.ts',
    file: 'search-cli-commands.ts',
    apply: (content) => {
      // Add proper interfaces for CLI options
      const interfaceDefinition = `
interface CLISearchOptions {
  lang?: string[];
  context?: string;
  output?: string;
  caseSensitive?: boolean;
  wholeWord?: boolean;
  regex?: boolean;
  maxResults?: string;
  method?: string;
  confidence?: string;
  type?: string;
  showUsage?: boolean;
  clear?: boolean;
  stats?: boolean;
  export?: string;
  queries?: string;
  iterations?: string;
  methods?: string[];
  threshold?: string;
}

interface CLIMetadata {
  query?: string;
  duration?: number;
  searchType?: string;
}

interface CLIResult {
  file?: string;
  line?: number;
  match?: string;
  content?: string;
  path?: string;
  name?: string;
  size?: number;
  modified?: Date;
}
`;

      // Add interfaces at the top after imports
      const withInterfaces = content.replace(
        /(import.*;\n\n)/,
        `$1${interfaceDefinition}\n`
      );

      // Replace Record<string, any> with proper types
      return withInterfaces
        .replace(/options: Record<string, any>/g, 'options: CLISearchOptions')
        .replace(/metadata: Record<string, any>/g, 'metadata: CLIMetadata')
        .replace(/result: unknown/g, 'result: CLIResult')
        .replace(/results: unknown\[\]/g, 'results: CLIResult[]');
    }
  },
  
  {
    name: 'Fix enhanced-search-integration return types',
    file: 'enhanced-search-integration.ts',
    apply: (content) => {
      // Replace Promise<Record<string, unknown>> with Promise<any> for flexibility
      return content
        .replace(/Promise<Record<string, unknown>>/g, 'Promise<any>')
        .replace(/return this\.analyze([A-Z]\w+)/g, 'return await this.analyze$1')
        .replace(/: Record<string, unknown>/g, ': any');
    }
  },
  
  {
    name: 'Fix command-line-search-engine cache types',
    file: 'command-line-search-engine.ts',
    apply: (content) => {
      // Fix generic type handling in cache
      return content
        .replace(
          /getCachedResults<T>\([^)]+\): T \| null[^{]*\{([^}]*return cached as T;[^}]*)\}/g,
          'getCachedResults<T>(key: string): T | null {\n    const cached = this.cache.get(key)?.results;\n    if (!cached) return null;\n    return cached as T;\n  }'
        );
    }
  },
  
  {
    name: 'Fix advanced-search-cache interface issues',
    file: 'advanced-search-cache.ts',
    apply: (content) => {
      // Fix the documents.length issue
      return content.replace(
        /return results\.documents\?\.length \?\? 0;/g,
        'if (results && typeof results === \'object\' && \'documents\' in results && Array.isArray((results as any).documents)) {\n      return (results as any).documents.length;\n    }\n    return Array.isArray(results) ? results.length : 1;'
      );
    }
  }
];

function testCompilation() {
  try {
    execSync('npx tsc --noEmit', { stdio: 'pipe' });
    return { success: true, errors: [] };
  } catch (error) {
    const output = error.stdout ? error.stdout.toString() : '';
    const errorOutput = error.stderr ? error.stderr.toString() : '';
    const fullOutput = output + errorOutput;
    
    const errorLines = fullOutput.split('\n').filter(line => 
      line.includes('error TS') && !line.includes('Found ')
    );
    
    return { 
      success: false, 
      errors: errorLines.slice(0, 10),
      totalErrors: errorLines.length
    };
  }
}

function applyInterfaceFix(fix) {
  const filePath = path.join(SEARCH_DIR, fix.file);
  
  if (!fs.existsSync(filePath)) {
    console.log(`  ⚠️  File ${fix.file} not found`);
    return { success: false, error: 'File not found' };
  }
  
  try {
    console.log(`🔧 Applying: ${fix.name}`);
    
    const originalContent = fs.readFileSync(filePath, 'utf8');
    const fixedContent = fix.apply(originalContent);
    
    if (originalContent === fixedContent) {
      console.log(`  ➡️  No changes needed`);
      return { success: true, changed: false };
    }
    
    // Create backup
    const backupPath = `${filePath}.backup`;
    fs.writeFileSync(backupPath, originalContent);
    
    // Apply fix
    fs.writeFileSync(filePath, fixedContent);
    
    // Test compilation
    const compilationResult = testCompilation();
    
    if (compilationResult.success) {
      // Remove backup
      fs.unlinkSync(backupPath);
      console.log(`  ✅ Applied successfully`);
      return { success: true, changed: true };
    } else {
      // Rollback
      fs.writeFileSync(filePath, originalContent);
      fs.unlinkSync(backupPath);
      console.log(`  ❌ Caused compilation errors - rolled back`);
      console.log(`     Sample errors:`);
      compilationResult.errors.slice(0, 2).forEach(err => {
        console.log(`     ${err}`);
      });
      return { 
        success: false, 
        error: 'Compilation errors',
        errorCount: compilationResult.totalErrors
      };
    }
    
  } catch (error) {
    console.log(`  ❌ Error: ${error.message}`);
    return { success: false, error: error.message };
  }
}

async function main() {
  console.log('🔧 Starting interface and type fixes...\n');
  
  // Initial compilation check
  const initialTest = testCompilation();
  console.log(`📊 Initial compilation: ${initialTest.success ? 'Clean' : `${initialTest.totalErrors || 'unknown'} errors`}\n`);
  
  let totalSuccessful = 0;
  let totalChanged = 0;
  
  // Apply fixes one by one
  for (const fix of INTERFACE_FIXES) {
    const result = applyInterfaceFix(fix);
    if (result.success) {
      totalSuccessful++;
      if (result.changed) {
        totalChanged++;
      }
    }
  }
  
  // Final compilation check
  const finalTest = testCompilation();
  
  console.log('\n📊 Final Results:');
  console.log(`  - Successful fixes: ${totalSuccessful}/${INTERFACE_FIXES.length}`);
  console.log(`  - Files changed: ${totalChanged}`);
  console.log(`  - Final compilation: ${finalTest.success ? 'Clean' : `${finalTest.totalErrors || 'unknown'} errors`}`);
  
  if (!finalTest.success) {
    console.log('\n🔍 Remaining compilation errors (first 5):');
    finalTest.errors.slice(0, 5).forEach(err => {
      console.log(`  ${err}`);
    });
  }
  
  console.log('\n🎉 Interface fix process complete!');
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { applyInterfaceFix };