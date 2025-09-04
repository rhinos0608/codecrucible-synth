#!/usr/bin/env node

// Test script to diagnose evidence collection issue
// This directly tests the workflow execution with detailed logging

import { spawn } from 'child_process';
import path from 'path';

const testCommand = ['node', path.join(process.cwd(), 'dist/index.js'), 'read package.json'];

console.log('🔍 TESTING EVIDENCE COLLECTION WITH COMMAND:', testCommand.join(' '));
console.log('📍 Working directory:', process.cwd());
console.log('⏰ Starting test at:', new Date().toISOString());

const child = spawn(testCommand[0], testCommand.slice(1), {
  stdio: 'inherit',
  cwd: process.cwd(),
  env: {
    ...process.env,
    DEBUG: 'codecrucible:*',
    NODE_ENV: 'development',
  },
});

child.on('error', error => {
  console.error('❌ SPAWN ERROR:', error);
});

child.on('close', code => {
  console.log(`\n🏁 PROCESS EXITED WITH CODE: ${code}`);
  console.log('⏰ Finished at:', new Date().toISOString());
});
