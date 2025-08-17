/**
 * Comprehensive Test Script for Hybrid Agent Analysis Quality
 * Tests various prompt types to evaluate routing decisions and response quality
 */

import { HybridModelClient } from './dist/core/hybrid-model-client.js';
import chalk from 'chalk';

class ComprehensiveAgentTester {
  constructor() {
    this.hybridClient = null;
    this.testResults = [];
    this.startTime = Date.now();
  }

  /**
   * Run comprehensive prompt tests
   */
  async runComprehensiveTests() {
    console.log(chalk.blue('\n🧪 CodeCrucible Synth - Comprehensive Agent Analysis Test\n'));
    
    try {
      await this.initializeClient();
      await this.testSimpleCodeGeneration();
      await this.testComplexAnalysis();
      await this.testTemplateGeneration();
      await this.testArchitecturalDesign();
      await this.testDebuggingTasks();
      await this.testRefactoringRequests();
      await this.testDocumentationGeneration();
      await this.testSecurityAnalysis();
      
      this.displayAnalysisResults();
    } catch (error) {
      console.error(chalk.red('\n❌ Comprehensive testing failed:'), error);
    } finally {
      await this.cleanup();
    }
  }

  /**
   * Initialize hybrid client
   */
  async initializeClient() {
    console.log(chalk.yellow('🔄 Initializing hybrid client...'));
    
    this.hybridClient = new HybridModelClient({
      autoLoadConfig: true,
      enableFallback: true,
      enableLearning: true
    });

    // Wait for initialization
    await new Promise(resolve => setTimeout(resolve, 2000));
    console.log(chalk.green('✅ Hybrid client ready\n'));
  }

  /**
   * Test simple code generation tasks
   */
  async testSimpleCodeGeneration() {
    console.log(chalk.cyan('📝 Testing Simple Code Generation...'));
    
    const testCases = [
      {
        prompt: 'Create a JavaScript function that calculates the factorial of a number',
        expectedProvider: 'lmstudio',
        category: 'Simple Code Generation'
      },
      {
        prompt: 'Write a Python function to reverse a string',
        expectedProvider: 'lmstudio', 
        category: 'Simple Code Generation'
      },
      {
        prompt: 'Generate a basic HTML login form with username and password fields',
        expectedProvider: 'lmstudio',
        category: 'Template Generation'
      }
    ];

    for (const testCase of testCases) {
      await this.executePromptTest(testCase);
    }
  }

  /**
   * Test complex analysis tasks
   */
  async testComplexAnalysis() {
    console.log(chalk.cyan('🔍 Testing Complex Analysis...'));
    
    const testCases = [
      {
        prompt: 'Analyze this codebase for potential security vulnerabilities, focusing on SQL injection, XSS, and authentication bypasses. Provide specific recommendations for each finding.',
        expectedProvider: 'ollama',
        category: 'Security Analysis'
      },
      {
        prompt: 'Review this microservices architecture and identify potential performance bottlenecks, scalability issues, and suggest optimization strategies.',
        expectedProvider: 'ollama',
        category: 'Architecture Analysis'
      },
      {
        prompt: 'Perform a comprehensive code review of this multi-file TypeScript project, checking for design patterns, SOLID principles compliance, and maintainability concerns.',
        expectedProvider: 'ollama',
        category: 'Code Review'
      }
    ];

    for (const testCase of testCases) {
      await this.executePromptTest(testCase);
    }
  }

  /**
   * Test template generation
   */
  async testTemplateGeneration() {
    console.log(chalk.cyan('📋 Testing Template Generation...'));
    
    const testCases = [
      {
        prompt: 'Create a React component template for a shopping cart item with props for name, price, and quantity',
        expectedProvider: 'lmstudio',
        category: 'React Template'
      },
      {
        prompt: 'Generate a Express.js route handler template for user authentication',
        expectedProvider: 'lmstudio',
        category: 'API Template'
      },
      {
        prompt: 'Create a CSS grid layout template for a responsive dashboard',
        expectedProvider: 'lmstudio',
        category: 'CSS Template'
      }
    ];

    for (const testCase of testCases) {
      await this.executePromptTest(testCase);
    }
  }

  /**
   * Test architectural design tasks
   */
  async testArchitecturalDesign() {
    console.log(chalk.cyan('🏗️ Testing Architectural Design...'));
    
    const testCases = [
      {
        prompt: 'Design a scalable microservices architecture for an e-commerce platform handling 100K+ daily users. Include database design, caching strategy, and deployment considerations.',
        expectedProvider: 'ollama',
        category: 'System Architecture'
      },
      {
        prompt: 'Create a data pipeline architecture for real-time analytics processing of user behavior data from multiple sources.',
        expectedProvider: 'ollama',
        category: 'Data Architecture'
      },
      {
        prompt: 'Design a fault-tolerant distributed system for a financial trading platform with sub-millisecond latency requirements.',
        expectedProvider: 'ollama',
        category: 'High-Performance Architecture'
      }
    ];

    for (const testCase of testCases) {
      await this.executePromptTest(testCase);
    }
  }

  /**
   * Test debugging tasks
   */
  async testDebuggingTasks() {
    console.log(chalk.cyan('🐛 Testing Debugging Tasks...'));
    
    const testCases = [
      {
        prompt: 'Debug this React component that is causing infinite re-renders: [component code would be here]',
        expectedProvider: 'ollama',
        category: 'React Debugging'
      },
      {
        prompt: 'Fix the syntax error in this JavaScript function: function test() { console.log("hello" }',
        expectedProvider: 'lmstudio',
        category: 'Syntax Fix'
      },
      {
        prompt: 'Analyze and fix performance issues in this Node.js application experiencing memory leaks',
        expectedProvider: 'ollama',
        category: 'Performance Debugging'
      }
    ];

    for (const testCase of testCases) {
      await this.executePromptTest(testCase);
    }
  }

  /**
   * Test refactoring requests
   */
  async testRefactoringRequests() {
    console.log(chalk.cyan('♻️ Testing Refactoring Tasks...'));
    
    const testCases = [
      {
        prompt: 'Refactor this function to use modern ES6+ syntax: function oldFunction(arr) { var result = []; for (var i = 0; i < arr.length; i++) { result.push(arr[i] * 2); } return result; }',
        expectedProvider: 'lmstudio',
        category: 'Simple Refactoring'
      },
      {
        prompt: 'Refactor this legacy monolithic application into a modular architecture following clean architecture principles and SOLID design patterns.',
        expectedProvider: 'ollama',
        category: 'Architecture Refactoring'
      },
      {
        prompt: 'Extract reusable components from this large React component and improve its testability',
        expectedProvider: 'ollama',
        category: 'Component Refactoring'
      }
    ];

    for (const testCase of testCases) {
      await this.executePromptTest(testCase);
    }
  }

  /**
   * Test documentation generation
   */
  async testDocumentationGeneration() {
    console.log(chalk.cyan('📚 Testing Documentation Generation...'));
    
    const testCases = [
      {
        prompt: 'Generate JSDoc comments for this function: function calculateTax(income, deductions) { return (income - deductions) * 0.25; }',
        expectedProvider: 'lmstudio',
        category: 'Code Documentation'
      },
      {
        prompt: 'Create comprehensive API documentation for a RESTful service including endpoint descriptions, request/response schemas, error codes, and usage examples.',
        expectedProvider: 'ollama',
        category: 'API Documentation'
      },
      {
        prompt: 'Write a technical specification document for implementing OAuth 2.0 authentication in a microservices environment.',
        expectedProvider: 'ollama',
        category: 'Technical Specification'
      }
    ];

    for (const testCase of testCases) {
      await this.executePromptTest(testCase);
    }
  }

  /**
   * Test security analysis
   */
  async testSecurityAnalysis() {
    console.log(chalk.cyan('🔒 Testing Security Analysis...'));
    
    const testCases = [
      {
        prompt: 'Review this SQL query for injection vulnerabilities: SELECT * FROM users WHERE username = "' + userInput + '"',
        expectedProvider: 'ollama',
        category: 'Security Review'
      },
      {
        prompt: 'Analyze this authentication flow and identify potential security weaknesses and attack vectors.',
        expectedProvider: 'ollama',
        category: 'Security Architecture'
      },
      {
        prompt: 'Check this input validation function for security issues: function validateEmail(email) { return email.includes("@"); }',
        expectedProvider: 'lmstudio',
        category: 'Input Validation'
      }
    ];

    for (const testCase of testCases) {
      await this.executePromptTest(testCase);
    }
  }

  /**
   * Execute individual prompt test
   */
  async executePromptTest(testCase) {
    const startTime = Date.now();
    
    try {
      console.log(chalk.gray(`\n  Testing: "${testCase.prompt.substring(0, 60)}..."`));
      
      // Generate response
      const response = await this.hybridClient.generateResponse(testCase.prompt, {}, {
        enableEscalation: true
      });

      const responseTime = Date.now() - startTime;
      
      // Analyze routing decision
      const routingCorrect = response.provider === testCase.expectedProvider;
      const routingIcon = routingCorrect ? chalk.green('✅') : chalk.yellow('⚠️');
      
      console.log(`  ${routingIcon} Provider: ${response.provider} (expected: ${testCase.expectedProvider})`);
      console.log(`  📊 Confidence: ${response.confidence.toFixed(2)}, Time: ${responseTime}ms`);
      console.log(`  📈 Escalated: ${response.escalated ? 'Yes' : 'No'}`);
      
      // Analyze response quality
      const qualityScore = this.assessResponseQuality(response, testCase);
      const qualityIcon = qualityScore >= 7 ? chalk.green('🌟') : qualityScore >= 5 ? chalk.yellow('⭐') : chalk.red('💫');
      
      console.log(`  ${qualityIcon} Quality Score: ${qualityScore}/10`);
      console.log(`  💭 Response Preview: "${response.content.substring(0, 100)}..."`);

      // Record result
      this.testResults.push({
        category: testCase.category,
        prompt: testCase.prompt.substring(0, 60) + '...',
        expectedProvider: testCase.expectedProvider,
        actualProvider: response.provider,
        routingCorrect,
        confidence: response.confidence,
        responseTime,
        escalated: response.escalated,
        qualityScore,
        reasoning: response.reasoning
      });

    } catch (error) {
      console.log(chalk.red(`  ❌ Test failed: ${error.message}`));
      
      this.testResults.push({
        category: testCase.category,
        prompt: testCase.prompt.substring(0, 60) + '...',
        expectedProvider: testCase.expectedProvider,
        actualProvider: 'error',
        routingCorrect: false,
        confidence: 0,
        responseTime: Date.now() - startTime,
        escalated: false,
        qualityScore: 0,
        reasoning: error.message
      });
    }
  }

  /**
   * Assess response quality based on various factors
   */
  assessResponseQuality(response, testCase) {
    let score = 5; // Base score

    // Content length check
    if (response.content.length > 100) score += 1;
    if (response.content.length > 500) score += 1;

    // Confidence scoring
    if (response.confidence > 0.8) score += 1;
    if (response.confidence > 0.9) score += 1;

    // Category-specific quality checks
    if (testCase.category.includes('Template') || testCase.category.includes('Simple')) {
      // For simple tasks, prefer fast responses
      if (response.responseTime < 2000) score += 1;
      if (response.provider === 'lmstudio') score += 0.5;
    } else if (testCase.category.includes('Analysis') || testCase.category.includes('Architecture')) {
      // For complex tasks, prefer thorough responses
      if (response.content.length > 1000) score += 1;
      if (response.provider === 'ollama') score += 0.5;
      if (response.escalated && testCase.expectedProvider === 'ollama') score += 1;
    }

    // Code quality indicators
    if (response.content.includes('function') || response.content.includes('const ') || response.content.includes('class ')) {
      score += 0.5;
    }

    // Explanation quality
    if (response.content.includes('because') || response.content.includes('reason') || response.content.includes('explanation')) {
      score += 0.5;
    }

    return Math.min(10, Math.max(0, Math.round(score)));
  }

  /**
   * Display comprehensive analysis results
   */
  displayAnalysisResults() {
    const totalTime = Date.now() - this.startTime;
    
    console.log(chalk.blue('\n📊 Comprehensive Agent Analysis Results'));
    console.log(chalk.blue('═'.repeat(60)));

    // Calculate metrics
    const totalTests = this.testResults.length;
    const routingAccuracy = (this.testResults.filter(r => r.routingCorrect).length / totalTests * 100).toFixed(1);
    const averageQuality = (this.testResults.reduce((sum, r) => sum + r.qualityScore, 0) / totalTests).toFixed(1);
    const averageConfidence = (this.testResults.reduce((sum, r) => sum + r.confidence, 0) / totalTests).toFixed(2);
    const averageResponseTime = Math.round(this.testResults.reduce((sum, r) => sum + r.responseTime, 0) / totalTests);
    const escalationRate = (this.testResults.filter(r => r.escalated).length / totalTests * 100).toFixed(1);

    // Overall metrics
    console.log(chalk.cyan('\n🎯 Overall Performance Metrics:'));
    console.log(`   Routing Accuracy: ${routingAccuracy}%`);
    console.log(`   Average Quality Score: ${averageQuality}/10`);
    console.log(`   Average Confidence: ${averageConfidence}`);
    console.log(`   Average Response Time: ${averageResponseTime}ms`);
    console.log(`   Escalation Rate: ${escalationRate}%`);

    // Category breakdown
    console.log(chalk.cyan('\n📋 Performance by Category:'));
    const categories = [...new Set(this.testResults.map(r => r.category))];
    
    categories.forEach(category => {
      const categoryResults = this.testResults.filter(r => r.category === category);
      const categoryAccuracy = (categoryResults.filter(r => r.routingCorrect).length / categoryResults.length * 100).toFixed(1);
      const categoryQuality = (categoryResults.reduce((sum, r) => sum + r.qualityScore, 0) / categoryResults.length).toFixed(1);
      const categoryTime = Math.round(categoryResults.reduce((sum, r) => sum + r.responseTime, 0) / categoryResults.length);
      
      console.log(`   ${category}:`);
      console.log(`     Routing: ${categoryAccuracy}%, Quality: ${categoryQuality}/10, Time: ${categoryTime}ms`);
    });

    // Provider performance
    console.log(chalk.cyan('\n🏭 Provider Performance:'));
    const lmStudioResults = this.testResults.filter(r => r.actualProvider === 'lmstudio');
    const ollamaResults = this.testResults.filter(r => r.actualProvider === 'ollama');
    
    if (lmStudioResults.length > 0) {
      const lmStudioQuality = (lmStudioResults.reduce((sum, r) => sum + r.qualityScore, 0) / lmStudioResults.length).toFixed(1);
      const lmStudioTime = Math.round(lmStudioResults.reduce((sum, r) => sum + r.responseTime, 0) / lmStudioResults.length);
      console.log(`   LM Studio: ${lmStudioResults.length} requests, Quality: ${lmStudioQuality}/10, Avg Time: ${lmStudioTime}ms`);
    }
    
    if (ollamaResults.length > 0) {
      const ollamaQuality = (ollamaResults.reduce((sum, r) => sum + r.qualityScore, 0) / ollamaResults.length).toFixed(1);
      const ollamaTime = Math.round(ollamaResults.reduce((sum, r) => sum + r.responseTime, 0) / ollamaResults.length);
      console.log(`   Ollama: ${ollamaResults.length} requests, Quality: ${ollamaQuality}/10, Avg Time: ${ollamaTime}ms`);
    }

    // Recommendations
    console.log(chalk.yellow('\n💡 Analysis & Recommendations:'));
    
    if (parseFloat(routingAccuracy) < 80) {
      console.log(`   ⚠️ Routing accuracy (${routingAccuracy}%) below target. Consider adjusting classification rules.`);
    }
    
    if (parseFloat(averageQuality) < 7) {
      console.log(`   ⚠️ Average quality score (${averageQuality}) below target. Review response generation logic.`);
    }
    
    if (parseFloat(escalationRate) > 20) {
      console.log(`   ⚠️ High escalation rate (${escalationRate}%). Consider lowering escalation threshold.`);
    } else if (parseFloat(escalationRate) < 5) {
      console.log(`   ⚠️ Low escalation rate (${escalationRate}%). Consider raising escalation threshold for better quality.`);
    }

    if (averageResponseTime > 10000) {
      console.log(`   ⚠️ High average response time (${averageResponseTime}ms). Optimize for speed.`);
    }

    console.log(chalk.blue(`\n⏱️ Total Analysis Time: ${(totalTime / 1000).toFixed(1)}s`));

    // Final assessment
    const overallScore = (parseFloat(routingAccuracy) + parseFloat(averageQuality) * 10) / 2;
    if (overallScore >= 85) {
      console.log(chalk.green('\n🎉 Excellent! Agent provides high-quality, well-routed responses.'));
    } else if (overallScore >= 70) {
      console.log(chalk.yellow('\n👍 Good performance with room for improvement.'));
    } else {
      console.log(chalk.red('\n🔧 Significant improvements needed for production readiness.'));
    }
  }

  /**
   * Cleanup resources
   */
  async cleanup() {
    if (this.hybridClient) {
      try {
        await this.hybridClient.dispose();
        console.log(chalk.gray('\n🧹 Resources cleaned up successfully'));
      } catch (error) {
        console.log(chalk.yellow('\n⚠️ Cleanup warning:', error.message));
      }
    }
  }
}

// Run the comprehensive analysis test
if (import.meta.url === `file://${process.argv[1]}`) {
  const tester = new ComprehensiveAgentTester();
  tester.runComprehensiveTests().catch(console.error);
}

export { ComprehensiveAgentTester };