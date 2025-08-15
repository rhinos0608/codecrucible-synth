import { LocalModelClient } from './src/core/local-model-client.js';

async function testModel() {
  console.log('Testing model connection...');
  
  const modelClient = new LocalModelClient({
    endpoint: 'http://localhost:11434',
    model: 'llama3.2:latest',
    timeout: 30000,
    maxTokens: 4096,
    temperature: 0.7
  });
  
  try {
    console.log('Checking connection...');
    const isConnected = await modelClient.checkConnection();
    console.log('Connected:', isConnected);
    
    if (isConnected) {
      console.log('Getting available models...');
      const models = await modelClient.getAvailableModels();
      console.log('Available models:', models);
      
      console.log('Testing model generation...');
      const response = await modelClient.generate('Hello, world!');
      console.log('Response:', response);
    }
  } catch (error) {
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
  }
}

testModel();