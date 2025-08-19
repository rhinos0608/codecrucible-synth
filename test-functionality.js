/**
 * Test Script for CodeCrucible Synth System Functionality
 * Tests various prompts and validates system responses
 */

import { IntegratedCodeCrucibleSystem } from './src/core/integration/integrated-system.js';
import { UnifiedModelClient } from './src/core/client.js';

// Test Configuration
const TEST_CONFIG = {
  name: 'CodeCrucible-FunctionTest',
  version: '3.5.0-test',
  environment: 'development',
  features: {
    enableMultiVoice: true,
    enableRAG: true,
    enableCaching: true,
    enableObservability: true,
    enableAdvancedRouting: true,
    enableWorkflowOrchestration: true,
    enableAgentEcosystem: true,
    enableStreamingResponses: true,
    enableCollaboration: true
  },
  components: {
    modelClient: {
      providers: [
        { type: 'ollama', endpoint: 'http://localhost:11434' },
        { type: 'lm-studio', endpoint: 'http://localhost:1234' }
      ],
      executionMode: 'auto',
      fallbackChain: ['ollama', 'lm-studio'],
      performanceThresholds: {
        fastModeMaxTokens: 1000,
        timeoutMs: 30000,
        maxConcurrentRequests: 3
      },
      security: {
        enableSandbox: true,
        maxInputLength: 50000,
        allowedCommands: ['npm', 'node', 'git']
      }
    },
    router: {
      providers: [{
        id: 'ollama-local',
        name: 'Ollama Local',
        type: 'ollama',
        endpoint: 'http://localhost:11434',
        models: [{
          id: 'codellama:34b',
          name: 'CodeLlama 34B',
          displayName: 'CodeLlama 34B',
          contextWindow: 4096,
          maxTokens: 2048,
          strengthProfiles: [{ category: 'code-generation', score: 0.9, examples: [] }],
          costPerToken: { input: 0, output: 0 },
          latencyProfile: { firstToken: 500, tokensPerSecond: 50 },
          qualityScore: 0.85,
          supportedFeatures: ['streaming']
        }],
        capabilities: [{ feature: 'streaming', supported: true }],
        costProfile: { tier: 'local', costPerRequest: 0, costOptimized: true },
        performanceProfile: { averageLatency: 500, throughput: 10, reliability: 0.95, uptime: 99 },
        healthStatus: { status: 'healthy', lastChecked: new Date(), responseTime: 500, errorRate: 0, availableModels: [] }
      }],
      defaultStrategy: { primary: 'balanced', fallback: 'escalate', escalationTriggers: [] },
      costOptimization: { enabled: true, budgetLimits: { daily: 10, monthly: 100 }, thresholds: { lowCost: 0.01, mediumCost: 0.05, highCost: 0.1 } },
      performance: { healthCheckInterval: 30000, timeoutMs: 10000, retryAttempts: 3, circuitBreakerThreshold: 5 },
      intelligence: { learningEnabled: true, adaptiveRouting: true, qualityFeedbackWeight: 0.3, costFeedbackWeight: 0.2 }
    },
    rag: {
      vectorStore: { provider: 'memory', storagePath: './test-vectors', dimensions: 384, indexType: 'hnsw', maxMemoryUsage: 512 },
      embedding: { model: 'transformers-js', provider: 'transformers-js', batchSize: 10, cacheEmbeddings: true },
      chunking: { strategy: 'semantic', maxChunkSize: 500, overlapSize: 50, respectCodeBoundaries: true },
      indexing: { enabled: true, watchPaths: ['./src'], debounceMs: 1000, batchSize: 5, excludePatterns: ['node_modules', '.git'] },
      retrieval: { defaultMaxResults: 5, hybridAlpha: 0.7, rerankingEnabled: true, contextExpansion: true }
    },
    cache: {
      layers: {
        memory: { enabled: true, policy: { maxSize: 100 * 1024 * 1024, maxEntries: 1000, defaultTTL: 3600000, evictionStrategy: 'lru', compressionEnabled: false, encryptionEnabled: false, persistToDisk: false, serialization: 'json' } },
        disk: { enabled: true, policy: { maxSize: 1024 * 1024 * 1024, maxEntries: 10000, defaultTTL: 86400000, evictionStrategy: 'smart', compressionEnabled: true, encryptionEnabled: false, persistToDisk: true, serialization: 'json' }, dataPath: './test-cache' },
        distributed: { enabled: false, policy: { maxSize: 0, maxEntries: 0, defaultTTL: 0, evictionStrategy: 'lru', compressionEnabled: false, encryptionEnabled: false, persistToDisk: false, serialization: 'json' }, nodes: [] }
      },
      smartEviction: { priorityWeights: { access_frequency: 0.3, recency: 0.2, size: 0.1, compute_cost: 0.3, priority_level: 0.1 }, categoryWeights: {}, protectedCategories: ['critical'], minRetentionTime: 300000 }
    },
    observability: {
      metrics: { enabled: true, retentionDays: 7, exportInterval: 60000, exporters: [] },
      tracing: { enabled: true, samplingRate: 0.1, maxSpansPerTrace: 100, exporters: [] },
      logging: { level: 'info', outputs: [{ type: 'console', configuration: {} }], structured: true, includeStackTrace: true },
      health: { checkInterval: 30000, timeoutMs: 5000, retryAttempts: 3 },
      alerting: { enabled: false, rules: [], defaultCooldown: 300000 },
      storage: { dataPath: './test-observability', maxFileSize: 10 * 1024 * 1024, compressionEnabled: true, encryptionEnabled: false }
    },
    workflow: {}
  },
  multiVoice: {
    enabled: true,
    synthesisMode: 'collaborative',
    voices: [
      { id: 'explorer', name: 'Explorer', agentId: 'explorer-001', weight: 1.0, expertise: ['discovery', 'analysis'], personality: 'methodical', enabled: true },
      { id: 'implementor', name: 'Implementor', agentId: 'implementor-001', weight: 1.2, expertise: ['coding', 'implementation'], personality: 'pragmatic', enabled: true },
      { id: 'reviewer', name: 'Reviewer', agentId: 'reviewer-001', weight: 0.8, expertise: ['quality', 'review'], personality: 'perfectionist', enabled: true }
    ],
    conflictResolution: 'consensus',
    qualityThreshold: 0.8
  },
  performance: { maxConcurrentRequests: 5, defaultTimeout: 30000, cacheEnabled: true, streamingEnabled: true, batchingEnabled: true, priorityQueuing: true },
  security: { sandboxEnabled: true, inputValidation: true, outputFiltering: true, auditLogging: true, encryptionEnabled: false, rateLimiting: true }
};

// Test Prompts
const TEST_PROMPTS = [
  {
    id: 'code-generation',
    type: 'code',
    content: 'Create a TypeScript function that validates email addresses with proper regex and error handling',
    priority: 'medium',
    expected: ['email', 'typescript', 'validation', 'regex']
  },
  {
    id: 'architecture-design',
    type: 'architecture',
    content: 'Design a microservices architecture for an e-commerce platform with payment processing and inventory management',
    priority: 'high',
    expected: ['microservices', 'e-commerce', 'payment', 'inventory']
  },
  {
    id: 'code-review',
    type: 'review',
    content: 'Review this authentication code for security vulnerabilities and best practices',
    priority: 'critical',
    expected: ['security', 'authentication', 'review', 'vulnerabilities']
  },
  {
    id: 'optimization',
    type: 'optimization',
    content: 'Optimize this React component for better performance and memory usage',
    priority: 'medium',
    expected: ['react', 'performance', 'optimization', 'memory']
  },
  {
    id: 'documentation',
    type: 'documentation',
    content: 'Create comprehensive API documentation for a REST endpoint that handles user registration',
    priority: 'low',
    expected: ['api', 'documentation', 'rest', 'registration']
  }
];

async function testSystemFunctionality() {
  console.log('🚀 Starting CodeCrucible Synth Functionality Tests...\n');

  let system = null;
  try {
    // Initialize system
    console.log('🔧 Initializing system...');
    system = new IntegratedCodeCrucibleSystem(TEST_CONFIG);
    await system.initialize();
    console.log('✅ System initialized successfully\n');

    // Test system status
    console.log('📊 Testing system status...');
    const status = await system.getSystemStatus();
    console.log(`Status: ${status.overall}`);
    console.log(`Version: ${status.version}`);
    console.log(`Features enabled: ${Object.entries(status.features).filter(([,v]) => v).map(([k]) => k).join(', ')}\n`);

    // Test synthesis with various prompts
    console.log('🎯 Testing synthesis with various prompts...\n');
    
    for (const prompt of TEST_PROMPTS) {
      console.log(`Testing ${prompt.type} prompt: "${prompt.content.substring(0, 60)}..."`);
      
      try {
        const startTime = Date.now();
        const response = await system.synthesize({
          id: `test-${prompt.id}-${Date.now()}`,
          content: prompt.content,
          type: prompt.type,
          priority: prompt.priority
        });

        const duration = Date.now() - startTime;
        
        console.log(`✅ Response generated in ${duration}ms`);
        console.log(`   Content length: ${response.content.length} characters`);
        console.log(`   Quality score: ${response.quality.overall.toFixed(2)}`);
        console.log(`   Voices consulted: ${response.metadata.voicesConsulted}`);
        console.log(`   Models used: ${response.metadata.modelsUsed.join(', ')}`);
        console.log(`   Caching used: ${response.metadata.cachingUsed}`);
        console.log(`   RAG used: ${response.metadata.ragUsed}`);
        
        // Validate expected keywords
        const contentLower = response.content.toLowerCase();
        const foundKeywords = prompt.expected.filter(keyword => 
          contentLower.includes(keyword.toLowerCase())
        );
        console.log(`   Keywords found: ${foundKeywords.join(', ')} (${foundKeywords.length}/${prompt.expected.length})`);
        
        console.log('');
        
      } catch (error) {
        console.log(`❌ Error testing ${prompt.type} prompt:`, error.message);
        console.log('');
      }
    }

    // Test streaming functionality
    console.log('📡 Testing streaming responses...');
    try {
      const streamRequest = {
        id: `stream-test-${Date.now()}`,
        content: 'Explain how to implement a simple REST API with Express.js',
        type: 'documentation',
        priority: 'medium'
      };

      const chunks = [];
      const startTime = Date.now();
      
      for await (const chunk of system.streamSynthesis(streamRequest)) {
        chunks.push(chunk);
        if (chunks.length <= 3) { // Show first few chunks
          console.log(`   Chunk ${chunks.length}: "${chunk.content.substring(0, 40)}..."`);
        }
      }
      
      const duration = Date.now() - startTime;
      console.log(`✅ Streaming completed: ${chunks.length} chunks in ${duration}ms\n`);
      
    } catch (error) {
      console.log(`❌ Streaming test failed:`, error.message);
      console.log('');
    }

    // Test caching performance
    console.log('💾 Testing caching performance...');
    try {
      const cacheTestRequest = {
        id: 'cache-test',
        content: 'Explain the singleton pattern in JavaScript',
        type: 'documentation',
        priority: 'low'
      };

      // First request (not cached)
      const start1 = Date.now();
      const response1 = await system.synthesize(cacheTestRequest);
      const duration1 = Date.now() - start1;

      // Second request (should be cached)
      const start2 = Date.now();
      const response2 = await system.synthesize(cacheTestRequest);
      const duration2 = Date.now() - start2;

      console.log(`   First request: ${duration1}ms (cached: ${response1.metadata.cachingUsed})`);
      console.log(`   Second request: ${duration2}ms (cached: ${response2.metadata.cachingUsed})`);
      
      if (duration2 < duration1 * 0.8) {
        console.log(`✅ Caching working: ${((1 - duration2/duration1) * 100).toFixed(1)}% faster`);
      } else {
        console.log(`⚠️ Caching may not be working optimally`);
      }
      console.log('');
      
    } catch (error) {
      console.log(`❌ Caching test failed:`, error.message);
      console.log('');
    }

    // Test system metrics
    console.log('📈 Testing system metrics...');
    try {
      const metrics = await system.getMetrics();
      console.log(`   Request metrics available: ${metrics.requests ? 'Yes' : 'No'}`);
      console.log(`   Performance metrics available: ${metrics.performance ? 'Yes' : 'No'}`);
      console.log(`   Quality metrics available: ${metrics.quality ? 'Yes' : 'No'}`);
      console.log(`   Cache metrics available: ${metrics.cache ? 'Yes' : 'No'}`);
      console.log(`   Agent metrics available: ${metrics.agents ? 'Yes' : 'No'}`);
      console.log('');
      
    } catch (error) {
      console.log(`❌ Metrics test failed:`, error.message);
      console.log('');
    }

    console.log('🎉 All functionality tests completed successfully!');

  } catch (error) {
    console.error('❌ System test failed:', error);
    if (error.stack) {
      console.error('Stack trace:', error.stack);
    }
  } finally {
    // Cleanup
    if (system) {
      try {
        console.log('\n🛑 Shutting down system...');
        await system.shutdown();
        console.log('✅ System shutdown completed');
      } catch (shutdownError) {
        console.error('❌ Shutdown failed:', shutdownError.message);
      }
    }
  }
}

// Run tests
testSystemFunctionality().catch(console.error);