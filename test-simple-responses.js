#!/usr/bin/env node

/**
 * Simple Response Test for CodeCrucible AI Agent
 * Tests the agent with basic prompts to verify loop fixes and performance
 */

const { spawn } = require('child_process');
const path = require('path');

async function testSimpleResponse() {
  console.log('🧪 Testing AI Agent - Simple Response Test');
  console.log('═'.repeat(50));
  
  const testCases = [
    {
      name: 'Basic Greeting',
      prompt: 'Hello',
      expectedDuration: 10000, // 10 seconds max
    },
    {
      name: 'Simple Question',
      prompt: 'What is 2+2?',
      expectedDuration: 15000, // 15 seconds max
    },
    {
      name: 'Code Request',
      prompt: 'Write a simple hello world function',
      expectedDuration: 20000, // 20 seconds max
    }
  ];

  for (const test of testCases) {
    console.log(`\n🎯 Testing: ${test.name}`);
    console.log(`📝 Prompt: "${test.prompt}"`);
    console.log('⏱️  Starting timer...');
    
    const startTime = Date.now();
    let completed = false;
    let output = '';
    let hasResponse = false;

    // Create a promise that resolves when we get meaningful output
    const testPromise = new Promise((resolve, reject) => {
      // Set a timeout
      const timeout = setTimeout(() => {
        if (!completed) {
          completed = true;
          reject(new Error(`Timeout after ${test.expectedDuration}ms`));
        }
      }, test.expectedDuration);

      // Spawn the agent process
      const agentProcess = spawn('node', ['src/main.ts'], {
        cwd: process.cwd(),
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let outputBuffer = '';
      let errorBuffer = '';

      agentProcess.stdout.on('data', (data) => {
        const chunk = data.toString();
        outputBuffer += chunk;
        
        // Look for meaningful response indicators
        if (chunk.includes('Generated response') || 
            chunk.includes('Response:') || 
            chunk.includes('assistant:') ||
            chunk.length > 50) {
          hasResponse = true;
        }
        
        // If we get a substantial response, consider it successful
        if (hasResponse && outputBuffer.length > 100) {
          if (!completed) {
            completed = true;
            clearTimeout(timeout);
            agentProcess.kill();
            resolve({
              success: true,
              output: outputBuffer,
              duration: Date.now() - startTime
            });
          }
        }
      });

      agentProcess.stderr.on('data', (data) => {
        errorBuffer += data.toString();
      });

      agentProcess.on('close', (code) => {
        if (!completed) {
          completed = true;
          clearTimeout(timeout);
          if (code === 0 && hasResponse) {
            resolve({
              success: true,
              output: outputBuffer,
              duration: Date.now() - startTime
            });
          } else {
            reject(new Error(`Process exited with code ${code}. Error: ${errorBuffer}`));
          }
        }
      });

      agentProcess.on('error', (error) => {
        if (!completed) {
          completed = true;
          clearTimeout(timeout);
          reject(error);
        }
      });

      // Send the prompt
      setTimeout(() => {
        agentProcess.stdin.write(test.prompt + '\n');
      }, 2000); // Give it 2 seconds to initialize
    });

    try {
      const result = await testPromise;
      const duration = result.duration;
      
      console.log(`✅ Success! Duration: ${duration}ms`);
      console.log(`📊 Performance: ${duration < test.expectedDuration ? 'GOOD' : 'SLOW'}`);
      console.log(`📄 Output preview: ${result.output.substring(0, 200)}...`);
      
      if (duration > test.expectedDuration) {
        console.log(`⚠️  Warning: Response took longer than expected (${test.expectedDuration}ms)`);
      }
      
    } catch (error) {
      console.log(`❌ Failed: ${error.message}`);
      console.log(`⏱️  Duration: ${Date.now() - startTime}ms`);
      
      // Check for specific loop indicators
      if (error.message.includes('Timeout')) {
        console.log('🔄 Possible infinite loop detected');
      }
    }
  }
  
  console.log('\n🏁 Simple Response Test Complete');
  console.log('═'.repeat(50));
}

async function checkAgentStatus() {
  console.log('\n🔍 Checking Agent Status...');
  
  // Check if model services are running
  const { exec } = require('child_process');
  
  return new Promise((resolve) => {
    exec('netstat -an | findstr ":11434\\|:1234"', (error, stdout) => {
      if (stdout.includes(':11434')) {
        console.log('✅ Ollama service detected on port 11434');
      } else {
        console.log('❌ Ollama service not detected on port 11434');
      }
      
      if (stdout.includes(':1234')) {
        console.log('✅ LM Studio service detected on port 1234');
      } else {
        console.log('❌ LM Studio service not detected on port 1234');
      }
      
      resolve();
    });
  });
}

async function main() {
  try {
    await checkAgentStatus();
    await testSimpleResponse();
    
    console.log('\n💡 Tips for better performance:');
    console.log('• Use smaller models like gemma:7b or llama3.2:latest');
    console.log('• Ensure only one model service is running');
    console.log('• Keep prompts simple for initial testing');
    console.log('• Monitor CPU/GPU usage during responses');
    
  } catch (error) {
    console.error('Test failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { testSimpleResponse, checkAgentStatus };
