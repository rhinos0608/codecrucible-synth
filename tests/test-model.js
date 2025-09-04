const axios = require('axios');

async function testOllama() {
  console.log('Testing Ollama directly...');

  try {
    const response = await axios.post(
      'http://localhost:11434/api/generate',
      {
        model: 'qwen2.5-coder:3b',
        prompt: 'What is 2+2?',
        stream: false,
      },
      {
        timeout: 10000,
      }
    );

    console.log('Response:', response.data.response);
    return response.data.response;
  } catch (error) {
    console.error('Error:', error.message);
    return null;
  }
}

async function testUnifiedClient() {
  console.log('\nTesting UnifiedModelClient...');

  try {
    const { UnifiedModelClient } = require('./dist/core/client.js');

    const config = {
      providers: [
        {
          type: 'ollama',
          endpoint: 'http://localhost:11434',
          model: 'qwen2.5-coder:3b',
          timeout: 10000,
        },
      ],
      executionMode: 'sequential',
      fallbackChain: ['ollama'],
    };

    const client = new UnifiedModelClient(config);
    await client.initialize();

    console.log('Client initialized, calling generateText...');
    const result = await client.generateText('What is 2+2?', { timeout: 10000 });
    console.log('Result:', result);
    return result;
  } catch (error) {
    console.error('Error:', error.message);
    return null;
  }
}

async function main() {
  await testOllama();
  await testUnifiedClient();
}

main().catch(console.error);
