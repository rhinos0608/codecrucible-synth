// Test script to verify the fixes work
import { IntelligentModelSelector } from './dist/core/intelligent-model-selector.js';

async function testModelSelection() {
  console.log('🧪 Testing model selection fixes...\n');
  
  const selector = new IntelligentModelSelector();
  
  // Wait for initialization
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  console.log('📊 Testing coding task model selection:');
  try {
    const codingModel = await selector.selectOptimalModel('coding', {
      complexity: 'medium',
      speed: 'medium', 
      accuracy: 'high'
    });
    console.log(`✅ Selected model for coding: ${codingModel}`);
  } catch (error) {
    console.log(`❌ Error selecting model: ${error.message}`);
  }
  
  console.log('\n📊 Testing chat task model selection:');
  try {
    const chatModel = await selector.selectOptimalModel('chat', {
      complexity: 'simple',
      speed: 'fast',
      accuracy: 'medium'
    });
    console.log(`✅ Selected model for chat: ${chatModel}`);
  } catch (error) {
    console.log(`❌ Error selecting model: ${error.message}`);
  }
}

testModelSelection().catch(console.error);