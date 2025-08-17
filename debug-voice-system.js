// Quick debug script for voice system
import { readFile } from 'fs/promises';

console.log('🔍 Voice System Debug');
console.log('===================\n');

try {
  // Test voice system functionality
  console.log('Testing voice recommendations:');
  
  // Simulate voice system logic
  const testPrompt = 'Create a secure authentication system with JWT tokens';
  const promptLower = testPrompt.toLowerCase();
  
  console.log(`Prompt: ${testPrompt}`);
  console.log(`Lower case: ${promptLower}`);
  
  const isAuthTask = /\b(auth|authentication|login|password|jwt|token|secure|security)\b/.test(promptLower);
  console.log(`Is auth task: ${isAuthTask}`);
  
  // Expected recommendations based on logic
  const expectedRecommendations = [];
  if (isAuthTask) {
    expectedRecommendations.push('security');
  }
  expectedRecommendations.push('explorer', 'maintainer');
  
  console.log(`Expected recommendations: ${expectedRecommendations.join(', ')}`);
  
  // Test voice properties
  console.log('\nVoice properties from config:');
  
  const expectedVoices = {
    explorer: {
      temperature: 0.9,
      style: 'experimental',
      systemPrompt: 'You are Explorer, focused on innovation and creative solutions. Always consider alternative approaches and edge cases.'
    },
    security: {
      temperature: 0.3,
      style: 'defensive', 
      systemPrompt: 'You are Security Engineer, focused on secure coding practices. Always include security considerations.'
    },
    maintainer: {
      temperature: 0.5,
      style: 'conservative',
      systemPrompt: 'You are Maintainer, focused on code stability and long-term maintenance. Prioritize robustness and best practices.'
    }
  };
  
  Object.entries(expectedVoices).forEach(([voice, props]) => {
    console.log(`${voice}:`, props);
  });
  
} catch (error) {
  console.error('Error:', error);
}

console.log('\n✅ Voice system debug completed');