#!/usr/bin/env node

import fs from 'fs-extra';
import path from 'path';

async function copyAssets() {
  try {
    console.log('📦 Copying assets...');

    // Ensure dist directory exists
    await fs.ensureDir('dist');

    // Copy configuration files
    if (await fs.pathExists('config')) {
      await fs.copy('config', 'dist/config');
      console.log('✅ Copied config/');
    }

    // Copy bin files
    if (await fs.pathExists('bin')) {
      await fs.copy('bin', 'dist/bin');
      console.log('✅ Copied bin/');
    }

    // Make bin files executable on Unix systems
    if (process.platform !== 'win32') {
      const binPath = 'dist/bin/cc.js';
      if (await fs.pathExists(binPath)) {
        await fs.chmod(binPath, '755');
        console.log('✅ Made bin/cc.js executable');
      }
    }

    console.log('🎉 Assets copied successfully!');

  } catch (error) {
    console.error('❌ Failed to copy assets:', error);
    process.exit(1);
  }
}

copyAssets();