/**
 * Test Improved Fallback Mechanism
 */

import { HybridModelClient } from './dist/core/hybrid-model-client.js';
import chalk from 'chalk';

async function testImprovedFallback() {
  console.log(chalk.blue('\n🔧 Testing Improved Fallback Mechanism\n'));
  
  let hybridClient = null;
  
  try {
    // Initialize hybrid client
    console.log(chalk.yellow('🔄 Initializing hybrid client...'));
    hybridClient = new HybridModelClient({
      autoLoadConfig: true,
      enableFallback: true,
      enableLearning: true
    });

    await new Promise(resolve => setTimeout(resolve, 3000));
    console.log(chalk.green('✅ Hybrid client ready\n'));

    // Test simple prompt that should route to LM Studio (but will fail) and fallback to Ollama
    console.log(chalk.cyan('🧪 Testing LM Studio → Ollama Fallback'));
    console.log(chalk.gray('   Expecting: LM Studio fails, automatically falls back to Ollama\n'));
    
    const startTime = Date.now();
    
    try {
      const response = await hybridClient.generateResponse(
        'Create a simple JavaScript function that adds two numbers',
        {},
        { enableEscalation: true }
      );

      const responseTime = Date.now() - startTime;
      
      console.log(chalk.green(`✅ Response received in ${responseTime}ms`));
      console.log(`🎯 Provider: ${response.provider}`);
      console.log(`📊 Confidence: ${response.confidence.toFixed(2)}`);
      console.log(`📈 Escalated: ${response.escalated ? 'Yes' : 'No'}`);
      console.log(`📝 Content length: ${response.content.length} chars`);
      console.log(`💭 Preview: "${response.content.substring(0, 150)}..."`);
      
      if (response.metadata.originalProvider) {
        console.log(chalk.yellow(`🔄 Fallback occurred: ${response.metadata.originalProvider} → ${response.provider}`));
        console.log(`   Reason: ${response.metadata.escalationReason}`);
      }
      
      // Analyze quality
      const hasFunction = response.content.includes('function') || response.content.includes('=>');
      const hasAddition = response.content.includes('+') || response.content.includes('add');
      const hasReturn = response.content.includes('return');
      
      console.log(chalk.cyan('\n📋 Quality Analysis:'));
      console.log(`   Contains function syntax: ${hasFunction ? '✅' : '❌'}`);
      console.log(`   Contains addition logic: ${hasAddition ? '✅' : '❌'}`);
      console.log(`   Contains return statement: ${hasReturn ? '✅' : '❌'}`);
      
      const qualityScore = [hasFunction, hasAddition, hasReturn].filter(Boolean).length;
      console.log(`   Quality Score: ${qualityScore}/3`);
      
      if (qualityScore >= 2 && response.content.length > 50) {
        console.log(chalk.green('\n🎉 Fallback mechanism working! Good quality response received.'));
      } else {
        console.log(chalk.yellow('\n⚠️ Fallback mechanism activated but response quality could be improved.'));
      }

    } catch (error) {
      const responseTime = Date.now() - startTime;
      console.log(chalk.red(`❌ Complete failure after ${responseTime}ms: ${error.message}`));
      
      if (error.message.includes('All providers failed')) {
        console.log(chalk.yellow('   Both LM Studio and Ollama failed - this indicates a configuration issue.'));
      }
    }

  } catch (error) {
    console.error(chalk.red('\n❌ Test setup failed:'), error);
  } finally {
    // Cleanup
    if (hybridClient) {
      try {
        await hybridClient.dispose();
        console.log(chalk.gray('\n🧹 Resources cleaned up successfully'));
      } catch (error) {
        console.log(chalk.yellow('\n⚠️ Cleanup warning:', error.message));
      }
    }
  }
}

// Run the test
testImprovedFallback().catch(console.error);