import { ConfigManager } from './src/config/config-manager.js';
import { MCPServerManager } from './src/mcp-servers/mcp-server-manager.js';

async function testSmitheryMCP() {
  try {
    // Load configuration
    const config = await ConfigManager.load();
    
    // Set Smithery configuration
    // Note: You'll need to set your actual API key and profile
    config.mcp.smithery = {
      apiKey: '1f2853f9-af6e-4e69-814b-5f7e8cb65058',
      profile: 'present-camel-oYMDcq',
      baseUrl: 'https://server.smithery.ai'
    };
    
    // Initialize MCP server manager
    const mcpManager = new MCPServerManager();
    await mcpManager.initialize(config.mcp);
    
    // Test web search tool
    console.log('Testing Smithery web search...');
    const searchResult = await mcpManager.callTool('smithery', 'web_search_exa', {
      query: 'latest AI developments',
      numResults: 5
    });
    
    console.log('Search result:', JSON.stringify(searchResult, null, 2));
    
    // Test server search tool
    console.log('\nTesting Smithery server search...');
    const serverResult = await mcpManager.callTool('smithery', 'search_servers', {
      query: 'web search',
      numResults: 3
    });
    
    console.log('Server search result:', JSON.stringify(serverResult, null, 2));
    
    // List all tools
    console.log('\nListing all tools...');
    const tools = await mcpManager.listTools();
    console.log('Available tools:', tools);
    
  } catch (error) {
    console.error('Error testing Smithery MCP server:', error);
  }
}

testSmitheryMCP();