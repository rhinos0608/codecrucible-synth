/**
 * LLM Connection Testing Script
 * Tests actual connections to Ollama and LM Studio
 */

console.log('🌐 CodeCrucible Synth - LLM Connection Testing\n');

// LLM Connection Tester
class LLMConnectionTester {
  constructor() {
    this.providers = {
      ollama: {
        endpoint: 'http://localhost:11434',
        healthEndpoint: '/api/tags',
        generateEndpoint: '/api/generate',
        available: false,
        models: [],
        latency: 0,
        error: null
      },
      lmstudio: {
        endpoint: 'http://localhost:1234', 
        healthEndpoint: '/v1/models',
        generateEndpoint: '/v1/completions',
        available: false,
        models: [],
        latency: 0,
        error: null
      }
    };
    this.testResults = [];
  }

  // Check if provider is running and accessible
  async checkProviderHealth(providerName) {
    const provider = this.providers[providerName];
    console.log(`🔍 Checking ${providerName} at ${provider.endpoint}...`);

    try {
      const startTime = Date.now();
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

      const response = await fetch(provider.endpoint + provider.healthEndpoint, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      const latency = Date.now() - startTime;

      if (response.ok) {
        const data = await response.json();
        provider.available = true;
        provider.latency = latency;
        provider.models = this.extractModels(data, providerName);
        
        console.log(`   ✅ ${providerName} is available (${latency}ms)`);
        console.log(`   📚 Found ${provider.models.length} models`);
        
        if (provider.models.length > 0) {
          const modelNames = provider.models.slice(0, 3).map(m => m.name || m.id || m);
          console.log(`   🤖 Models: ${modelNames.join(', ')}${provider.models.length > 3 ? '...' : ''}`);
        }
        
        return true;
      } else {
        provider.error = `HTTP ${response.status}: ${response.statusText}`;
        console.log(`   ❌ ${providerName} responded with error: ${provider.error}`);
        return false;
      }

    } catch (error) {
      provider.available = false;
      
      if (error.name === 'AbortError') {
        provider.error = 'Connection timeout (5s)';
        console.log(`   ⏰ ${providerName} connection timed out`);
      } else if (error.code === 'ECONNREFUSED') {
        provider.error = 'Connection refused - service not running';
        console.log(`   🚫 ${providerName} not running (connection refused)`);
      } else {
        provider.error = error.message;
        console.log(`   ❌ ${providerName} error: ${error.message}`);
      }
      
      return false;
    }
  }

  // Extract model information from provider response
  extractModels(data, providerName) {
    try {
      if (providerName === 'ollama') {
        return data.models || [];
      } else if (providerName === 'lmstudio') {
        return data.data || [];
      }
      return [];
    } catch (error) {
      console.log(`   ⚠️ Error parsing models for ${providerName}: ${error.message}`);
      return [];
    }
  }

  // Test basic text generation
  async testGeneration(providerName, prompt = 'Hello, how are you?') {
    const provider = this.providers[providerName];
    
    if (!provider.available) {
      console.log(`   ⏭️ Skipping generation test - ${providerName} not available`);
      return { success: false, error: 'Provider not available' };
    }

    console.log(`🎯 Testing text generation with ${providerName}...`);

    try {
      const startTime = Date.now();
      
      let requestBody;
      if (providerName === 'ollama') {
        const model = provider.models[0]?.name || 'llama2';
        requestBody = {
          model: model,
          prompt: prompt,
          stream: false,
          options: {
            temperature: 0.7,
            max_tokens: 100
          }
        };
      } else if (providerName === 'lmstudio') {
        const model = provider.models[0]?.id || 'local-model';
        requestBody = {
          model: model,
          prompt: prompt,
          max_tokens: 100,
          temperature: 0.7,
          stream: false
        };
      }

      console.log(`   📝 Using model: ${requestBody.model}`);
      console.log(`   💬 Prompt: "${prompt}"`);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout for generation

      const response = await fetch(provider.endpoint + provider.generateEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      const latency = Date.now() - startTime;

      if (response.ok) {
        const data = await response.json();
        const content = this.extractGeneratedContent(data, providerName);
        
        console.log(`   ✅ Generation successful (${latency}ms)`);
        console.log(`   📤 Response: "${content.substring(0, 100)}${content.length > 100 ? '...' : ''}"`);
        console.log(`   📊 Length: ${content.length} characters`);
        
        return {
          success: true,
          response: content,
          latency,
          model: requestBody.model,
          promptTokens: prompt.length,
          responseTokens: content.length
        };
      } else {
        const errorText = await response.text();
        console.log(`   ❌ Generation failed: HTTP ${response.status}`);
        console.log(`   📋 Error details: ${errorText.substring(0, 200)}`);
        
        return { 
          success: false, 
          error: `HTTP ${response.status}: ${errorText}`,
          latency
        };
      }

    } catch (error) {
      const latency = Date.now() - startTime;
      
      if (error.name === 'AbortError') {
        console.log(`   ⏰ Generation timed out after 30 seconds`);
        return { success: false, error: 'Generation timeout', latency };
      } else {
        console.log(`   ❌ Generation error: ${error.message}`);
        return { success: false, error: error.message, latency };
      }
    }
  }

  // Extract generated content from provider response
  extractGeneratedContent(data, providerName) {
    try {
      if (providerName === 'ollama') {
        return data.response || data.content || 'No content generated';
      } else if (providerName === 'lmstudio') {
        return data.choices?.[0]?.text || data.content || 'No content generated';
      }
      return 'Unknown response format';
    } catch (error) {
      return `Error parsing response: ${error.message}`;
    }
  }

  // Test streaming capabilities
  async testStreaming(providerName, prompt = 'Count from 1 to 5') {
    const provider = this.providers[providerName];
    
    if (!provider.available) {
      console.log(`   ⏭️ Skipping streaming test - ${providerName} not available`);
      return { success: false, error: 'Provider not available' };
    }

    console.log(`📡 Testing streaming with ${providerName}...`);

    try {
      let requestBody;
      if (providerName === 'ollama') {
        const model = provider.models[0]?.name || 'llama2';
        requestBody = {
          model: model,
          prompt: prompt,
          stream: true,
          options: { temperature: 0.7, max_tokens: 50 }
        };
      } else if (providerName === 'lmstudio') {
        const model = provider.models[0]?.id || 'local-model';
        requestBody = {
          model: model,
          prompt: prompt,
          max_tokens: 50,
          temperature: 0.7,
          stream: true
        };
      }

      const startTime = Date.now();
      const response = await fetch(provider.endpoint + provider.generateEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.log(`   ❌ Streaming failed: HTTP ${response.status} - ${errorText}`);
        return { success: false, error: `HTTP ${response.status}` };
      }

      // For this test, we'll just check if we get a streaming response
      // In a real implementation, you'd parse the stream
      const chunks = [];
      const reader = response.body?.getReader();
      
      if (reader) {
        let chunkCount = 0;
        const maxChunks = 5; // Limit for testing
        
        try {
          while (chunkCount < maxChunks) {
            const { done, value } = await reader.read();
            if (done) break;
            
            chunks.push(value);
            chunkCount++;
          }
        } finally {
          reader.releaseLock();
        }
      }

      const latency = Date.now() - startTime;
      console.log(`   ✅ Streaming test completed (${latency}ms)`);
      console.log(`   📦 Received ${chunks.length} chunks`);
      
      return {
        success: true,
        chunks: chunks.length,
        latency
      };

    } catch (error) {
      console.log(`   ❌ Streaming error: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  // Run comprehensive connection tests
  async runAllTests() {
    console.log('🧪 Running comprehensive LLM connection tests...\n');

    const testPrompts = [
      'Hello, how are you?',
      'Write a simple Python function to add two numbers',
      'Explain what TypeScript is in one sentence'
    ];

    for (const [providerName, provider] of Object.entries(this.providers)) {
      console.log(`\n🔧 Testing ${providerName.toUpperCase()} Provider`);
      console.log('='.repeat(40));

      // Health check
      const isHealthy = await this.checkProviderHealth(providerName);
      
      if (isHealthy) {
        // Test generation with multiple prompts
        for (const [index, prompt] of testPrompts.entries()) {
          console.log(`\n📝 Test ${index + 1}: "${prompt}"`);
          const result = await this.testGeneration(providerName, prompt);
          this.testResults.push({
            provider: providerName,
            test: `generation-${index + 1}`,
            success: result.success,
            latency: result.latency,
            prompt,
            error: result.error
          });
        }

        // Test streaming
        console.log('\n📡 Streaming Test');
        const streamResult = await this.testStreaming(providerName);
        this.testResults.push({
          provider: providerName,
          test: 'streaming',
          success: streamResult.success,
          latency: streamResult.latency,
          error: streamResult.error
        });

      } else {
        this.testResults.push({
          provider: providerName,
          test: 'health-check',
          success: false,
          error: provider.error
        });
      }
    }

    console.log('\n');
    this.generateReport();
  }

  // Generate comprehensive test report
  generateReport() {
    console.log('📊 LLM Connection Test Report');
    console.log('=============================\n');

    // Provider availability
    console.log('🌐 Provider Availability:');
    for (const [name, provider] of Object.entries(this.providers)) {
      const status = provider.available ? '✅ ONLINE' : '❌ OFFLINE';
      const latency = provider.available ? ` (${provider.latency}ms)` : '';
      const models = provider.available ? ` - ${provider.models.length} models` : '';
      const error = !provider.available && provider.error ? ` - ${provider.error}` : '';
      
      console.log(`   ${name}: ${status}${latency}${models}${error}`);
    }

    // Test results summary
    console.log('\n📈 Test Results:');
    const providerResults = {};
    
    for (const result of this.testResults) {
      if (!providerResults[result.provider]) {
        providerResults[result.provider] = { passed: 0, total: 0, avgLatency: 0, latencies: [] };
      }
      
      providerResults[result.provider].total++;
      if (result.success) {
        providerResults[result.provider].passed++;
        if (result.latency) {
          providerResults[result.provider].latencies.push(result.latency);
        }
      }
    }

    for (const [provider, stats] of Object.entries(providerResults)) {
      const successRate = ((stats.passed / stats.total) * 100).toFixed(1);
      const avgLatency = stats.latencies.length > 0 
        ? (stats.latencies.reduce((a, b) => a + b, 0) / stats.latencies.length).toFixed(0)
        : 'N/A';
      
      console.log(`   ${provider}: ${stats.passed}/${stats.total} tests passed (${successRate}%)`);
      if (avgLatency !== 'N/A') {
        console.log(`     Average latency: ${avgLatency}ms`);
      }
    }

    // Detailed failures
    const failures = this.testResults.filter(r => !r.success);
    if (failures.length > 0) {
      console.log('\n❌ Failed Tests:');
      failures.forEach(failure => {
        console.log(`   ${failure.provider} - ${failure.test}: ${failure.error}`);
      });
    }

    // Recommendations
    console.log('\n💡 Recommendations:');
    
    const availableProviders = Object.values(this.providers).filter(p => p.available).length;
    const totalProviders = Object.keys(this.providers).length;
    
    if (availableProviders === 0) {
      console.log('   ❌ No LLM providers are available');
      console.log('   📋 Please install and start Ollama or LM Studio:');
      console.log('     • Ollama: https://ollama.ai/');
      console.log('     • LM Studio: https://lmstudio.ai/');
    } else if (availableProviders === 1) {
      console.log('   ⚠️ Only one provider available - consider setting up a backup');
      console.log('   🔄 Having multiple providers enables fallback and load balancing');
    } else {
      console.log('   ✅ Multiple providers available - good redundancy');
      console.log('   🎯 System can use intelligent routing between providers');
    }

    // Performance insights
    const allLatencies = this.testResults
      .filter(r => r.success && r.latency)
      .map(r => r.latency);
    
    if (allLatencies.length > 0) {
      const minLatency = Math.min(...allLatencies);
      const maxLatency = Math.max(...allLatencies);
      const avgLatency = allLatencies.reduce((a, b) => a + b, 0) / allLatencies.length;
      
      console.log(`\n⚡ Performance Summary:`);
      console.log(`   Fastest response: ${minLatency}ms`);
      console.log(`   Slowest response: ${maxLatency}ms`);
      console.log(`   Average response: ${avgLatency.toFixed(0)}ms`);
      
      if (avgLatency < 1000) {
        console.log('   🚀 Excellent response times');
      } else if (avgLatency < 3000) {
        console.log('   ✅ Good response times');
      } else {
        console.log('   ⚠️ Slow response times - check system resources');
      }
    }

    console.log('\n🎉 LLM connection testing completed!');
  }
}

// Run the tests
async function runLLMTests() {
  const tester = new LLMConnectionTester();
  await tester.runAllTests();
}

runLLMTests().catch(console.error);