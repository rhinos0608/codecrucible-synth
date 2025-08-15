import { SmitheryMCPServer } from './smithery-mcp-server.js';

async function testSmitheryIntegration() {
  console.log('Testing Smithery MCP Server Integration');
  
  // Test with invalid configuration
  console.log('\n1. Testing with invalid configuration:');
  const serverWithoutConfig = new SmitheryMCPServer({
    baseUrl: 'https://server.smithery.ai'
  });
  
  const toolsResult = await serverWithoutConfig.getServer().request(
    { method: 'tools/list', params: {} },
    ListToolsRequestSchema
  );
  
  console.log('Available tools:', toolsResult.tools.map((t: any) => t.name));
  
  try {
    const searchResult = await serverWithoutConfig.getServer().request(
      { 
        method: 'tools/call', 
        params: { 
          name: 'web_search_exa', 
          arguments: { 
            query: 'latest AI developments',
            numResults: 5
          } 
        } 
      },
      CallToolRequestSchema
    );
    
    console.log('Search result with invalid config:', searchResult.content[0].text);
  } catch (error) {
    console.log('Error with invalid config:', error.message);
  }
  
  console.log('\n2. Testing with valid configuration (if available):');
  // Test with valid configuration if available
  const serverWithConfig = new SmitheryMCPServer({
    apiKey: process.env.SMITHERY_API_KEY || '1f2853f9-af6e-4e69-814b-5f7e8cb65058',
    profile: process.env.SMITHERY_PROFILE || 'present-camel-oYMDcq',
    baseUrl: 'https://server.smithery.ai'
  });
  
  try {
    const searchResult = await serverWithConfig.getServer().request(
      { 
        method: 'tools/call', 
        params: { 
          name: 'web_search_exa', 
          arguments: { 
            query: 'latest AI developments',
            numResults: 5
          } 
        } 
      },
      CallToolRequestSchema
    );
    
    console.log('Search result with valid config:', searchResult.content[0].text);
  } catch (error) {
    console.log('Error with valid config (expected if API key is invalid):', error.message);
  }
}

// Run the test
testSmitheryIntegration();