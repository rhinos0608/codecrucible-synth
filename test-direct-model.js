#!/usr/bin/env node

/**
 * Direct model test to isolate generation issue
 */

import fetch from 'node-fetch';

console.log('🧪 Testing direct Ollama generation...');

async function testOllamaGeneration() {
  try {
    console.log('Testing simple generation...');
    
    const response = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gemma:latest',
        prompt: 'Say hello',
        stream: false,
        options: {
          temperature: 0.7,
          max_tokens: 50
        }
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    console.log('✅ Generation successful:');
    console.log('Response:', result.response);
    console.log('Model:', result.model);
    console.log('Total duration:', result.total_duration);
    
    return result;
  } catch (error) {
    console.error('❌ Generation failed:', error.message);
    throw error;
  }
}

async function testStreamingGeneration() {
  try {
    console.log('\n🔄 Testing streaming generation...');
    
    const response = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gemma:latest',
        prompt: 'Write a simple hello world in Python',
        stream: true
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    console.log('📡 Streaming response:');
    let fullResponse = '';
    
    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      
      if (done) break;
      
      const chunk = decoder.decode(value);
      const lines = chunk.split('\n').filter(line => line.trim());
      
      for (const line of lines) {
        try {
          const data = JSON.parse(line);
          if (data.response) {
            process.stdout.write(data.response);
            fullResponse += data.response;
          }
          if (data.done) {
            console.log('\n✅ Streaming complete');
            return fullResponse;
          }
        } catch (parseError) {
          // Skip invalid JSON
        }
      }
    }
  } catch (error) {
    console.error('❌ Streaming failed:', error.message);
    throw error;
  }
}

async function main() {
  try {
    await testOllamaGeneration();
    await testStreamingGeneration();
    console.log('\n🎉 All direct model tests passed!');
  } catch (error) {
    console.error('\n💥 Direct model test failed:', error.message);
    process.exit(1);
  }
}

main().catch(console.error);