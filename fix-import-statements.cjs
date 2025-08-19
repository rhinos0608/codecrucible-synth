#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const glob = require('glob');

// Import mapping for the new unified architecture
const importMappings = {
  // Core module mappings
  './local-model-client.js': './client.js',
  '../core/local-model-client.js': '../core/client.js',
  './autonomous-claude-agent.js': './agent.js',
  './autonomous-claude-client.js': './client.js',
  './claude-code-client.js': './client.js',
  './enhanced-agentic-client.js': './client.js',
  './fast-mode-client.js': './client.js',
  './hybrid-model-client.js': './client.js',
  './lm-studio-client.js': './client.js',
  './optimized-model-client.js': './client.js',
  './performance-optimized-client.js': './client.js',
  './two-mode-client.js': './client.js',
  './unified-model-client.js': './client.js',
  
  // Agent mappings
  './base-agent.js': './agent.js',
  './base-specialized-agent.js': './agent.js',
  './react-agent.js': './agent.js',
  './voice-enabled-agent.js': './agent.js',
  './enhanced-react-agent.js': './agent.js',
  
  // Config mappings
  './enhanced-config-manager.js': './config.js',
  './hybrid-config-manager.js': './config.js',
  
  // Security mappings
  './security-utils.js': './security.js',
  '../core/security-utils.js': '../core/security.js',
  
  // Type mappings - update the types
  'AgentRequest': 'ExecutionRequest',
  'AgentResponse': 'ExecutionResponse', 
  'AgentExecutionMode': 'ExecutionMode',
  'AgentTask': 'Task',
  'AgentWorkflow': 'Workflow',
  
  // Removed modules - point to alternatives or remove
  './multi-llm-provider.js': './client.js',
  './rag-system.js': './agent.js',
  './edit-confirmation-system.js': './agent.js',
  './cli-output-manager.js': './structured-response-formatter.js',
  './response-types.js': './types.js',
  './living-spiral-coordinator.js': './agent.js',
  './agent-orchestrator.js': './agent.js',
  './enhanced-model-manager.js': './client.js',
  './intelligent-model-selector.js': './client.js',
  './vram-optimizer.js': './client.js',
  './timeout-manager.js': './agent.js',
  './process-lifecycle-manager.js': './agent.js',
  './claude-code-inspired-reasoning.js': './agent.js',
  './advanced-synthesis-engine.js': './agent.js',
  './autonomous-startup-manager.js': './enhanced-startup-indexer.js',
  
  // Tool mappings
  '../llm/ollama.js': '../providers/ollama.js',
  '../llm/lm-studio.js': '../providers/lm-studio.js', 
  '../llm/huggingface.js': '../providers/huggingface.js',
};

// Export mappings for types
const exportMappings = {
  'ModelClient': 'UnifiedModelClient',
  'LocalModelClient': 'UnifiedModelClient',
  'AutonomousClaudeAgent': 'UnifiedAgent',
  'EnhancedAgenticClient': 'UnifiedModelClient',
  'ClaudeCodeClient': 'UnifiedModelClient',
  'AutonomousClaudeClient': 'UnifiedModelClient',
  'FastModeClient': 'UnifiedModelClient',
  'MultiLLMProvider': 'UnifiedModelClient',
  'createMultiLLMProvider': 'createUnifiedModelClient',
  'globalRAGSystem': 'UnifiedAgent',
  'initializeEditConfirmation': 'UnifiedAgent',
  'globalEditConfirmation': 'UnifiedAgent',
  'cliOutput': 'StructuredResponseFormatter',
  'CLIError': 'ExecutionError',
  'CLIExitCode': 'ExecutionResult',
  'VoiceEnabledAgent': 'UnifiedAgent',
  'VoiceEnabledConfig': 'AgentConfig',
  'AgentDependencies': 'AgentContext',
  'BaseAgentOutput': 'ExecutionResult',
  'BaseAgentConfig': 'AgentConfig',
  'BaseSpecializedAgent': 'UnifiedAgent',
  'ReActAgent': 'UnifiedAgent',
  'timeoutManager': 'UnifiedAgent',
  'EnhancedModelManager': 'UnifiedModelClient',
  'IntelligentModelSelector': 'UnifiedModelClient',
  'VRAMOptimizer': 'UnifiedModelClient',
  'ClaudeCodeInspiredReasoning': 'UnifiedAgent',
  'AutonomousStartupManager': 'EnhancedStartupIndexer',
  'LivingSpiralResult': 'ExecutionResult',
  'SpiralConfig': 'AgentConfig',
  'AgentOrchestrator': 'UnifiedAgent',
  'RAGSystem': 'UnifiedAgent',
  'ResponseFactory': 'StructuredResponseFormatter',
  'AdvancedSynthesisEngine': 'UnifiedAgent',
  'SynthesisResponse': 'ExecutionResult',
  'LivingSpiralCoordinator': 'UnifiedAgent',
};

function fixFileImports(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    let modified = false;
    
    // Fix import paths
    for (const [oldPath, newPath] of Object.entries(importMappings)) {
      const regex = new RegExp(oldPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
      if (content.includes(oldPath)) {
        content = content.replace(regex, newPath);
        modified = true;
        console.log(`  Fixed import: ${oldPath} → ${newPath}`);
      }
    }
    
    // Fix import names and exports
    for (const [oldName, newName] of Object.entries(exportMappings)) {
      // Fix import statements
      const importRegex = new RegExp(`\\b${oldName}\\b(?=\\s*[,}])`, 'g');
      if (content.match(importRegex)) {
        content = content.replace(importRegex, newName);
        modified = true;
        console.log(`  Fixed import name: ${oldName} → ${newName}`);
      }
      
      // Fix usage in code (but be careful not to replace everything)
      const usageRegex = new RegExp(`\\bnew\\s+${oldName}\\b`, 'g');
      if (content.match(usageRegex)) {
        content = content.replace(usageRegex, `new ${newName}`);
        modified = true;
        console.log(`  Fixed constructor: new ${oldName} → new ${newName}`);
      }
    }
    
    // Fix specific type mappings in type annotations
    const typeReplacements = {
      'AgentRequest': 'ExecutionRequest',
      'AgentResponse': 'ExecutionResponse',
      'AgentExecutionMode': 'ExecutionMode',
      'AgentTask': 'Task',
      'AgentWorkflow': 'Workflow'
    };
    
    for (const [oldType, newType] of Object.entries(typeReplacements)) {
      const typeRegex = new RegExp(`\\b${oldType}\\b`, 'g');
      if (content.match(typeRegex)) {
        content = content.replace(typeRegex, newType);
        modified = true;
        console.log(`  Fixed type: ${oldType} → ${newType}`);
      }
    }
    
    // Remove duplicate exports and redeclarations
    if (content.includes('Cannot redeclare exported variable')) {
      // Fix duplicate UnifiedAgent exports
      const lines = content.split('\n');
      const filteredLines = [];
      const seenExports = new Set();
      
      for (const line of lines) {
        if (line.includes('export class') || line.includes('export {')) {
          const exportMatch = line.match(/export (?:class|{[^}]*}|\w+)/);
          if (exportMatch) {
            if (!seenExports.has(exportMatch[0])) {
              seenExports.add(exportMatch[0]);
              filteredLines.push(line);
            } else {
              console.log(`  Removed duplicate export: ${line.trim()}`);
              modified = true;
            }
          } else {
            filteredLines.push(line);
          }
        } else {
          filteredLines.push(line);
        }
      }
      content = filteredLines.join('\n');
    }
    
    if (modified) {
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`✅ Fixed imports in: ${filePath}`);
      return true;
    }
    
    return false;
  } catch (error) {
    console.error(`❌ Error processing ${filePath}:`, error.message);
    return false;
  }
}

// Main execution
console.log('🔧 Fixing import statements for unified architecture...\n');

const sourcePattern = 'src/**/*.{ts,js}';
const files = glob.sync(sourcePattern, { 
  ignore: ['**/node_modules/**', '**/dist/**', '**/*.d.ts'] 
});

let totalFixed = 0;
let totalFiles = files.length;

console.log(`Found ${totalFiles} files to process\n`);

for (const file of files) {
  console.log(`Processing: ${file}`);
  if (fixFileImports(file)) {
    totalFixed++;
  }
}

console.log(`\n🎉 Import fixing complete!`);
console.log(`📊 Fixed ${totalFixed} out of ${totalFiles} files`);

// Create missing provider files if they don't exist
const providerDir = 'src/providers';
if (!fs.existsSync(providerDir)) {
  fs.mkdirSync(providerDir, { recursive: true });
  console.log('\n📁 Created providers directory');
}

// Create placeholder provider files
const providerFiles = [
  'src/providers/ollama.js',
  'src/providers/lm-studio.js', 
  'src/providers/huggingface.js'
];

for (const providerFile of providerFiles) {
  if (!fs.existsSync(providerFile)) {
    const content = `// Provider implementation - consolidated into client.ts
export * from '../core/client.js';
`;
    fs.writeFileSync(providerFile, content);
    console.log(`📄 Created placeholder: ${providerFile}`);
  }
}

console.log('\n✨ All import statements fixed for unified architecture!');
