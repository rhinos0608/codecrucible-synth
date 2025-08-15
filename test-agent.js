import { spawn } from 'child_process';
import { promises as fs } from 'fs';

async function testAgent() {
  console.log('🧪 Testing Enhanced Agent...');
  
  const child = spawn('node', ['dist/index.js', 'agent', '--enhanced'], {
    cwd: process.cwd(),
    stdio: ['pipe', 'pipe', 'pipe']
  });

  // Test question
  const testInput = 'what is this project about?\n';
  
  let output = '';
  
  child.stdout.on('data', (data) => {
    const text = data.toString();
    output += text;
    console.log('📤', text.trim());
  });
  
  child.stderr.on('data', (data) => {
    console.log('⚠️', data.toString().trim());
  });

  // Wait for agent to be ready (look for prompt)
  await new Promise(resolve => {
    const checkReady = () => {
      if (output.includes('🧠') || output.includes('Type your request')) {
        resolve();
      } else {
        setTimeout(checkReady, 500);
      }
    };
    checkReady();
  });

  console.log('🎯 Sending test question...');
  child.stdin.write(testInput);
  
  // Wait for response
  await new Promise(resolve => setTimeout(resolve, 15000));
  
  console.log('✅ Stopping agent...');
  child.stdin.write('exit\n');
  
  child.on('close', (code) => {
    console.log(`Agent exited with code ${code}`);
  });
}

testAgent().catch(console.error);