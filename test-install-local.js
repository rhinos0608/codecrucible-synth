#!/usr/bin/env node

/**
 * Local installation test script for CodeCrucible Synth
 * This allows testing the package locally before publishing to npm
 */

import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🧪 Testing CodeCrucible Synth Local Installation\n');

async function testLocalInstall() {
  const packageRoot = __dirname;
  const distPath = path.join(packageRoot, 'dist');
  const entryPoint = path.join(packageRoot, 'bin', 'crucible.js');
  
  // Check if built
  if (!fs.existsSync(distPath)) {
    console.log('❌ dist/ folder not found. Building...\n');
    
    const buildProcess = spawn('npm', ['run', 'build'], {
      cwd: packageRoot,
      stdio: 'inherit',
      shell: true
    });
    
    await new Promise((resolve, reject) => {
      buildProcess.on('close', (code) => {
        if (code === 0) resolve();
        else reject(new Error(`Build failed with code ${code}`));
      });
    });
  }
  
  console.log('✅ Build complete\n');
  
  // Test CLI entry point
  console.log('🧪 Testing CLI entry point...\n');
  
  const testProcess = spawn('node', [entryPoint, '--help'], {
    cwd: packageRoot,
    stdio: 'inherit',
    shell: true
  });
  
  await new Promise((resolve) => {
    testProcess.on('close', resolve);
  });
  
  console.log('\n✅ Local installation test complete!\n');
  console.log('🚀 To publish to npm:');
  console.log('   1. npm login');
  console.log('   2. npm publish --access public');
  console.log('   3. Then users can: npm install -g codecrucible-synth\n');
}

testLocalInstall().catch(console.error);