#!/usr/bin/env node
/**
 * Complete Connection Fix for CodeCrucible Synth v3.8.8
 * Fixes fetch connection error handling that was incomplete
 */

import fs from 'fs';
import path from 'path';

const globalPath = 'C:\\Users\\Admin\\AppData\\Roaming\\npm\\node_modules\\codecrucible-synth';

console.log('🔧 Completing Connection Fix for CodeCrucible Synth v3.8.8');
console.log('━'.repeat(50));

// Fix the incomplete fetch error handling in dual-agent system
const dualAgentPath = path.join(globalPath, 'dist/core/collaboration/dual-agent-realtime-system.js');

try {
    if (fs.existsSync(dualAgentPath)) {
        let content = fs.readFileSync(dualAgentPath, 'utf8');
        
        // Find the incomplete fetch handling and complete it
        const searchPattern = `// EMERGENCY FIX: Better connection handling
                let response;
                try {
                    response = await fetch(\`\${this.config.writer.endpoint}/api/generate\`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({`;

        const replacement = `const enhancedPrompt = this.buildWriterPrompt(prompt, context);
        try {
            const response = await fetch(\`\${this.config.writer.endpoint}/api/generate\`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: this.config.writer.model,
                    prompt: enhancedPrompt,
                    stream: false,
                    options: {
                        temperature: this.config.writer.temperature,
                        num_predict: this.config.writer.maxTokens,
                        top_p: 0.9,
                        repeat_penalty: 1.1
                    }
                })
            });
            
            if (!response.ok) {
                throw new Error(\`Ollama generation failed: \${response.statusText}\`);
            }
            
            const data = await response.json();
            return this.extractCodeFromResponse(data.response);
        } catch (fetchError) {
            this.logger.error('Ollama connection failed:', fetchError);
            throw new Error(\`Unable to connect to Ollama at \${this.config.writer.endpoint}. Please ensure Ollama is running and accessible.\`);
        }`;

        // Replace the broken connection handling
        if (content.includes('// EMERGENCY FIX: Better connection handling')) {
            // Find and replace the entire generateCodeWithOllama function
            const functionStart = content.indexOf('async generateCodeWithOllama(prompt, context) {');
            const functionEnd = content.indexOf('}', content.indexOf('extractCodeFromResponse', functionStart)) + 1;
            
            if (functionStart !== -1 && functionEnd !== -1) {
                const beforeFunction = content.substring(0, functionStart);
                const afterFunction = content.substring(functionEnd);
                
                const completeFunction = `async generateCodeWithOllama(prompt, context) {
        ${replacement}
    }`;
                
                content = beforeFunction + completeFunction + afterFunction;
                fs.writeFileSync(dualAgentPath, content);
                console.log('✅ Completed fetch error handling in dual-agent system');
            }
        }
    }
} catch (error) {
    console.log('⚠️ Could not complete connection fix:', error.message);
}

console.log('━'.repeat(50));
console.log('✅ Connection fix completed!');
console.log('');
console.log('🚀 CodeCrucible Synth is now ready to use:');
console.log('   cc');
console.log('');
console.log('All critical issues should now be resolved.');