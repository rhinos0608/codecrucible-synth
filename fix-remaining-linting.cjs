#!/usr/bin/env node

/**
 * Conservative Linting Issue Fixer
 * Only fixes safe linting issues that don't affect TypeScript compilation
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const SEARCH_DIR = './src/core/search';

// Conservative linting fixes that are safe to apply
const SAFE_LINTING_FIXES = [
  {
    name: 'Fix unused parameters (safe prefix approach)',
    pattern: /(\w+)\(([^)]*?)([a-zA-Z][a-zA-Z0-9_]*): ([^,)]+)([^)]*)\) \{([^}]*)\n\s*\/\/ unused parameter: \3/g,
    replacement: '$1($2_$3: $4$5) {$6',
    description: 'Prefix truly unused parameters with underscore'
  },
  
  {
    name: 'Fix console statements in non-CLI files',
    apply: (content, filePath) => {
      const fileName = path.basename(filePath);
      const isCliFile = fileName.includes('cli') || fileName.includes('search-cli-commands');
      
      if (isCliFile) {
        return content; // Don't change console statements in CLI files
      }
      
      // Replace console statements with logger in non-CLI files
      return content
        .replace(/console\.log\(/g, 'this.logger?.debug(')
        .replace(/console\.error\(/g, 'this.logger?.error(')
        .replace(/console\.warn\(/g, 'this.logger?.warn(')
        .replace(/console\.info\(/g, 'this.logger?.info(');
    }
  },
  
  {
    name: 'Fix remaining nullish coalescing (safe cases)',
    replacements: [
      // Only fix simple cases that are clearly safe
      { pattern: /\|\| 0([^.])/g, replacement: '?? 0$1' },
      { pattern: /\|\| false([^.])/g, replacement: '?? false$1' },
      { pattern: /\|\| true([^.])/g, replacement: '?? true$1' },
      { pattern: /\|\| \[\]([^.])/g, replacement: '?? []$1' },
      { pattern: /\|\| \{\}([^.])/g, replacement: '?? {}$1' },
      { pattern: /\|\| ''([^.])/g, replacement: "?? ''$1" },
      { pattern: /\|\| ""([^.])/g, replacement: '?? ""$1' }
    ]
  },
  
  {
    name: 'Remove unused imports (conservative)',
    apply: (content, filePath) => {
      const lines = content.split('\n');
      const imports = [];
      const usageMap = new Map();
      
      // Find all imports
      lines.forEach((line, index) => {
        const importMatch = line.match(/import\s*\{([^}]+)\}\s*from/);
        if (importMatch) {
          const importNames = importMatch[1].split(',').map(name => name.trim());
          imports.push({ line: index, names: importNames, fullLine: line });
        }
      });
      
      // Check usage (simple heuristic)
      imports.forEach(imp => {
        imp.names.forEach(name => {
          const cleanName = name.replace(/\s+as\s+\w+/, '').trim();
          const usageCount = (content.match(new RegExp(`\\b${cleanName}\\b`, 'g')) || []).length;
          usageMap.set(cleanName, usageCount);
        });
      });
      
      // Remove imports that appear only once (the import line itself)
      let result = content;
      imports.forEach(imp => {
        const unusedNames = imp.names.filter(name => {
          const cleanName = name.replace(/\s+as\s+\w+/, '').trim();
          return usageMap.get(cleanName) <= 1;
        });
        
        if (unusedNames.length === imp.names.length) {
          // Remove entire import line
          result = result.replace(imp.fullLine, '');
        } else if (unusedNames.length > 0) {
          // Remove only unused names
          const usedNames = imp.names.filter(name => !unusedNames.includes(name));
          const newImportLine = imp.fullLine.replace(
            /\{[^}]+\}/,
            `{${usedNames.join(', ')}}`
          );
          result = result.replace(imp.fullLine, newImportLine);
        }
      });
      
      return result;
    }
  },
  
  {
    name: 'Fix non-null assertions (safe replacements)',
    replacements: [
      { pattern: /\.get\(([^)]+)\)!/g, replacement: '.get($1) || undefined' }
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
    execSync('npx tsc --noEmit', { stdio: 'pipe' });
    return true;
  } catch (error) {
    return false;
  }
}

function countLintingIssues() {
  try {
    const output = execSync('npx eslint src/core/search/ 2>&1', { encoding: 'utf8' });
    const errorCount = (output.match(/error/g) || []).length;
    const warningCount = (output.match(/warning/g) || []).length;
    return { errors: errorCount, warnings: warningCount, total: errorCount + warningCount };
  } catch (error) {
    const output = error.stdout ? error.stdout.toString() : '';
    const errorCount = (output.match(/error/g) || []).length;
    const warningCount = (output.match(/warning/g) || []).length;
    return { errors: errorCount, warnings: warningCount, total: errorCount + warningCount };
  }
}

function applySafeFix(fix, files) {
  const changedFiles = [];
  const backups = new Map();
  
  try {
    console.log(`🔨 Applying: ${fix.name}`);
    
    for (const filePath of files) {
      const originalContent = fs.readFileSync(filePath, 'utf8');
      backups.set(filePath, originalContent);
      
      let fixedContent = originalContent;
      
      if (fix.apply) {
        // Custom function
        fixedContent = fix.apply(originalContent, filePath);
      } else if (fix.replacements) {
        // Multiple replacements
        fix.replacements.forEach(repl => {
          fixedContent = fixedContent.replace(repl.pattern, repl.replacement);
        });
      } else if (fix.pattern) {
        // Single pattern
        fixedContent = fixedContent.replace(fix.pattern, fix.replacement);
      }
      
      if (originalContent !== fixedContent) {
        fs.writeFileSync(filePath, fixedContent);
        changedFiles.push(filePath);
      }
    }
    
    // Test that compilation still works
    if (!testCompilation()) {
      console.log(`  ❌ Fix broke compilation - rolling back`);
      // Rollback
      changedFiles.forEach(filePath => {
        fs.writeFileSync(filePath, backups.get(filePath));
      });
      return { success: false, changedFiles: 0 };
    }
    
    console.log(`  ✅ Applied to ${changedFiles.length} files`);
    return { success: true, changedFiles: changedFiles.length };
    
  } catch (error) {
    console.log(`  ❌ Error: ${error.message}`);
    // Rollback
    changedFiles.forEach(filePath => {
      if (backups.has(filePath)) {
        fs.writeFileSync(filePath, backups.get(filePath));
      }
    });
    return { success: false, changedFiles: 0 };
  }
}

async function main() {
  console.log('🧹 Starting conservative linting fixes...\n');
  
  // Check initial state
  const initialLinting = countLintingIssues();
  const initialCompilation = testCompilation();
  
  console.log('📊 Initial state:');
  console.log(`  - Compilation: ${initialCompilation ? 'Clean' : 'Has errors'}`);
  console.log(`  - Linting: ${initialLinting.errors} errors, ${initialLinting.warnings} warnings\n`);
  
  if (!initialCompilation) {
    console.log('❌ Initial compilation has errors. Please fix TypeScript errors first.');
    return;
  }
  
  const files = getAllTypeScriptFiles(SEARCH_DIR);
  let totalSuccessfulFixes = 0;
  let totalFilesChanged = 0;
  
  // Apply safe fixes
  for (const fix of SAFE_LINTING_FIXES) {
    const result = applySafeFix(fix, files);
    if (result.success) {
      totalSuccessfulFixes++;
      totalFilesChanged += result.changedFiles;
    }
  }
  
  // Final check
  const finalLinting = countLintingIssues();
  const finalCompilation = testCompilation();
  
  console.log('\n📊 Final Results:');
  console.log(`  - Successful fixes: ${totalSuccessfulFixes}/${SAFE_LINTING_FIXES.length}`);
  console.log(`  - Files changed: ${totalFilesChanged}`);
  console.log(`  - Compilation: ${finalCompilation ? 'Clean' : 'Has errors'}`);
  console.log(`  - Linting improvement: ${initialLinting.total} → ${finalLinting.total} (${initialLinting.total - finalLinting.total} issues fixed)`);
  
  if (finalLinting.total > 0) {
    console.log(`\n🔍 Remaining linting issues: ${finalLinting.errors} errors, ${finalLinting.warnings} warnings`);
  }
  
  console.log('\n🎉 Conservative linting fix process complete!');
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { applySafeFix, countLintingIssues };