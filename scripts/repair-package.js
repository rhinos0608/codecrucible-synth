#!/usr/bin/env node

/**
 * Package.json Validation and Repair Script
 * Fixes common issues that prevent npm install from working
 */

import fs from 'fs/promises';
import path from 'path';

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function validateAndRepairPackageJson() {
  try {
    log('🔍 Validating package.json...', 'blue');
    
    // Read package.json
    const packagePath = path.join(process.cwd(), 'package.json');
    const packageContent = await fs.readFile(packagePath, 'utf-8');
    const packageJson = JSON.parse(packageContent);
    
    let changes = [];
    let hasChanges = false;
    
    // Check for circular dependency
    if (packageJson.dependencies && packageJson.dependencies['codecrucible-synth']) {
      log('❌ Found circular dependency on self', 'red');
      delete packageJson.dependencies['codecrucible-synth'];
      changes.push('Removed circular dependency');
      hasChanges = true;
    }
    
    // Ensure required scripts exist
    const requiredScripts = {
      'build': 'tsc && npm run copy-assets',
      'test': 'jest',
      'lint': 'eslint src/**/*.ts',
      'dev': 'tsx src/index.ts',
      'start': 'node dist/index.js',
      'clean': 'rm -rf dist coverage .nyc_output',
      'copy-assets': 'node scripts/copy-assets.js'
    };
    
    if (!packageJson.scripts) {
      packageJson.scripts = {};
      hasChanges = true;
    }
    
    for (const [script, command] of Object.entries(requiredScripts)) {
      if (!packageJson.scripts[script]) {
        packageJson.scripts[script] = command;
        changes.push(`Added missing script: ${script}`);
        hasChanges = true;
      }
    }
    
    // Fix test script to use local jest
    if (packageJson.scripts.test && packageJson.scripts.test.includes('node node_modules/jest/bin/jest.js')) {
      packageJson.scripts.test = 'jest';
      changes.push('Fixed test script to use local jest');
      hasChanges = true;
    }
    
    // Ensure engines field exists
    if (!packageJson.engines) {
      packageJson.engines = { node: '>=18.0.0' };
      changes.push('Added engines field');
      hasChanges = true;
    }
    
    // Check for problematic dependencies
    const problematicDeps = [
      'codecrucible-synth' // Circular dependency
    ];
    
    for (const dep of problematicDeps) {
      if (packageJson.dependencies && packageJson.dependencies[dep]) {
        delete packageJson.dependencies[dep];
        changes.push(`Removed problematic dependency: ${dep}`);
        hasChanges = true;
      }
    }
    
    // Ensure proper module configuration
    if (packageJson.type !== 'module') {
      log('⚠️  Type is not set to module, but this is likely intentional', 'yellow');
    }
    
    // Write changes if any
    if (hasChanges) {
      await fs.writeFile(packagePath, JSON.stringify(packageJson, null, 2));
      log('✅ package.json repaired successfully!', 'green');
      log('📝 Changes made:', 'blue');
      changes.forEach(change => log(`   • ${change}`, 'green'));
    } else {
      log('✅ package.json is already valid!', 'green');
    }
    
    // Validate JSON syntax
    JSON.parse(JSON.stringify(packageJson));
    log('✅ JSON syntax is valid', 'green');
    
    // Check for required files
    const requiredFiles = [
      'tsconfig.json',
      'jest.config.cjs',
      'src/index.ts',
      'bin/crucible.js'
    ];
    
    log('🔍 Checking required files...', 'blue');
    for (const file of requiredFiles) {
      try {
        await fs.access(file);
        log(`✅ ${file} exists`, 'green');
      } catch {
        log(`❌ ${file} missing`, 'red');
      }
    }
    
    return { success: true, changes, hasChanges };
    
  } catch (error) {
    log(`❌ Failed to validate package.json: ${error.message}`, 'red');
    return { success: false, error: error.message };
  }
}

async function main() {
  log('🚀 CodeCrucible Synth - Package Repair Tool', 'blue');
  log('================================', 'blue');
  
  const result = await validateAndRepairPackageJson();
  
  if (result.success) {
    log('✅ Package validation completed!', 'green');
    
    if (result.hasChanges) {
      log('', 'reset');
      log('🔄 Next steps:', 'yellow');
      log('   1. rm -rf node_modules package-lock.json', 'yellow');
      log('   2. npm cache clean --force', 'yellow');
      log('   3. npm install', 'yellow');
      log('   4. npm run build', 'yellow');
      log('   5. npm test', 'yellow');
    }
  } else {
    log('❌ Package validation failed!', 'red');
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { validateAndRepairPackageJson };
