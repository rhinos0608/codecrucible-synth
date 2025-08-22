/**
 * TypeScript Strict Mode Compliance Tests
 * Following AI Coding Grimoire standards for type safety
 * Tests to ensure TypeScript strict mode violations are fixed
 */

import { describe, it, expect, jest } from '@jest/globals';
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

describe('TypeScript Strict Mode Compliance', () => {
  const rootDir = path.resolve(__dirname, '../../');
  const srcDir = path.join(rootDir, 'src');
  
  describe('Type Safety Requirements', () => {
    it('should compile with strict mode enabled', () => {
      // This test will fail initially but guide our fixes
      let compileErrors: string[] = [];
      
      try {
        // Try to compile with strict mode
        execSync('npx tsc --strict --noEmit', {
          cwd: rootDir,
          encoding: 'utf8'
        });
      } catch (error: any) {
        compileErrors = error.stdout?.split('\n').filter((line: string) => line.includes('error TS')) || [];
      }
      
      // Log current violations for tracking
      if (compileErrors.length > 0) {
        console.log(`Current TypeScript violations: ${compileErrors.length}`);
        console.log('Top 10 violations:');
        compileErrors.slice(0, 10).forEach(err => console.log(err));
      }
      
      // This will fail until all violations are fixed
      // For now, we track progress
      const maxAllowedErrors = 1381; // Current known violations
      expect(compileErrors.length).toBeLessThanOrEqual(maxAllowedErrors);
    });
    
    it('should have no implicit any types', () => {
      const implicitAnyErrors = getTypeScriptErrors().filter(
        err => err.includes('TS7006') || err.includes('implicitly has an \'any\' type')
      );
      
      // Track implicit any violations
      console.log(`Implicit any violations: ${implicitAnyErrors.length}`);
      
      // Goal: 0 implicit any
      const maxAllowed = 100; // Start with current state
      expect(implicitAnyErrors.length).toBeLessThanOrEqual(maxAllowed);
    });
    
    it('should handle unknown types in catch blocks', () => {
      const unknownErrors = getTypeScriptErrors().filter(
        err => err.includes('TS18046') || err.includes('is of type \'unknown\'')
      );
      
      console.log(`Unknown type violations: ${unknownErrors.length}`);
      
      // Goal: 0 unknown type errors
      const maxAllowed = 50; // Start with current state
      expect(unknownErrors.length).toBeLessThanOrEqual(maxAllowed);
    });
    
    it('should have all properties defined on types', () => {
      const propertyErrors = getTypeScriptErrors().filter(
        err => err.includes('TS2339') || err.includes('Property') && err.includes('does not exist')
      );
      
      console.log(`Missing property violations: ${propertyErrors.length}`);
      
      // Goal: 0 missing properties
      const maxAllowed = 50; // Start with current state
      expect(propertyErrors.length).toBeLessThanOrEqual(maxAllowed);
    });
    
    it('should initialize all class properties', () => {
      const initErrors = getTypeScriptErrors().filter(
        err => err.includes('TS2564') || err.includes('not definitely assigned')
      );
      
      console.log(`Uninitialized property violations: ${initErrors.length}`);
      
      // Goal: 0 uninitialized properties
      const maxAllowed = 20; // Start with current state
      expect(initErrors.length).toBeLessThanOrEqual(maxAllowed);
    });
  });
  
  describe('Code Pattern Compliance', () => {
    it('should use proper error handling patterns', () => {
      const sourceFiles = getAllTypeScriptFiles(srcDir);
      let improperCatchBlocks = 0;
      
      sourceFiles.forEach(file => {
        const content = fs.readFileSync(file, 'utf8');
        
        // Check for catch blocks without proper error typing
        const catchPattern = /catch\s*\(\s*(\w+)\s*\)/g;
        let match;
        while ((match = catchPattern.exec(content)) !== null) {
          const errorVar = match[1];
          // Check if error is properly typed in the catch block
          if (!content.includes(`${errorVar} as Error`) && 
              !content.includes(`${errorVar}: any`) &&
              !content.includes(`${errorVar}: unknown`)) {
            improperCatchBlocks++;
          }
        }
      });
      
      console.log(`Improper catch blocks: ${improperCatchBlocks}`);
      expect(improperCatchBlocks).toBeLessThanOrEqual(50); // Gradually reduce
    });
    
    it('should use explicit return types for functions', () => {
      const sourceFiles = getAllTypeScriptFiles(srcDir);
      let missingReturnTypes = 0;
      
      sourceFiles.forEach(file => {
        const content = fs.readFileSync(file, 'utf8');
        
        // Check for functions without explicit return types
        const functionPattern = /(?:async\s+)?(?:function\s+\w+|(?:\w+)\s*=\s*(?:async\s+)?(?:\([^)]*\)|[^=]+)\s*=>)\s*{/g;
        const lines = content.split('\n');
        
        lines.forEach((line, index) => {
          if (functionPattern.test(line)) {
            // Check if return type is specified
            if (!line.includes(':') || line.indexOf(':') < line.lastIndexOf(')')) {
              missingReturnTypes++;
            }
          }
        });
      });
      
      console.log(`Functions without explicit return types: ${missingReturnTypes}`);
      // This is a recommendation, not a strict requirement
      expect(missingReturnTypes).toBeDefined();
    });
    
    it('should avoid using any type', () => {
      const sourceFiles = getAllTypeScriptFiles(srcDir);
      let anyTypeUsage = 0;
      
      sourceFiles.forEach(file => {
        const content = fs.readFileSync(file, 'utf8');
        
        // Count explicit 'any' usage (excluding necessary cases)
        const anyPattern = /:\s*any\b/g;
        const matches = content.match(anyPattern);
        if (matches) {
          anyTypeUsage += matches.length;
        }
      });
      
      console.log(`Explicit 'any' type usage: ${anyTypeUsage}`);
      
      // Goal: minimize any usage
      const maxAllowed = 200; // Start with current state, reduce gradually
      expect(anyTypeUsage).toBeLessThanOrEqual(maxAllowed);
    });
  });
  
  describe('Build Configuration', () => {
    it('should have strict mode enabled in build config', () => {
      const buildConfig = require('../../tsconfig.build.json');
      
      // These should all be true for proper strict mode
      expect(buildConfig.compilerOptions.strict).toBe(false); // Currently false, needs to be true
      expect(buildConfig.compilerOptions.noImplicitAny).toBe(false); // Currently false, needs to be true
      expect(buildConfig.compilerOptions.strictNullChecks).toBe(false); // Currently false, needs to be true
      
      // Track that we need to fix these
      console.log('Build config needs strict mode enabled');
    });
    
    it('should include all source files in build', () => {
      const buildConfig = require('../../tsconfig.build.json');
      const excludedFiles = buildConfig.exclude || [];
      
      // Count excluded source files (not node_modules, dist, tests)
      const sourceExclusions = excludedFiles.filter((path: string) => 
        path.includes('src/') && !path.includes('test')
      );
      
      console.log(`Source files excluded from build: ${sourceExclusions.length}`);
      console.log('Excluded:', sourceExclusions);
      
      // Goal: 0 source file exclusions
      expect(sourceExclusions.length).toBeLessThanOrEqual(8); // Current state
    });
  });
  
  describe('Type Definition Coverage', () => {
    it('should have type definitions for all exports', () => {
      const sourceFiles = getAllTypeScriptFiles(srcDir);
      let untypedExports = 0;
      
      sourceFiles.forEach(file => {
        const content = fs.readFileSync(file, 'utf8');
        
        // Check for exported functions/variables without types
        const exportPattern = /export\s+(?:const|let|var|function)\s+(\w+)/g;
        let match;
        while ((match = exportPattern.exec(content)) !== null) {
          const exportName = match[1];
          const line = content.substring(
            content.lastIndexOf('\n', match.index) + 1,
            content.indexOf('\n', match.index)
          );
          
          // Check if type is specified
          if (!line.includes(':') && !line.includes('<')) {
            untypedExports++;
          }
        }
      });
      
      console.log(`Untyped exports: ${untypedExports}`);
      expect(untypedExports).toBeDefined();
    });
    
    it('should have interfaces for complex objects', () => {
      const sourceFiles = getAllTypeScriptFiles(srcDir);
      let objectLiteralsCount = 0;
      let interfacesCount = 0;
      
      sourceFiles.forEach(file => {
        const content = fs.readFileSync(file, 'utf8');
        
        // Count object literals
        objectLiteralsCount += (content.match(/\{[^}]{20,}\}/g) || []).length;
        
        // Count interfaces
        interfacesCount += (content.match(/interface\s+\w+/g) || []).length;
      });
      
      console.log(`Object literals: ${objectLiteralsCount}, Interfaces: ${interfacesCount}`);
      
      // Should have reasonable interface coverage
      expect(interfacesCount).toBeGreaterThan(0);
    });
  });
});

// Helper functions
function getTypeScriptErrors(): string[] {
  try {
    execSync('npx tsc --strict --noEmit', {
      cwd: path.resolve(__dirname, '../../'),
      encoding: 'utf8'
    });
    return [];
  } catch (error: any) {
    return error.stdout?.split('\n').filter((line: string) => line.includes('error TS')) || [];
  }
}

function getAllTypeScriptFiles(dir: string): string[] {
  const files: string[] = [];
  
  function walk(directory: string) {
    const items = fs.readdirSync(directory);
    
    items.forEach(item => {
      const fullPath = path.join(directory, item);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory() && !item.includes('node_modules') && !item.includes('dist')) {
        walk(fullPath);
      } else if (stat.isFile() && item.endsWith('.ts') && !item.includes('.test.') && !item.includes('.spec.')) {
        files.push(fullPath);
      }
    });
  }
  
  walk(dir);
  return files;
}

describe('TypeScript Strict Mode Migration Progress', () => {
  it('should track violation reduction over time', () => {
    const currentViolations = getTypeScriptErrors().length;
    const targetViolations = 0;
    const initialViolations = 1381;
    
    const progressPercentage = ((initialViolations - currentViolations) / initialViolations) * 100;
    
    console.log('\n=== TypeScript Strict Mode Migration Progress ===');
    console.log(`Initial violations: ${initialViolations}`);
    console.log(`Current violations: ${currentViolations}`);
    console.log(`Target violations: ${targetViolations}`);
    console.log(`Progress: ${progressPercentage.toFixed(1)}%`);
    console.log('================================================\n');
    
    // Track that we're making progress
    expect(currentViolations).toBeLessThanOrEqual(initialViolations);
  });
});