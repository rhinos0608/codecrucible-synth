const fs = require('fs');

console.log('🔧 Running Secondary TypeScript Fixes...');

// Fix 1: Update types.ts with missing interfaces
const typesAdditions = `
// Additional types for agent system
export interface ExecutionMode {
  type: 'auto' | 'fast' | 'quality';
  timeout?: number;
}

// Update Workflow interface
export interface WorkflowExtended extends Workflow {
  status?: 'pending' | 'running' | 'completed' | 'failed';
}

// Update ExecutionResponse interface  
export interface ExecutionResponseExtended extends ExecutionResponse {
  results?: any;
  error?: string;
}

// Update Task interface
export interface TaskExtended extends Task {
  priority?: 'low' | 'medium' | 'high';
}

// Export for compatibility
export const ExecutionMode = {} as any;

// Model client compatibility
export interface ModelClient {
  generate(request: any): Promise<any>;
  checkStatus(): Promise<boolean>;
}
`;

// Read existing types.ts and append missing types
const existingTypes = fs.readFileSync('src/core/types.ts', 'utf-8');
const updatedTypes = existingTypes + '\n' + typesAdditions;
fs.writeFileSync('src/core/types.ts', updatedTypes);
console.log('✅ Updated types.ts with missing interfaces');

// Fix 2: Update config-manager.ts to properly import SecurityUtils
const configManagerPath = 'src/config/config-manager.ts';
if (fs.existsSync(configManagerPath)) {
  let configContent = fs.readFileSync(configManagerPath, 'utf-8');
  
  // Fix SecurityUtils import
  if (!configContent.includes('import { SecurityUtils }')) {
    configContent = `import { SecurityUtils } from '../core/security-utils';\n` + configContent;
  }
  
  fs.writeFileSync(configManagerPath, configContent);
  console.log('✅ Fixed config-manager.ts imports');
}

// Fix 3: Update agent.ts to fix export and workflow issues
const agentPath = 'src/core/agent.ts';
if (fs.existsSync(agentPath)) {
  let agentContent = fs.readFileSync(agentPath, 'utf-8');
  
  // Fix export type issues
  agentContent = agentContent.replace(
    /export\s+{\s*([^}]+)\s*}\s+from\s+['"]([^'"]+)['"]/g,
    (match, exports, from) => {
      if (exports.includes('ExecutionResult') || exports.includes('UnifiedAgent')) {
        return `export type { ${exports} } from '${from}'`;
      }
      return match;
    }
  );
  
  // Add ModelClient import
  if (!agentContent.includes('ModelClient')) {
    agentContent = agentContent.replace(
      /import.*from ['"]\.\/types['"]/,
      `$&\nimport type { ModelClient } from './types';`
    );
  }
  
  // Fix workflow date assignments
  agentContent = agentContent.replace(/startTime:\s*Date\.now\(\)/g, 'startTime: new Date()');
  agentContent = agentContent.replace(/workflow\.endTime\s*=\s*Date\.now\(\)/g, 'workflow.endTime = new Date()');
  
  fs.writeFileSync(agentPath, agentContent);
  console.log('✅ Fixed agent.ts export and workflow issues');
}

// Fix 4: Create proper CLI output manager
const cliOutputContent = `
export interface CLIOutputManager {
  outputError: (message: string, exitCode?: number) => void;
  outputInfo: (message: string) => void;
  outputDebug: (message: string) => void;
  outputProgress: (message: string) => void;
  configure: (options: any) => void;
}

export function createCLIOutputManager(): CLIOutputManager {
  return {
    outputError: (message: string, exitCode?: number) => {
      console.error('❌', message);
      if (exitCode !== undefined) {
        process.exit(exitCode);
      }
    },
    outputInfo: (message: string) => {
      console.log('ℹ️', message);
    },
    outputDebug: (message: string) => {
      if (process.env.DEBUG) {
        console.log('🔍', message);
      }
    },
    outputProgress: (message: string) => {
      console.log('⏳', message);
    },
    configure: (options: any) => {
      // Configuration logic
    }
  };
}
`;

fs.writeFileSync('src/core/cli-output-manager.ts', cliOutputContent);
console.log('✅ Created CLI output manager');

// Fix 5: Update client.ts to fix provider initialization
const clientPath = 'src/core/client.ts';
if (fs.existsSync(clientPath)) {
  let clientContent = fs.readFileSync(clientPath, 'utf-8');
  
  // Fix provider initialization
  clientContent = clientContent.replace(
    /providers\.set\(/g,
    'this.providers.set('
  );
  
  // Add generate method to UnifiedModelClient
  if (!clientContent.includes('async generate(')) {
    const generateMethod = `
  async generate(request: any): Promise<any> {
    for (const providerType of this.config.fallbackChain) {
      const provider = this.providers.get(providerType);
      if (provider) {
        try {
          return await provider.generate(request);
        } catch (error) {
          console.warn(\`Provider \${providerType} failed, trying next...\`);
          continue;
        }
      }
    }
    throw new Error('All providers failed');
  }
`;
    
    clientContent = clientContent.replace(
      /class UnifiedModelClient\s*{[^}]*}/,
      (match) => match.slice(0, -1) + generateMethod + '}'
    );
  }
  
  fs.writeFileSync(clientPath, clientContent);
  console.log('✅ Fixed client.ts provider issues');
}

console.log('\n🎉 Secondary TypeScript fixes completed!');
console.log('🔄 Run "npm run build" again to check remaining errors');
