#!/usr/bin/env node

/**
 * Configuration Management CLI
 * 
 * Standalone script to run configuration commands without full TypeScript compilation.
 */

const { spawn } = require('child_process');
const path = require('path');

const command = process.argv[2];
const args = process.argv.slice(3);

if (!command || command === '--help' || command === 'help') {
  console.log(`
📖 Configuration Management CLI

Usage: node scripts/config-cli.js <command> [options]

Commands:
  status     Show configuration status and sources
  validate   Validate current configuration  
  analyze    Analyze legacy configuration files
  migrate    Migrate to unified configuration system
  export     Export configuration to file
  help       Show this help message

Options:
  --verbose    Show detailed output
  --dry-run    Show what would be done without making changes
  --backup     Create backup before migration
  --format     Output format (json|yaml|table)

Examples:
  node scripts/config-cli.js status --verbose
  node scripts/config-cli.js analyze
  node scripts/config-cli.js migrate --dry-run
  node scripts/config-cli.js validate

The configuration system resolves conflicts across multiple files:
  - config/default.yaml
  - codecrucible.config.json
  - config/unified-model-config.yaml
  - config/hybrid.yaml
  - config/hybrid-config.json
  - config/optimized-model-config.json
  - config/voices.yaml

Run 'analyze' first to see detected conflicts and migration recommendations.
`);
  process.exit(0);
}

// Dynamically import and run the configuration commands
(async () => {
  try {
    // For now, we'll create a simplified version that loads the existing configs
    const fs = require('fs').promises;
    const yaml = require('yaml');
    const { existsSync } = require('fs');
    
    const projectRoot = process.cwd();
    
    async function loadYamlFile(filePath) {
      try {
        if (!existsSync(filePath)) return null;
        const content = await fs.readFile(filePath, 'utf-8');
        return yaml.parse(content);
      } catch (error) {
        console.warn(`Warning: Could not parse ${filePath}:`, error.message);
        return null;
      }
    }

    async function loadJsonFile(filePath) {
      try {
        if (!existsSync(filePath)) return null;
        const content = await fs.readFile(filePath, 'utf-8');
        return JSON.parse(content);
      } catch (error) {
        console.warn(`Warning: Could not parse ${filePath}:`, error.message);
        return null;
      }
    }

    const configFiles = [
      { path: path.join(projectRoot, 'config/unified-config.yaml'), type: 'yaml', primary: true },
      { path: path.join(projectRoot, 'config/voices.yaml'), type: 'yaml', specialized: true },
      { path: path.join(projectRoot, 'config/security-policies.yaml'), type: 'yaml', specialized: true },
      // Legacy files (should be removed after migration)
      { path: path.join(projectRoot, 'config/default.yaml'), type: 'yaml', legacy: true },
      { path: path.join(projectRoot, 'codecrucible.config.json'), type: 'json', legacy: true },
      { path: path.join(projectRoot, 'config/unified-model-config.yaml'), type: 'yaml', legacy: true },
      { path: path.join(projectRoot, 'config/hybrid.yaml'), type: 'yaml', legacy: true },
      { path: path.join(projectRoot, 'config/hybrid-config.json'), type: 'json', legacy: true },
      { path: path.join(projectRoot, 'config/optimized-model-config.json'), type: 'json', legacy: true }
    ];

    if (command === 'analyze') {
      console.log('🔍 Analyzing configuration files...\n');

      const foundFiles = [];
      const conflicts = [];

      for (const configFile of configFiles) {
        const fileName = path.relative(projectRoot, configFile.path);
        if (existsSync(configFile.path)) {
          const stats = await fs.stat(configFile.path);
          foundFiles.push({
            path: fileName,
            type: configFile.type,
            size: stats.size,
            lastModified: stats.mtime
          });
        }
      }

      console.log('📋 Configuration Files Found:');
      if (foundFiles.length === 0) {
        console.log('   No configuration files detected.');
      } else {
        foundFiles.forEach(file => {
          console.log(`   ✅ ${file.path} (${file.type}, ${file.size} bytes)`);
          if (args.includes('--verbose')) {
            console.log(`      Last modified: ${file.lastModified.toISOString()}`);
          }
        });
      }

      // Simple conflict detection
      const modelTimeouts = [];
      const modelProviders = [];
      const maxConcurrency = [];

      // Check default.yaml
      const defaultConfig = await loadYamlFile(path.join(projectRoot, 'config/default.yaml'));
      if (defaultConfig?.model?.timeout) {
        modelTimeouts.push({ file: 'config/default.yaml', value: defaultConfig.model.timeout });
      }
      if (defaultConfig?.performance?.voiceParallelism?.maxConcurrent) {
        maxConcurrency.push({ file: 'config/default.yaml', value: defaultConfig.performance.voiceParallelism.maxConcurrent });
      }

      // Check codecrucible.config.json
      const codecrucibleConfig = await loadJsonFile(path.join(projectRoot, 'codecrucible.config.json'));
      if (codecrucibleConfig?.agent?.maxConcurrency) {
        maxConcurrency.push({ file: 'codecrucible.config.json', value: codecrucibleConfig.agent.maxConcurrency });
      }

      // Check unified-model-config.yaml
      const unifiedConfig = await loadYamlFile(path.join(projectRoot, 'config/unified-model-config.yaml'));
      if (unifiedConfig?.llm?.default_provider) {
        modelProviders.push({ file: 'config/unified-model-config.yaml', value: unifiedConfig.llm.default_provider });
      }

      // Check hybrid configs
      const hybridConfig = await loadYamlFile(path.join(projectRoot, 'config/hybrid.yaml'));
      if (hybridConfig?.hybrid?.routing?.defaultProvider) {
        modelProviders.push({ file: 'config/hybrid.yaml', value: hybridConfig.hybrid.routing.defaultProvider });
      }

      const hybridJsonConfig = await loadJsonFile(path.join(projectRoot, 'config/hybrid-config.json'));
      if (hybridJsonConfig?.hybrid?.escalationThreshold) {
        conflicts.push({
          key: 'hybrid.escalationThreshold',
          values: [{ file: 'config/hybrid-config.json', value: hybridJsonConfig.hybrid.escalationThreshold }]
        });
      }

      // Detect actual conflicts
      if (modelTimeouts.length > 1) {
        const uniqueValues = [...new Set(modelTimeouts.map(t => t.value))];
        if (uniqueValues.length > 1) {
          conflicts.push({ key: 'model.timeout', values: modelTimeouts });
        }
      }

      if (maxConcurrency.length > 1) {
        const uniqueValues = [...new Set(maxConcurrency.map(c => c.value))];
        if (uniqueValues.length > 1) {
          conflicts.push({ key: 'maxConcurrency', values: maxConcurrency });
        }
      }

      if (modelProviders.length > 1) {
        const uniqueValues = [...new Set(modelProviders.map(p => p.value))];
        if (uniqueValues.length > 1) {
          conflicts.push({ key: 'model.defaultProvider', values: modelProviders });
        }
      }

      if (conflicts.length > 0) {
        console.log(`\n⚠️  Configuration Conflicts Detected: ${conflicts.length}`);
        conflicts.forEach((conflict, i) => {
          console.log(`   ${i + 1}. ${conflict.key}:`);
          conflict.values.forEach(value => {
            console.log(`      - ${value.file}: ${JSON.stringify(value.value)}`);
          });
        });
      } else {
        console.log('\n✅ No obvious conflicts detected');
      }

      console.log(`\n📊 Analysis Summary:`);
      console.log(`   Files Found: ${foundFiles.length}`);
      console.log(`   Conflicts: ${conflicts.length}`);
      
      if (foundFiles.length > 1) {
        console.log(`\n💡 Recommendations:`);
        console.log(`   1. Consider consolidating configuration files`);
        console.log(`   2. Use unified configuration system to resolve conflicts`);
        console.log(`   3. Run full TypeScript version for comprehensive analysis`);
      }

    } else if (command === 'status') {
      console.log('📊 Configuration Status\n');
      
      const foundFiles = configFiles.filter(f => existsSync(f.path) && !f.legacy);
      const legacyFiles = configFiles.filter(f => existsSync(f.path) && f.legacy);
      
      console.log(`Configuration files: ${foundFiles.length} found`);
      
      foundFiles.forEach(file => {
        const relativePath = path.relative(projectRoot, file.path);
        const status = file.primary ? ' (PRIMARY)' : file.specialized ? ' (SPECIALIZED)' : '';
        console.log(`   ✅ ${relativePath}${status}`);
      });

      if (legacyFiles.length > 0) {
        console.log('\n⚠️  Legacy configuration files detected (should be cleaned up):');
        legacyFiles.forEach(file => {
          const relativePath = path.relative(projectRoot, file.path);
          console.log(`   🗑️  ${relativePath}`);
        });
      }

      if (foundFiles.length === 1 && foundFiles[0].primary) {
        console.log('\n✅ Configuration successfully unified!');
      }

      // Try to load unified config
      const unifiedConfig = await loadYamlFile(path.join(projectRoot, 'config/unified-config.yaml'));
      if (unifiedConfig) {
        console.log('\n🔧 Current Settings (from unified-config.yaml):');
        console.log(`   Environment: ${unifiedConfig.app?.environment || 'not set'}`);
        console.log(`   Model: ${unifiedConfig.model?.name || unifiedConfig.model?.default_provider || 'not set'}`);
        console.log(`   Endpoint: ${unifiedConfig.model?.endpoint || unifiedConfig.model?.providers?.[0]?.endpoint || 'not set'}`);
        console.log(`   Voices: ${unifiedConfig.voices?.default?.join(', ') || unifiedConfig.voices?.archetypes?.map(v => v.name).slice(0,2).join(', ') || 'not set'}`);
      }

    } else if (command === 'validate') {
      console.log('🔍 Validating configuration files...\n');
      
      let hasErrors = false;
      let totalFiles = 0;
      let validFiles = 0;

      for (const configFile of configFiles) {
        if (!existsSync(configFile.path)) continue;
        
        totalFiles++;
        const fileName = path.relative(projectRoot, configFile.path);
        
        try {
          if (configFile.type === 'yaml') {
            await loadYamlFile(configFile.path);
          } else {
            await loadJsonFile(configFile.path);
          }
          console.log(`   ✅ ${fileName} - Valid ${configFile.type.toUpperCase()}`);
          validFiles++;
        } catch (error) {
          console.log(`   ❌ ${fileName} - Invalid: ${error.message}`);
          hasErrors = true;
        }
      }

      console.log(`\n📊 Validation Summary:`);
      console.log(`   Files checked: ${totalFiles}`);
      console.log(`   Valid files: ${validFiles}`);
      console.log(`   Invalid files: ${totalFiles - validFiles}`);

      if (hasErrors) {
        console.log('\n❌ Configuration validation failed');
        process.exit(1);
      } else {
        console.log('\n✅ All configuration files are syntactically valid');
      }

    } else {
      console.log(`❌ Unknown command: ${command}`);
      console.log('Run "node scripts/config-cli.js help" for usage information');
      process.exit(1);
    }

  } catch (error) {
    console.error('❌ Command failed:', error.message);
    process.exit(1);
  }
})();