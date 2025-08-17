/**
 * Focused Agent Testing Script
 * Tests key scenarios to evaluate routing and analysis quality
 */

import { HybridModelClient } from './dist/core/hybrid-model-client.js';
import chalk from 'chalk';

async function runFocusedAgentTest() {
  console.log(chalk.blue('\n🎯 CodeCrucible Synth - Focused Agent Analysis Test\n'));
  
  let hybridClient = null;
  
  try {
    // Initialize hybrid client
    console.log(chalk.yellow('🔄 Initializing hybrid client...'));
    hybridClient = new HybridModelClient({
      autoLoadConfig: true,
      enableFallback: true,
      enableLearning: true
    });

    // Wait for initialization
    await new Promise(resolve => setTimeout(resolve, 3000));
    console.log(chalk.green('✅ Hybrid client ready\n'));

    // Test Cases - Focused on key scenarios
    const testCases = [
      {
        name: 'Simple Template Generation',
        prompt: 'Create a basic React button component with onClick handler',
        expectedProvider: 'lmstudio',
        expectedFast: true
      },
      {
        name: 'Code Analysis',
        prompt: 'Analyze this codebase structure and identify potential architectural improvements',
        expectedProvider: 'ollama',
        expectedFast: false
      },
      {
        name: 'Security Review',
        prompt: 'Review this authentication system for security vulnerabilities and provide specific recommendations',
        expectedProvider: 'ollama',
        expectedFast: false
      },
      {
        name: 'Simple Fix',
        prompt: 'Fix this JavaScript syntax error: function test() { console.log("missing quote) }',
        expectedProvider: 'lmstudio',
        expectedFast: true
      }
    ];

    const results = [];

    // Run tests
    for (const testCase of testCases) {
      console.log(chalk.cyan(`\n🧪 Testing: ${testCase.name}`));
      console.log(chalk.gray(`   Prompt: "${testCase.prompt}"`));
      
      const startTime = Date.now();
      
      try {
        const response = await hybridClient.generateResponse(testCase.prompt, {}, {
          enableEscalation: true
        });

        const responseTime = Date.now() - startTime;
        
        // Analyze results
        const routingCorrect = response.provider === testCase.expectedProvider;
        const speedAppropriate = testCase.expectedFast ? responseTime < 5000 : responseTime < 60000;
        const hasContent = response.content && response.content.length > 50;
        const goodConfidence = response.confidence > 0.6;
        
        console.log(chalk.green(`   ✅ Response received in ${responseTime}ms`));
        console.log(`   🎯 Provider: ${response.provider} (expected: ${testCase.expectedProvider}) ${routingCorrect ? '✅' : '⚠️'}`);
        console.log(`   📊 Confidence: ${response.confidence.toFixed(2)} ${goodConfidence ? '✅' : '⚠️'}`);
        console.log(`   🏃 Speed: ${speedAppropriate ? 'Appropriate' : 'Too slow'} ${speedAppropriate ? '✅' : '⚠️'}`);
        console.log(`   📝 Content length: ${response.content.length} chars ${hasContent ? '✅' : '⚠️'}`);
        console.log(`   📈 Escalated: ${response.escalated ? 'Yes' : 'No'}`);
        console.log(`   💭 Preview: "${response.content.substring(0, 100)}..."`);
        
        const score = [routingCorrect, speedAppropriate, hasContent, goodConfidence].filter(Boolean).length;
        
        results.push({
          name: testCase.name,
          score: score,
          maxScore: 4,
          responseTime,
          provider: response.provider,
          confidence: response.confidence,
          escalated: response.escalated,
          success: true
        });

      } catch (error) {
        console.log(chalk.red(`   ❌ Test failed: ${error.message}`));
        results.push({
          name: testCase.name,
          score: 0,
          maxScore: 4,
          responseTime: Date.now() - startTime,
          provider: 'error',
          confidence: 0,
          escalated: false,
          success: false,
          error: error.message
        });
      }
    }

    // Display summary
    console.log(chalk.blue('\n📊 Test Summary'));
    console.log(chalk.blue('═'.repeat(50)));
    
    const totalScore = results.reduce((sum, r) => sum + r.score, 0);
    const maxTotalScore = results.reduce((sum, r) => sum + r.maxScore, 0);
    const overallPercentage = (totalScore / maxTotalScore * 100).toFixed(1);
    
    results.forEach(result => {
      const percentage = (result.score / result.maxScore * 100).toFixed(1);
      const icon = result.success ? (result.score >= 3 ? chalk.green('🟢') : chalk.yellow('🟡')) : chalk.red('🔴');
      console.log(`${icon} ${result.name}: ${result.score}/${result.maxScore} (${percentage}%) - ${result.responseTime}ms`);
      if (result.error) {
        console.log(chalk.red(`    Error: ${result.error}`));
      }
    });
    
    console.log(chalk.blue('═'.repeat(50)));
    console.log(`🎯 Overall Score: ${totalScore}/${maxTotalScore} (${overallPercentage}%)`);
    
    // Analysis and recommendations
    console.log(chalk.yellow('\n💡 Analysis:'));
    
    const successfulTests = results.filter(r => r.success);
    if (successfulTests.length > 0) {
      const avgResponseTime = successfulTests.reduce((sum, r) => sum + r.responseTime, 0) / successfulTests.length;
      const avgConfidence = successfulTests.reduce((sum, r) => sum + r.confidence, 0) / successfulTests.length;
      const escalationRate = (successfulTests.filter(r => r.escalated).length / successfulTests.length * 100).toFixed(1);
      
      console.log(`   📈 Average Response Time: ${Math.round(avgResponseTime)}ms`);
      console.log(`   📊 Average Confidence: ${avgConfidence.toFixed(2)}`);
      console.log(`   🔄 Escalation Rate: ${escalationRate}%`);
    }
    
    if (parseFloat(overallPercentage) >= 85) {
      console.log(chalk.green('\n🎉 Excellent! Agent is performing very well.'));
    } else if (parseFloat(overallPercentage) >= 70) {
      console.log(chalk.yellow('\n👍 Good performance with room for improvement.'));
    } else {
      console.log(chalk.red('\n🔧 Significant improvements needed.'));
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
runFocusedAgentTest().catch(console.error);