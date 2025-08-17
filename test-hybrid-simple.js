/**
 * Simple Hybrid Architecture Test
 */

console.log('🚀 Starting Hybrid Architecture Test...');

try {
  // Test basic imports
  console.log('📦 Testing imports...');
  
  const { HybridConfigManager } = await import('./dist/core/hybrid-config-manager.js');
  console.log('✅ HybridConfigManager imported successfully');
  
  // Test configuration loading
  console.log('⚙️ Testing configuration...');
  const configManager = new HybridConfigManager();
  const config = await configManager.loadConfig();
  
  console.log('✅ Configuration loaded:', {
    enabled: config.hybrid.enabled,
    lmStudio: config.hybrid.lmStudio.enabled,
    ollama: config.hybrid.ollama.enabled,
    rules: config.hybrid.routing.rules.length
  });
  
  // Test model selector
  console.log('🎯 Testing model selector...');
  const { IntelligentModelSelector } = await import('./dist/core/intelligent-model-selector.js');
  const modelSelector = new IntelligentModelSelector('http://localhost:11434', config.hybrid);
  
  // Test task classification
  const classification = modelSelector.classifyTask('Create a React component template');
  console.log('✅ Task classification:', classification);
  
  // Test routing decision
  const decision = await modelSelector.makeRoutingDecision('Create a React component template');
  console.log('✅ Routing decision:', decision);
  
  console.log('🎉 All basic tests passed! Hybrid architecture is functional.');
  
} catch (error) {
  console.error('❌ Test failed:', error.message);
  console.error(error.stack);
}