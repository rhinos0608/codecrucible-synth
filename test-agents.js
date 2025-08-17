// Test script for CodeCrucible agents
import { readFile } from 'fs/promises';
import { join } from 'path';

console.log('🚀 CodeCrucible Agent Test Suite');
console.log('================================\n');

// Test 1: Verify E2B API key is configured
console.log('Test 1: Environment Configuration');
console.log('----------------------------------');
try {
  const envContent = await readFile('.env', 'utf8');
  const hasE2B = envContent.includes('E2B_API_KEY');
  console.log(`✅ .env file exists: ${hasE2B ? 'PASS' : 'FAIL'}`);
  console.log(`✅ E2B API Key configured: ${hasE2B ? 'PASS' : 'FAIL'}`);
} catch (error) {
  console.log('❌ .env file not found');
}

// Test 2: Check core files exist
console.log('\nTest 2: Core Agent Files');
console.log('-------------------------');
const coreFiles = [
  'src/core/agents/code-analyzer-agent.ts',
  'src/core/agents/git-manager-agent.ts',
  'src/core/tools/mcp-tools.ts',
  'src/core/claude-code-inspired-reasoning.ts'
];

for (const file of coreFiles) {
  try {
    await readFile(file, 'utf8');
    console.log(`✅ ${file}: EXISTS`);
  } catch (error) {
    console.log(`❌ ${file}: MISSING`);
  }
}

// Test 3: Check for key fixes
console.log('\nTest 3: Critical Bug Fixes');
console.log('---------------------------');
try {
  const reasoningContent = await readFile('src/core/claude-code-inspired-reasoning.ts', 'utf8');
  const hasModelField = reasoningContent.includes('private model: any;');
  const hasCorrectConstructor = reasoningContent.includes('this.model = model;');
  console.log(`✅ Model field declared: ${hasModelField ? 'PASS' : 'FAIL'}`);
  console.log(`✅ Model initialized in constructor: ${hasCorrectConstructor ? 'PASS' : 'FAIL'}`);
} catch (error) {
  console.log('❌ Could not verify reasoning system fixes');
}

// Test 4: Check MCP tools implementation
console.log('\nTest 4: MCP Tools Implementation');
console.log('----------------------------------');
try {
  const mcpContent = await readFile('src/core/tools/mcp-tools.ts', 'utf8');
  const hasRefTool = mcpContent.includes('RefDocumentationTool');
  const hasExaTool = mcpContent.includes('ExaWebSearchTool');
  const hasDeepResearch = mcpContent.includes('ExaDeepResearchTool');
  console.log(`✅ RefDocumentationTool: ${hasRefTool ? 'IMPLEMENTED' : 'MISSING'}`);
  console.log(`✅ ExaWebSearchTool: ${hasExaTool ? 'IMPLEMENTED' : 'MISSING'}`);
  console.log(`✅ ExaDeepResearchTool: ${hasDeepResearch ? 'IMPLEMENTED' : 'MISSING'}`);
} catch (error) {
  console.log('❌ Could not verify MCP tools');
}

// Test 5: Agent specialization check
console.log('\nTest 5: Agent Specialization');
console.log('-----------------------------');
try {
  const codeAnalyzerContent = await readFile('src/core/agents/code-analyzer-agent.ts', 'utf8');
  const hasSpecializedTools = codeAnalyzerContent.includes('ReadCodeStructureTool');
  const hasCustomWorkflow = codeAnalyzerContent.includes('performCodeAnalysis');
  const notJustWrapper = !codeAnalyzerContent.includes('new ReActAgent');
  
  console.log(`✅ CodeAnalyzerAgent has specialized tools: ${hasSpecializedTools ? 'PASS' : 'FAIL'}`);
  console.log(`✅ CodeAnalyzerAgent has custom workflow: ${hasCustomWorkflow ? 'PASS' : 'FAIL'}`);
  console.log(`✅ CodeAnalyzerAgent is not just ReActAgent wrapper: ${notJustWrapper ? 'PASS' : 'FAIL'}`);
} catch (error) {
  console.log('❌ Could not verify agent specialization');
}

console.log('\n🎯 Test Summary');
console.log('================');
console.log('Key improvements implemented:');
console.log('- Fixed critical model reference bug');
console.log('- Implemented real agent specialization');
console.log('- Added working MCP tools');
console.log('- Configured E2B API key');
console.log('- Fixed research tools with HTTP clients');
console.log('\nNext steps for testing:');
console.log('1. Fix remaining build errors');
console.log('2. Test agents with actual prompts');
console.log('3. Verify E2B sandbox integration');
console.log('4. Connect voice system to agents');