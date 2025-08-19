#!/usr/bin/env node

// Simple debug test for CLI
import { CLI } from './dist/core/cli.js';
import { UnifiedModelClient } from './dist/core/client.js';
import { VoiceArchetypeSystem } from './dist/voices/voice-archetype-system.js';
import { MCPServerManager } from './dist/mcp-servers/mcp-server-manager.js';
import { PerformanceMonitor } from './dist/utils/performance.js';

async function debugCLI() {
  try {
    console.log('🔍 Debug: Starting CLI test...');
    
    // Try to create basic components
    console.log('🔍 Debug: Creating PerformanceMonitor...');
    const performanceMonitor = new PerformanceMonitor();
    
    console.log('🔍 Debug: Creating UnifiedModelClient...');
    const modelClient = new UnifiedModelClient(performanceMonitor);
    
    console.log('🔍 Debug: Creating VoiceArchetypeSystem...');
    const voiceSystem = new VoiceArchetypeSystem();
    
    console.log('🔍 Debug: Creating MCPServerManager...');
    const mcpManager = new MCPServerManager({
      filesystem: { enabled: false },
      git: { enabled: false },
      terminal: { enabled: false },
      packageManager: { enabled: false }
    });
    
    console.log('🔍 Debug: Creating CLI...');
    const cli = new CLI({
      modelClient,
      voiceSystem,
      mcpManager,
      config: {
        model: { default: 'local-llama' },
        agent: { enabled: true, mode: 'balanced', maxConcurrency: 3, enableCaching: true, enableMetrics: true, enableSecurity: true }
      }
    });
    
    console.log('🔍 Debug: Running CLI with --help...');
    await cli.run(['--help']);
    
    console.log('✅ Debug: CLI test completed!');
  } catch (error) {
    console.error('❌ Debug: CLI test failed:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

debugCLI();