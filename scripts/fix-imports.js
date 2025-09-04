#!/usr/bin/env node

/**
 * Fix Import Paths Script
 *
 * This script fixes ES module import paths by adding .js extensions
 * where they are missing in TypeScript files.
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');
const srcDir = join(rootDir, 'src');

let filesFixed = 0;
let importsFixed = 0;

function findTsFiles(dir) {
  let tsFiles = [];

  const items = readdirSync(dir);
  for (const item of items) {
    const fullPath = join(dir, item);
    const stat = statSync(fullPath);

    if (stat.isDirectory() && !item.startsWith('.') && item !== 'node_modules') {
      tsFiles = tsFiles.concat(findTsFiles(fullPath));
    } else if (stat.isFile() && item.endsWith('.ts') && !item.endsWith('.d.ts')) {
      tsFiles.push(fullPath);
    }
  }

  return tsFiles;
}

function fixImportsInFile(filePath) {
  const content = readFileSync(filePath, 'utf-8');

  // Regex to match relative imports without .js extension
  const importRegex = /^(\s*(?:import|export).*from\s+['"])([.\/][^'"]*?)(['"])/gm;

  let modified = content;
  let fileImportsFixed = 0;

  modified = modified.replace(importRegex, (match, prefix, importPath, suffix) => {
    // Skip if already has .js extension or is not a relative path
    if (importPath.endsWith('.js') || !importPath.match(/^\.\.?\//)) {
      return match;
    }

    // Skip node_modules imports
    if (!importPath.startsWith('./') && !importPath.startsWith('../')) {
      return match;
    }

    // Add .js extension
    const fixedPath = importPath + '.js';
    fileImportsFixed++;

    return prefix + fixedPath + suffix;
  });

  if (fileImportsFixed > 0) {
    writeFileSync(filePath, modified);
    console.log(`✓ Fixed ${fileImportsFixed} imports in ${filePath.replace(rootDir, '.')}`);
    filesFixed++;
    importsFixed += fileImportsFixed;
  }

  return fileImportsFixed > 0;
}

function main() {
  console.log('🔧 Fixing ES module import paths...\n');

  const tsFiles = findTsFiles(srcDir);
  console.log(`Found ${tsFiles.length} TypeScript files to process\n`);

  for (const filePath of tsFiles) {
    try {
      fixImportsInFile(filePath);
    } catch (error) {
      console.error(`❌ Error processing ${filePath}: ${error.message}`);
    }
  }

  console.log(`\n✅ Import fixing complete!`);
  console.log(`📊 Summary:`);
  console.log(`   Files modified: ${filesFixed}`);
  console.log(`   Imports fixed: ${importsFixed}`);

  if (importsFixed > 0) {
    console.log(`\n🔄 Please rebuild the project: npm run build`);
  }
}

main();
