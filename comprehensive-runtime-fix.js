#!/usr/bin/env node
/**
 * Comprehensive Runtime Fix for CodeCrucible Synth v3.8.9
 * Fixes all remaining version inconsistencies and enables true autonomous behavior
 */

import fs from 'fs';
import path from 'path';

const globalPath = 'C:\\Users\\Admin\\AppData\\Roaming\\npm\\node_modules\\codecrucible-synth';

console.log('🔧 Comprehensive Runtime Fix for CodeCrucible Synth v3.8.9');
console.log('━'.repeat(60));

if (!fs.existsSync(globalPath)) {
    console.error('❌ Global installation not found at:', globalPath);
    process.exit(1);
}

console.log('✅ Found global installation at:', globalPath);

// Fix 1: Complete version consistency across ALL display locations
const versionFixes = [
    // Binary files
    {
        file: path.join(globalPath, 'dist/bin/crucible.js'),
        replacements: [
            { search: /v3\.8\.[0-9]/g, replace: 'v3.8.9' },
            { search: /CodeCrucible Synth v3\.8\.[0-9]/g, replace: 'CodeCrucible Synth v3.8.9' }
        ]
    },
    // Core CLI files  
    {
        file: path.join(globalPath, 'dist/core/cli.js'),
        replacements: [
            { search: /v3\.8\.[0-9]/g, replace: 'v3.8.9' },
            { search: /CodeCrucible Synth v3\.8\.[0-9]/g, replace: 'CodeCrucible Synth v3.8.9' }
        ]
    },
    // Interactive REPL
    {
        file: path.join(globalPath, 'dist/core/interactive-repl.js'),
        replacements: [
            { search: /v3\.8\.[0-9]/g, replace: 'v3.8.9' },
            { search: /CodeCrucible Synth v3\.8\.[0-9]/g, replace: 'CodeCrucible Synth v3.8.9' }
        ]
    }
];

console.log('🔄 Fixing ALL version inconsistencies...');
for (const fix of versionFixes) {
    try {
        if (fs.existsSync(fix.file)) {
            let content = fs.readFileSync(fix.file, 'utf8');
            let changed = false;
            
            for (const replacement of fix.replacements) {
                const originalContent = content;
                content = content.replace(replacement.search, replacement.replace);
                if (content !== originalContent) {
                    changed = true;
                }
            }
            
            if (changed) {
                fs.writeFileSync(fix.file, content);
                console.log(`  ✅ Updated versions in ${path.basename(fix.file)}`);
            }
        }
    } catch (error) {
        console.log(`  ⚠️ Could not fix ${fix.file}:`, error.message);
    }
}

// Fix 2: Enable true autonomous behavior in CLI
const cliPath = path.join(globalPath, 'dist/core/cli.js');
console.log('🔄 Enabling autonomous codebase analysis...');

try {
    if (fs.existsSync(cliPath)) {
        let content = fs.readFileSync(cliPath, 'utf8');
        
        // Enhanced system prompt injection for autonomous behavior
        const autonomousPromptCode = `
        // AUTONOMOUS MODE: Enhanced context awareness and file reading
        if (prompt.toLowerCase().includes('audit') || prompt.toLowerCase().includes('analyze')) {
            console.log('🔍 Autonomous Analysis Mode Activated');
            console.log('📂 Reading current directory structure...');
            
            try {
                const fs = await import('fs');
                const path = await import('path');
                const cwd = process.cwd();
                
                // Read key project files
                const projectFiles = ['package.json', 'tsconfig.json', 'README.md', 'src/index.ts', 'src/core/cli.ts'];
                let contextData = \`Current project directory: \${cwd}\\n\\n\`;
                
                for (const file of projectFiles) {
                    const filePath = path.join(cwd, file);
                    if (fs.existsSync(filePath)) {
                        try {
                            const content = fs.readFileSync(filePath, 'utf8');
                            contextData += \`--- \${file} ---\\n\${content.substring(0, 2000)}\\n\\n\`;
                        } catch (error) {
                            contextData += \`--- \${file} (ERROR) ---\\n Unable to read: \${error.message}\\n\\n\`;
                        }
                    }
                }
                
                // Enhance the prompt with project context
                prompt = \`AUTONOMOUS CODEBASE AUDIT REQUEST
                
You are an autonomous AI coding assistant with access to the current codebase. Please perform a comprehensive analysis of this project.

PROJECT CONTEXT:
\${contextData}

TASK: \${prompt}

Please provide a detailed analysis including:
1. Project overview and architecture
2. Code quality assessment  
3. Security considerations
4. Performance opportunities
5. Specific recommendations for improvement

Use your tools to read additional files as needed.\`;
                
                console.log('✅ Context enhanced with project data');
            } catch (error) {
                console.log('⚠️ Context enhancement failed:', error.message);
            }
        }`;
        
        // Find where prompt processing happens and inject autonomous behavior
        if (content.includes('async executePromptProcessing')) {
            const insertionPoint = content.indexOf('async executePromptProcessing(prompt, options = {}) {');
            if (insertionPoint !== -1) {
                const functionStart = content.indexOf('{', insertionPoint) + 1;
                content = content.substring(0, functionStart) + 
                         autonomousPromptCode + 
                         content.substring(functionStart);
                
                fs.writeFileSync(cliPath, content);
                console.log('  ✅ Enhanced CLI with autonomous behavior');
            }
        }
    }
} catch (error) {
    console.log('  ⚠️ Could not enable autonomous behavior:', error.message);
}

// Fix 3: Improve model configuration to use appropriate models
const modelConfigPath = path.join(globalPath, 'dist/core/model-management/auto-configurator.js');
console.log('🔄 Optimizing model configuration...');

try {
    if (fs.existsSync(modelConfigPath)) {
        let content = fs.readFileSync(modelConfigPath, 'utf8');
        
        // Force smaller, more appropriate models
        const optimizedConfig = `
        // OPTIMIZED: Force appropriate model selection for current hardware
        async autoConfigureDualAgent() {
            await this.modelDetector.scanAvailableModels();
            const availableModels = this.modelDetector.getAvailableModels();
            
            // Hardware-aware filtering - prefer smaller models
            const suitableModels = availableModels.filter(model => {
                const modelName = model.name.toLowerCase();
                // Prefer 3B and 7B models, avoid large models
                return (modelName.includes('3b') || modelName.includes('7b') || 
                        modelName.includes('qwen2.5-coder') || modelName.includes('llama3.2')) &&
                       !modelName.includes('32b') && !modelName.includes('27b') && !modelName.includes('20b');
            });
            
            if (suitableModels.length === 0) {
                throw new Error('No suitable models found for current hardware');
            }
            
            // Prioritize qwen2.5-coder models
            const qwenModels = suitableModels.filter(m => m.name.includes('qwen2.5-coder'));
            const writerModel = qwenModels.length > 0 ? qwenModels[0] : suitableModels[0];
            const auditorModel = suitableModels.find(m => m.name !== writerModel.name) || writerModel;
            
            return {
                writer: {
                    model: writerModel.name,
                    platform: 'ollama',
                    reasoning: \`Hardware-optimized: \${writerModel.name}\`
                },
                auditor: {
                    model: auditorModel.name,
                    platform: 'ollama',
                    reasoning: \`Secondary model: \${auditorModel.name}\`
                },
                confidence: 0.9
            };
        }`;
        
        // Replace the autoConfigureDualAgent function
        if (content.includes('async autoConfigureDualAgent()')) {
            content = content.replace(
                /async autoConfigureDualAgent\(\)[^}]+\{[^}]+\}/s,
                optimizedConfig
            );
            fs.writeFileSync(modelConfigPath, content);
            console.log('  ✅ Optimized model configuration');
        }
    }
} catch (error) {
    console.log('  ⚠️ Could not optimize model configuration:', error.message);
}

// Fix 4: Enhance the dual-agent system to work without try-catch issues
const dualAgentPath = path.join(globalPath, 'dist/core/collaboration/dual-agent-realtime-system.js');
console.log('🔄 Finalizing dual-agent system...');

try {
    if (fs.existsSync(dualAgentPath)) {
        let content = fs.readFileSync(dualAgentPath, 'utf8');
        
        // Ensure the fetch call is properly wrapped in try-catch
        if (content.includes('const response = await fetch(`${this.config.writer.endpoint}/api/generate`')) {
            content = content.replace(
                /const response = await fetch\(`\${this\.config\.writer\.endpoint}\/api\/generate`,/,
                `try {
                const response = await fetch(\`\${this.config.writer.endpoint}/api/generate\`,`
            );
            
            // Add the missing catch block
            const insertAfter = content.indexOf('return this.extractCodeFromResponse(data.response);');
            if (insertAfter !== -1) {
                const insertPoint = content.indexOf('}', insertAfter) + 1;
                content = content.substring(0, insertPoint) + 
                         `\n        } catch (fetchError) {
            this.logger.error('Ollama connection failed:', fetchError);
            throw new Error(\`Unable to connect to Ollama at \${this.config.writer.endpoint}. Please ensure Ollama is running and accessible.\`);
        }` + content.substring(insertPoint);
            }
            
            fs.writeFileSync(dualAgentPath, content);
            console.log('  ✅ Enhanced dual-agent connection handling');
        }
    }
} catch (error) {
    console.log('  ⚠️ Could not finalize dual-agent system:', error.message);
}

console.log('━'.repeat(60));
console.log('✅ Comprehensive runtime fix completed!');
console.log('');
console.log('🚀 CodeCrucible Synth should now:');
console.log('  • Show consistent v3.8.9 version everywhere');
console.log('  • Autonomously read and analyze codebases');
console.log('  • Use appropriate models for your hardware');
console.log('  • Handle connections robustly');
console.log('');
console.log('Please restart CodeCrucible Synth:');
console.log('   cc');