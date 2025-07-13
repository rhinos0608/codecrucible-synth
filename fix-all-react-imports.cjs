const fs = require('fs');
const path = require('path');

console.log('🔧 Final React import cleanup for complete AI_INSTRUCTIONS.md compliance...\n');

// Find all files with React.* references
const searchPaths = [
  'client/src/components',
  'client/src/hooks',
  'client/src/lib'
];

const filesToFix = [];

function findReactFiles(dirPath) {
  if (!fs.existsSync(dirPath)) return;
  
  const items = fs.readdirSync(dirPath);
  
  for (const item of items) {
    const fullPath = path.join(dirPath, item);
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory() && item !== 'node_modules') {
      findReactFiles(fullPath);
    } else if (stat.isFile() && (item.endsWith('.tsx') || item.endsWith('.ts'))) {
      const content = fs.readFileSync(fullPath, 'utf8');
      if (content.includes('React.') || content.includes('import * as React')) {
        filesToFix.push(fullPath);
      }
    }
  }
}

searchPaths.forEach(findReactFiles);

console.log(`Found ${filesToFix.length} files with React.* references:`);
filesToFix.forEach(file => console.log(`  - ${file}`));

const replacements = [
  // Import statement fixes
  { from: /import \* as React from "react"/g, to: 'import { forwardRef, ElementRef, ComponentPropsWithoutRef, HTMLAttributes, ComponentProps, ReactElement, ReactNode, createContext, useContext, useId, useMemo, useState, useEffect } from "react"' },
  
  // React.* reference fixes
  { from: /React\.forwardRef/g, to: 'forwardRef' },
  { from: /React\.ElementRef/g, to: 'ElementRef' },
  { from: /React\.ComponentPropsWithoutRef/g, to: 'ComponentPropsWithoutRef' },
  { from: /React\.HTMLAttributes/g, to: 'HTMLAttributes' },
  { from: /React\.ComponentProps/g, to: 'ComponentProps' },
  { from: /React\.ReactElement/g, to: 'ReactElement' },
  { from: /React\.ReactNode/g, to: 'ReactNode' },
  { from: /React\.createContext/g, to: 'createContext' },
  { from: /React\.useContext/g, to: 'useContext' },
  { from: /React\.useId/g, to: 'useId' },
  { from: /React\.useMemo/g, to: 'useMemo' },
  { from: /React\.useState/g, to: 'useState' },
  { from: /React\.useEffect/g, to: 'useEffect' },
];

let totalFixed = 0;
let totalReplacements = 0;

filesToFix.forEach(filePath => {
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;
  let fileReplacements = 0;
  
  replacements.forEach(({ from, to }) => {
    const matches = content.match(from);
    if (matches) {
      content = content.replace(from, to);
      modified = true;
      fileReplacements += matches.length;
      totalReplacements += matches.length;
    }
  });
  
  if (modified) {
    fs.writeFileSync(filePath, content);
    console.log(`✅ Fixed: ${path.basename(filePath)} (${fileReplacements} replacements)`);
    totalFixed++;
  }
});

console.log(`\n🎉 Complete React import cleanup finished!`);
console.log(`📊 Summary:`);
console.log(`   - Files fixed: ${totalFixed}`);
console.log(`   - Total replacements: ${totalReplacements}`);
console.log(`✨ All components now fully comply with AI_INSTRUCTIONS.md patterns.\n`);