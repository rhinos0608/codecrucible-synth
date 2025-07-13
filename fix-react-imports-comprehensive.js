#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Fix React imports following AI_INSTRUCTIONS.md patterns
const uiPath = 'client/src/components/ui';
const files = fs.readdirSync(uiPath)
  .filter(file => file.endsWith('.tsx'))
  .map(file => path.join(uiPath, file))
  .filter(filePath => {
    if (!fs.existsSync(filePath)) return false;
    const content = fs.readFileSync(filePath, 'utf8');
    return content.includes('React.') || content.includes('import * as React');
  });

console.log(`Found ${files.length} files needing React import fixes`);

const replacements = [
  { from: /import \* as React from "react"/g, to: 'import { forwardRef, ElementRef, ComponentPropsWithoutRef, HTMLAttributes, ComponentProps, ReactElement, ReactNode } from "react"' },
  { from: /React\.forwardRef/g, to: 'forwardRef' },
  { from: /React\.ElementRef/g, to: 'ElementRef' },
  { from: /React\.ComponentPropsWithoutRef/g, to: 'ComponentPropsWithoutRef' },
  { from: /React\.HTMLAttributes/g, to: 'HTMLAttributes' },
  { from: /React\.ComponentProps/g, to: 'ComponentProps' },
  { from: /React\.ReactElement/g, to: 'ReactElement' },
  { from: /React\.ReactNode/g, to: 'ReactNode' },
];

let totalFixed = 0;

files.forEach(filePath => {
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;
  
  replacements.forEach(({ from, to }) => {
    if (content.match(from)) {
      content = content.replace(from, to);
      modified = true;
    }
  });
  
  if (modified) {
    fs.writeFileSync(filePath, content);
    console.log(`✅ Fixed: ${filePath}`);
    totalFixed++;
  }
});

console.log(`\nCompleted! Fixed ${totalFixed} files for AI_INSTRUCTIONS.md compliance.`);