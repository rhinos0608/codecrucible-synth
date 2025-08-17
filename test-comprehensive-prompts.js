#!/usr/bin/env node
import { HybridModelClient } from './dist/core/hybrid-model-client.js';

async function testComprehensivePrompts() {
  console.log('🧪 Comprehensive Agent Testing with Diverse Prompts');
  console.log('==================================================\n');
  
  try {
    const hybridClient = new HybridModelClient({
      autoLoadConfig: true,
      enableFallback: true,
      enableLearning: true
    });

    // Wait for initialization
    await new Promise(resolve => setTimeout(resolve, 3000));
    console.log('✅ Hybrid client initialized\n');

    // Test Suite 1: Template Generation (Should use LM Studio)
    console.log('📝 Test Suite 1: Template Generation');
    console.log('====================================');
    
    const templateTests = [
      {
        name: 'React Component',
        prompt: 'Create a React component for a user profile card with avatar, name, email, and bio',
        expected: 'lmstudio',
        taskType: 'template'
      },
      {
        name: 'API Endpoint',
        prompt: 'Generate a FastAPI endpoint for user authentication with JWT tokens',
        expected: 'lmstudio', 
        taskType: 'template'
      },
      {
        name: 'Database Schema',
        prompt: 'Create a PostgreSQL schema for an e-commerce product catalog',
        expected: 'lmstudio',
        taskType: 'template'
      },
      {
        name: 'Config File',
        prompt: 'Generate a Docker Compose file for a MERN stack application',
        expected: 'lmstudio',
        taskType: 'template'
      }
    ];

    const templateResults = [];
    for (const test of templateTests) {
      try {
        const start = Date.now();
        const response = await hybridClient.generateResponse(
          test.prompt,
          { taskType: test.taskType, complexity: 'simple' }
        );
        const duration = Date.now() - start;
        
        const result = {
          name: test.name,
          duration,
          provider: response.provider,
          model: response.model,
          confidence: response.confidence,
          expected: test.expected,
          correct: response.provider === test.expected
        };
        
        templateResults.push(result);
        console.log(`   ${test.name}: ${duration}ms → ${response.provider}/${response.model} ${result.correct ? '✅' : '❌'}`);
        
      } catch (error) {
        console.log(`   ${test.name}: Failed - ${error.message}`);
        templateResults.push({ name: test.name, error: error.message });
      }
    }

    // Test Suite 2: Complex Analysis (Should use Ollama)
    console.log('\n🧠 Test Suite 2: Complex Analysis');
    console.log('=================================');
    
    const analysisTests = [
      {
        name: 'Algorithm Analysis',
        prompt: 'Analyze the time and space complexity of merge sort vs quicksort and recommend when to use each',
        expected: 'ollama',
        taskType: 'analysis'
      },
      {
        name: 'Security Review',
        prompt: 'Review this authentication system for security vulnerabilities and provide detailed recommendations',
        expected: 'ollama',
        taskType: 'security-review'
      },
      {
        name: 'Architecture Planning',
        prompt: 'Design a scalable microservices architecture for a social media platform handling 10M users',
        expected: 'ollama',
        taskType: 'planning'
      },
      {
        name: 'Code Debugging',
        prompt: 'Debug this complex race condition in a multi-threaded application and explain the fix',
        expected: 'ollama',
        taskType: 'debugging'
      }
    ];

    const analysisResults = [];
    for (const test of analysisTests) {
      try {
        const start = Date.now();
        const response = await hybridClient.generateResponse(
          test.prompt,
          { taskType: test.taskType, complexity: 'complex' }
        );
        const duration = Date.now() - start;
        
        const result = {
          name: test.name,
          duration,
          provider: response.provider,
          model: response.model,
          confidence: response.confidence,
          expected: test.expected,
          correct: response.provider === test.expected
        };
        
        analysisResults.push(result);
        console.log(`   ${test.name}: ${duration}ms → ${response.provider}/${response.model} ${result.correct ? '✅' : '❌'}`);
        
      } catch (error) {
        console.log(`   ${test.name}: Failed - ${error.message}`);
        analysisResults.push({ name: test.name, error: error.message });
      }
    }

    // Test Suite 3: Mixed Complexity (Should demonstrate dynamic routing)
    console.log('\n⚖️ Test Suite 3: Mixed Complexity Tasks');
    console.log('=====================================');
    
    const mixedTests = [
      {
        name: 'Simple Edit',
        prompt: 'Add error handling to this function',
        taskType: 'edit',
        complexity: 'simple',
        expected: 'lmstudio'
      },
      {
        name: 'Complex Refactoring',
        prompt: 'Refactor this monolithic application into microservices with proper separation of concerns',
        taskType: 'multi-file',
        complexity: 'complex',
        expected: 'ollama'
      },
      {
        name: 'Code Formatting',
        prompt: 'Format and optimize this JavaScript code following ESLint rules',
        taskType: 'format',
        complexity: 'simple',
        expected: 'lmstudio'
      },
      {
        name: 'Performance Optimization',
        prompt: 'Optimize this database query that is causing performance bottlenecks',
        taskType: 'analysis',
        complexity: 'complex',
        expected: 'ollama'
      }
    ];

    const mixedResults = [];
    for (const test of mixedTests) {
      try {
        const start = Date.now();
        const response = await hybridClient.generateResponse(
          test.prompt,
          { taskType: test.taskType, complexity: test.complexity }
        );
        const duration = Date.now() - start;
        
        const result = {
          name: test.name,
          duration,
          provider: response.provider,
          model: response.model,
          confidence: response.confidence,
          escalated: response.escalated,
          expected: test.expected,
          correct: response.provider === test.expected
        };
        
        mixedResults.push(result);
        const escalationText = response.escalated ? ' (escalated)' : '';
        console.log(`   ${test.name}: ${duration}ms → ${response.provider}/${response.model}${escalationText} ${result.correct ? '✅' : '❌'}`);
        
      } catch (error) {
        console.log(`   ${test.name}: Failed - ${error.message}`);
        mixedResults.push({ name: test.name, error: error.message });
      }
    }

    // Test Suite 4: Edge Cases and Stress Testing
    console.log('\n🔥 Test Suite 4: Edge Cases & Stress Testing');
    console.log('===========================================');
    
    const edgeTests = [
      {
        name: 'Very Short Prompt',
        prompt: 'Fix bug',
        taskType: 'edit',
        complexity: 'simple'
      },
      {
        name: 'Very Long Prompt',
        prompt: 'Create a comprehensive full-stack web application with user authentication, real-time messaging, file uploads, payment processing, admin dashboard, responsive design, database optimization, caching layer, API rate limiting, monitoring, logging, testing suite, CI/CD pipeline, and deployment to AWS with auto-scaling capabilities',
        taskType: 'multi-file',
        complexity: 'complex'
      },
      {
        name: 'Ambiguous Request',
        prompt: 'Make it better',
        taskType: 'general',
        complexity: 'medium'
      },
      {
        name: 'Multiple Languages',
        prompt: 'Create a Python backend that integrates with a React frontend and PostgreSQL database',
        taskType: 'multi-file',
        complexity: 'complex'
      }
    ];

    const edgeResults = [];
    for (const test of edgeTests) {
      try {
        const start = Date.now();
        const response = await hybridClient.generateResponse(
          test.prompt,
          { taskType: test.taskType, complexity: test.complexity }
        );
        const duration = Date.now() - start;
        
        const result = {
          name: test.name,
          duration,
          provider: response.provider,
          model: response.model,
          confidence: response.confidence,
          escalated: response.escalated
        };
        
        edgeResults.push(result);
        const escalationText = response.escalated ? ' (escalated)' : '';
        console.log(`   ${test.name}: ${duration}ms → ${response.provider}/${response.model}${escalationText}`);
        
      } catch (error) {
        console.log(`   ${test.name}: Failed - ${error.message}`);
        edgeResults.push({ name: test.name, error: error.message });
      }
    }

    // Test Suite 5: Concurrent Load Testing
    console.log('\n⚡ Test Suite 5: Concurrent Load Testing');
    console.log('======================================');
    
    const loadStart = Date.now();
    const concurrentPromises = [];
    
    for (let i = 1; i <= 5; i++) {
      concurrentPromises.push(
        hybridClient.generateResponse(
          `Concurrent request ${i}: Create a simple function`,
          { taskType: 'template', complexity: 'simple', requestId: i }
        ).then(response => ({
          id: i,
          provider: response.provider,
          model: response.model,
          time: Date.now() - loadStart,
          success: true
        })).catch(error => ({
          id: i,
          error: error.message,
          time: Date.now() - loadStart,
          success: false
        }))
      );
    }
    
    const loadResults = await Promise.all(concurrentPromises);
    console.log('   Concurrent execution results:');
    loadResults.forEach(result => {
      if (result.success) {
        console.log(`   Request ${result.id}: ${result.provider}/${result.model} completed at ${result.time}ms`);
      } else {
        console.log(`   Request ${result.id}: Failed at ${result.time}ms - ${result.error}`);
      }
    });

    // Performance Analysis
    console.log('\n📊 Performance Analysis');
    console.log('======================');
    
    const allResults = [...templateResults, ...analysisResults, ...mixedResults].filter(r => !r.error);
    
    if (allResults.length > 0) {
      // Routing accuracy
      const correctRouting = allResults.filter(r => r.correct).length;
      const routingAccuracy = (correctRouting / allResults.length * 100).toFixed(1);
      
      // Performance by provider
      const lmStudioResults = allResults.filter(r => r.provider === 'lmstudio');
      const ollamaResults = allResults.filter(r => r.provider === 'ollama');
      
      const avgLMStudio = lmStudioResults.length > 0 ? 
        (lmStudioResults.reduce((sum, r) => sum + r.duration, 0) / lmStudioResults.length).toFixed(0) : 'N/A';
      const avgOllama = ollamaResults.length > 0 ? 
        (ollamaResults.reduce((sum, r) => sum + r.duration, 0) / ollamaResults.length).toFixed(0) : 'N/A';
      
      console.log(`✅ Routing Accuracy: ${routingAccuracy}% (${correctRouting}/${allResults.length})`);
      console.log(`⚡ LM Studio Average: ${avgLMStudio}ms (${lmStudioResults.length} requests)`);
      console.log(`🧠 Ollama Average: ${avgOllama}ms (${ollamaResults.length} requests)`);
      
      // Escalation analysis
      const escalatedResults = allResults.filter(r => r.escalated);
      const escalationRate = (escalatedResults.length / allResults.length * 100).toFixed(1);
      console.log(`🔄 Escalation Rate: ${escalationRate}% (${escalatedResults.length}/${allResults.length})`);
      
      // Confidence analysis
      const avgConfidence = (allResults.reduce((sum, r) => sum + r.confidence, 0) / allResults.length).toFixed(2);
      console.log(`🎯 Average Confidence: ${avgConfidence}`);
    }

    // Recommendations
    console.log('\n💡 Optimization Recommendations');
    console.log('==============================');
    
    const issues = [];
    
    // Check routing accuracy
    if (allResults.length > 0) {
      const correctRouting = allResults.filter(r => r.correct).length;
      const routingAccuracy = correctRouting / allResults.length;
      
      if (routingAccuracy < 0.9) {
        issues.push('Routing accuracy below 90% - consider adjusting task classification rules');
      }
      
      // Check LM Studio performance
      const lmStudioResults = allResults.filter(r => r.provider === 'lmstudio');
      if (lmStudioResults.length > 0) {
        const avgLMStudio = lmStudioResults.reduce((sum, r) => sum + r.duration, 0) / lmStudioResults.length;
        if (avgLMStudio > 5000) {
          issues.push('LM Studio response times > 5s - check GPU utilization and model loading');
        }
      }
      
      // Check Ollama performance
      const ollamaResults = allResults.filter(r => r.provider === 'ollama');
      if (ollamaResults.length > 0) {
        const avgOllama = ollamaResults.reduce((sum, r) => sum + r.duration, 0) / ollamaResults.length;
        if (avgOllama > 60000) {
          issues.push('Ollama response times > 60s - consider CPU optimization or smaller models');
        }
      }
    }
    
    if (issues.length === 0) {
      console.log('✅ No performance issues detected');
      console.log('✅ System performing optimally');
    } else {
      issues.forEach(issue => console.log(`⚠️  ${issue}`));
    }

    await hybridClient.dispose();
    
  } catch (error) {
    console.log(`💥 Testing failed: ${error.message}`);
    console.error(error);
  }
}

testComprehensivePrompts().catch(console.error);