#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Fix React imports following AI_INSTRUCTIONS.md patterns
const filesToFix = [
  'client/src/components/ui/toast.tsx',
  'client/src/components/ui/input-otp.tsx',
];

const replacements = [
  { from: /import \* as React from "react"/g, to: 'import { forwardRef, ElementRef, ComponentPropsWithoutRef, HTMLAttributes, ComponentProps } from "react"' },
  { from: /React\.forwardRef</g, to: 'forwardRef' },
  { from: /React\.ElementRef/g, to: 'ElementRef' },
  { from: /React\.ComponentPropsWithoutRef/g, to: 'ComponentPropsWithoutRef' },
  { from: /React\.HTMLAttributes/g, to: 'HTMLAttributes' },
  { from: /React\.ComponentProps/g, to: 'ComponentProps' },
];

filesToFix.forEach(filePath => {
  if (fs.existsSync(filePath)) {
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
      console.log(`Fixed React imports in: ${filePath}`);
    }
  }
});

console.log('React import fix completed!');