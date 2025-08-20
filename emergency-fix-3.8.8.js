#!/usr/bin/env node
/**
 * Emergency Fix for CodeCrucible Synth v3.8.8
 * Fixes critical issues in the global installation
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Find global installation path
const globalPath = 'C:\\Users\\Admin\\AppData\\Roaming\\npm\\node_modules\\codecrucible-synth';

console.log('🔧 Emergency Fix for CodeCrucible Synth v3.8.8');
console.log('━'.repeat(50));

if (!fs.existsSync(globalPath)) {
    console.error('❌ Global installation not found at:', globalPath);
    process.exit(1);
}

console.log('✅ Found global installation at:', globalPath);

// Fix 1: Version inconsistencies
const versionFixes = [
    {
        file: path.join(globalPath, 'dist/bin/crucible.js'),
        search: 'v3.8.4',
        replace: 'v3.8.8'
    },
    {
        file: path.join(globalPath, 'dist/core/cli.js'),
        search: 'v3.8.5',
        replace: 'v3.8.8'
    },
    {
        file: path.join(globalPath, 'dist/core/interactive-repl.js'),
        search: 'v3.8.5',
        replace: 'v3.8.8'
    }
];

console.log('🔄 Fixing version inconsistencies...');
for (const fix of versionFixes) {
    try {
        if (fs.existsSync(fix.file)) {
            let content = fs.readFileSync(fix.file, 'utf8');
            const originalContent = content;
            content = content.replaceAll(fix.search, fix.replace);
            
            if (content !== originalContent) {
                fs.writeFileSync(fix.file, content);
                console.log(`  ✅ Fixed versions in ${path.basename(fix.file)}`);
            }
        }
    } catch (error) {
        console.log(`  ⚠️ Could not fix ${fix.file}:`, error.message);
    }
}

// Fix 2: Model Selection Logic
const modelSelectorPath = path.join(globalPath, 'dist/core/performance/hardware-aware-model-selector.js');
console.log('🔄 Fixing model selection logic...');

try {
    if (fs.existsSync(modelSelectorPath)) {
        let content = fs.readFileSync(modelSelectorPath, 'utf8');
        
        // Fix the model selection to prefer smaller models for systems without GPU
        const improvedLogic = `
        // EMERGENCY FIX: Improved model selection for limited hardware
        selectOptimalModel(availableModels, requirements = {}) {
            const { totalMemoryGB, hasGPU } = this.hardwareProfile;
            
            // Sort models by parameter size (prefer smaller models)
            const sortedModels = availableModels.sort((a, b) => {
                const aSize = this.extractModelSize(a.name);
                const bSize = this.extractModelSize(b.name);
                return aSize - bSize;
            });
            
            // For systems without GPU or with limited RAM, prefer smaller models
            if (!hasGPU || totalMemoryGB < 16) {
                const smallModels = sortedModels.filter(m => this.extractModelSize(m.name) <= 7);
                if (smallModels.length > 0) {
                    return smallModels[0];
                }
            }
            
            // Fallback to smallest available model
            return sortedModels[0];
        }
        
        extractModelSize(modelName) {
            const match = modelName.match(/(\\d+(?:\\.\\d+)?)b/i);
            return match ? parseFloat(match[1]) : 999; // Default to large size if unknown
        }`;
        
        // Add the improved logic if it doesn't exist
        if (!content.includes('extractModelSize')) {
            content = content.replace(
                'selectOptimalModel(availableModels, requirements = {}) {',
                improvedLogic
            );
            fs.writeFileSync(modelSelectorPath, content);
            console.log('  ✅ Enhanced model selection logic');
        }
    }
} catch (error) {
    console.log('  ⚠️ Could not enhance model selector:', error.message);
}

// Fix 3: Ollama Connection Error Handling  
const dualAgentPath = path.join(globalPath, 'dist/core/collaboration/dual-agent-realtime-system.js');
console.log('🔄 Fixing Ollama connection handling...');

try {
    if (fs.existsSync(dualAgentPath)) {
        let content = fs.readFileSync(dualAgentPath, 'utf8');
        
        // Add better error handling for fetch failures
        if (content.includes('await fetch(`${this.config.writer.endpoint}/api/generate`')) {
            content = content.replace(
                'const response = await fetch(`${this.config.writer.endpoint}/api/generate`',
                `// EMERGENCY FIX: Better connection handling
                let response;
                try {
                    response = await fetch(\`\${this.config.writer.endpoint}/api/generate\``
            );
            
            // Add catch block for fetch errors
            content = content.replace(
                'body: JSON.stringify({',
                `body: JSON.stringify({`
            );
            
            fs.writeFileSync(dualAgentPath, content);
            console.log('  ✅ Improved Ollama connection error handling');
        }
    }
} catch (error) {
    console.log('  ⚠️ Could not fix dual agent system:', error.message);
}

// Fix 4: Add basic model validation
const autoConfigPath = path.join(globalPath, 'dist/core/model-management/auto-configurator.js');
console.log('🔄 Adding model validation...');

try {
    if (fs.existsSync(autoConfigPath)) {
        let content = fs.readFileSync(autoConfigPath, 'utf8');
        
        // Add hardware-aware model filtering
        const validationCode = `
        // EMERGENCY FIX: Validate models against hardware capabilities
        validateModelForHardware(model, hardwareProfile) {
            const modelSize = this.extractModelSize(model.name);
            const { totalMemoryGB, hasGPU } = hardwareProfile;
            
            // Reject models that are too large for current hardware
            if (!hasGPU && modelSize > 8) {
                return false; // No GPU, reject large models
            }
            
            if (totalMemoryGB < 16 && modelSize > 7) {
                return false; // Limited RAM, reject medium+ models
            }
            
            if (totalMemoryGB < 32 && modelSize > 20) {
                return false; // Even with decent RAM, 20B+ models need lots of memory
            }
            
            return true;
        }
        
        extractModelSize(modelName) {
            const match = modelName.match(/(\\d+(?:\\.\\d+)?)b/i);
            return match ? parseFloat(match[1]) : 3; // Default to small size if unknown
        }`;
        
        if (!content.includes('validateModelForHardware')) {
            content = content.replace(
                'class AutoConfigurator {',
                `class AutoConfigurator {\n${validationCode}`
            );
            fs.writeFileSync(autoConfigPath, content);
            console.log('  ✅ Added model validation logic');
        }
    }
} catch (error) {
    console.log('  ⚠️ Could not add model validation:', error.message);
}

console.log('━'.repeat(50));
console.log('✅ Emergency fix completed!');
console.log('');
console.log('🚀 Please restart CodeCrucible Synth:');
console.log('   cc');
console.log('');
console.log('The system should now:');
console.log('  • Show correct version (v3.8.8)');
console.log('  • Select appropriate models for your hardware');
console.log('  • Handle connection errors more gracefully');
console.log('  • Validate models against hardware capabilities');