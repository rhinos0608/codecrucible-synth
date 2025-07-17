#!/usr/bin/env node
// VS Code Extension - Comprehensive Test Script
// Following AI_INSTRUCTIONS.md security patterns and CodingPhilosophy.md consciousness principles

const axios = require('axios');

// Test configuration
const config = {
  apiUrl: 'http://localhost:5000/api', // Local development server with correct API path
  userId: 'vscode-test-user-001',
  platform: 'vscode',
  version: '1.0.0'
};

class ExtensionTester {
  constructor() {
    this.apiKey = null;
    this.sessionId = null;
    this.api = axios.create({
      baseURL: config.apiUrl,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'CodeCrucible-VSCode-Extension-Test/1.0.0'
      }
    });

    // Add request interceptor for API key
    this.api.interceptors.request.use((requestConfig) => {
      if (this.apiKey) {
        requestConfig.headers['x-codecrucible-api-key'] = this.apiKey;
      }
      return requestConfig;
    });

    // Add response interceptor for error handling
    this.api.interceptors.response.use(
      (response) => response,
      (error) => {
        console.error('API Error:', {
          status: error.response?.status,
          data: error.response?.data,
          message: error.message
        });
        return Promise.reject(error);
      }
    );
  }

  async runTests() {
    console.log('🚀 Starting CodeCrucible VS Code Extension Tests');
    console.log('=' * 60);

    try {
      // Test 1: Authentication
      await this.testAuthentication();
      
      // Test 2: Health Check
      await this.testHealthCheck();
      
      // Test 3: Voice Recommendations
      await this.testVoiceRecommendations();
      
      // Test 4: Code Generation
      await this.testCodeGeneration();
      
      // Test 5: Solution Synthesis
      await this.testSolutionSynthesis();
      
      // Test 6: Usage Analytics
      await this.testUsageAnalytics();

      console.log('\n✅ All tests completed successfully!');
      console.log('🎯 VS Code extension API integration is ready for production');

    } catch (error) {
      console.error('\n❌ Test suite failed:', error.message);
      process.exit(1);
    }
  }

  async testAuthentication() {
    console.log('\n📝 Test 1: Extension Authentication');
    console.log('-'.repeat(40));

    try {
      const response = await this.api.post('/api/extensions/auth', {
        platform: config.platform,
        version: config.version,
        userId: config.userId,
        clientId: `vscode-test-${Date.now()}`
      });

      this.apiKey = response.data.apiKey;
      console.log('✅ Authentication successful');
      console.log(`   API Key: ${this.apiKey.substring(0, 12)}...`);
      console.log(`   Features: ${Object.keys(response.data.features).join(', ')}`);

    } catch (error) {
      throw new Error(`Authentication failed: ${error.response?.data?.error || error.message}`);
    }
  }

  async testHealthCheck() {
    console.log('\n🔍 Test 2: Health Check');
    console.log('-'.repeat(40));

    try {
      const response = await this.api.get('/api/extensions/health');
      console.log('✅ Health check successful');
      console.log(`   Status: ${response.data.status}`);
      console.log(`   API Version: ${response.data.version || 'N/A'}`);
      console.log(`   Uptime: ${response.data.uptime || 'N/A'}`);

    } catch (error) {
      throw new Error(`Health check failed: ${error.response?.data?.error || error.message}`);
    }
  }

  async testVoiceRecommendations() {
    console.log('\n🧠 Test 3: Voice Recommendations');
    console.log('-'.repeat(40));

    const testPrompts = [
      {
        prompt: 'Create a React component with TypeScript',
        context: { language: 'typescript', projectType: 'react' }
      },
      {
        prompt: 'Optimize database query performance',
        context: { language: 'sql', projectType: 'backend' }
      },
      {
        prompt: 'Implement user authentication with JWT',
        context: { language: 'javascript', projectType: 'nodejs' }
      }
    ];

    for (const test of testPrompts) {
      try {
        const response = await this.api.post('/api/extensions/recommendations', test);
        console.log(`✅ Recommendation for: "${test.prompt.substring(0, 30)}..."`);
        console.log(`   Suggestions: ${response.data.recommendations?.length || 0}`);
        
        if (response.data.recommendations?.length > 0) {
          const topRec = response.data.recommendations[0];
          console.log(`   Top Voice: ${topRec.voiceType} (${topRec.confidence}% confidence)`);
        }

      } catch (error) {
        console.warn(`⚠️ Recommendation failed for: "${test.prompt.substring(0, 30)}..."`);
      }
    }
  }

  async testCodeGeneration() {
    console.log('\n💻 Test 4: Code Generation');
    console.log('-'.repeat(40));

    try {
      const generationRequest = {
        prompt: 'Create a TypeScript function that validates email addresses using regex',
        context: {
          language: 'typescript',
          filePath: '/src/utils/validation.ts',
          projectType: 'typescript',
          dependencies: ['typescript'],
          surroundingCode: '// Utility functions for form validation'
        },
        voices: {
          perspectives: ['Developer', 'Explorer'],
          roles: ['Security Engineer', 'Systems Architect']
        },
        synthesisMode: 'collaborative',
        maxSolutions: 4
      };

      const response = await this.api.post('/api/extensions/generate', generationRequest);
      this.sessionId = response.data.sessionId;

      console.log('✅ Code generation successful');
      console.log(`   Session ID: ${this.sessionId}`);
      console.log(`   Solutions generated: ${response.data.solutions?.length || 0}`);
      console.log(`   Synthesis available: ${response.data.synthesisAvailable}`);

      if (response.data.solutions?.length > 0) {
        console.log('   Voice solutions:');
        response.data.solutions.forEach(solution => {
          console.log(`     - ${solution.voiceType}: ${solution.confidence}% confidence`);
        });
      }

    } catch (error) {
      throw new Error(`Code generation failed: ${error.response?.data?.error || error.message}`);
    }
  }

  async testSolutionSynthesis() {
    console.log('\n🔗 Test 5: Solution Synthesis');
    console.log('-'.repeat(40));

    try {
      const synthesisRequest = {
        solutions: [
          {
            code: 'function validateEmail(email) { return /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email); }',
            explanation: 'Simple regex-based email validation',
            voiceType: 'Developer',
            confidence: 0.85
          },
          {
            code: 'const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$/; export function isValidEmail(email: string): boolean { return EMAIL_REGEX.test(email); }',
            explanation: 'TypeScript implementation with comprehensive regex',
            voiceType: 'Security Engineer',
            confidence: 0.92
          }
        ],
        synthesisGoal: 'best_practices'
      };

      const response = await this.api.post('/api/extensions/synthesize', synthesisRequest);

      console.log('✅ Solution synthesis successful');
      console.log(`   Quality Score: ${response.data.qualityScore}/100`);
      console.log(`   Improvements suggested: ${response.data.improvementSuggestions?.length || 0}`);
      
      if (response.data.synthesizedCode) {
        console.log(`   Synthesized code length: ${response.data.synthesizedCode.length} characters`);
      }

    } catch (error) {
      throw new Error(`Solution synthesis failed: ${error.response?.data?.error || error.message}`);
    }
  }

  async testUsageAnalytics() {
    console.log('\n📊 Test 6: Usage Analytics');
    console.log('-'.repeat(40));

    try {
      const response = await this.api.get('/api/extensions/usage');

      console.log('✅ Usage analytics retrieved');
      console.log(`   Platform: ${response.data.platform}`);
      console.log(`   Request count: ${response.data.requestCount}`);
      console.log(`   Last used: ${response.data.lastUsed}`);
      console.log(`   Available features: ${Object.keys(response.data.features).join(', ')}`);

    } catch (error) {
      throw new Error(`Usage analytics failed: ${error.response?.data?.error || error.message}`);
    }
  }
}

// Run tests if called directly
if (require.main === module) {
  const tester = new ExtensionTester();
  tester.runTests().catch(error => {
    console.error('Test execution failed:', error);
    process.exit(1);
  });
}

module.exports = ExtensionTester;