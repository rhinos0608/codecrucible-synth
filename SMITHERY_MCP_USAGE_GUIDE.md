# Smithery MCP Server Integration Guide

## Overview

This guide explains how to use the Smithery MCP server integration in CodeCrucible Synth. The Smithery MCP server provides access to Smithery AI's web search capabilities through the Model Context Protocol (MCP).

## Prerequisites

Before using the Smithery MCP server, you'll need:

1. A Smithery AI account and API key
2. A Smithery profile configured for your use case
3. CodeCrucible Synth properly installed and configured

## Configuration

To enable the Smithery MCP server, you need to configure it in your CodeCrucible configuration file (`~/.codecrucible/config.yaml`):

```yaml
mcp:
  servers:
    smithery:
      enabled: true
      apiKey: "YOUR_SMITHERY_API_KEY"
      profile: "YOUR_SMITHERY_PROFILE"
      baseUrl: "https://server.smithery.ai"
```

Replace `YOUR_SMITHERY_API_KEY` and `YOUR_SMITHERY_PROFILE` with your actual Smithery credentials.

## Available Tools

The Smithery MCP server provides the following tools:

### `web_search_exa`

Performs a web search using the Exa API.

**Parameters:**
- `query` (string): The search query
- `numResults` (number, optional): Number of results to return (default: 10)

**Example:**
```json
{
  "name": "web_search_exa",
  "arguments": {
    "query": "latest developments in artificial intelligence",
    "numResults": 5
  }
}
```

## Usage Examples

### Command Line Usage

Once configured, you can use the Smithery tools through CodeCrucible's CLI:

```bash
# Example: Search for information about AI developments
codecrucible search "latest AI developments"

# Example: Use Smithery tools directly
codecrucible tool call web_search_exa --query "machine learning breakthroughs" --numResults 3
```

### Programmatic Usage

If you're integrating CodeCrucible into your own application, you can access the Smithery tools programmatically:

```javascript
import { MCPServerManager } from 'codecrucible-synth/mcp-servers';

// Initialize MCP server manager with Smithery configuration
const mcpManager = new MCPServerManager({
  smithery: {
    enabled: true,
    apiKey: 'YOUR_API_KEY',
    profile: 'YOUR_PROFILE',
    baseUrl: 'https://server.smithery.ai'
  }
});

// Perform a web search
const searchResult = await mcpManager.callTool('smithery', 'web_search_exa', {
  query: 'recent advances in natural language processing',
  numResults: 5
});
```

## Error Handling

The Smithery MCP server includes comprehensive error handling for various scenarios:

1. **Invalid API Key**: Returns an authentication error
2. **Network Issues**: Attempts to retry with exponential backoff
3. **Rate Limiting**: Respects Smithery's rate limits
4. **API Errors**: Parses and returns meaningful error messages

## Best Practices

1. **Secure Your Credentials**: Never commit your Smithery API key to version control
2. **Use Environment Variables**: Store sensitive information in environment variables
3. **Monitor Usage**: Keep track of your Smithery API usage to avoid unexpected charges
4. **Handle Errors Gracefully**: Always implement proper error handling when calling Smithery tools

## Troubleshooting

### "Invalid API Key" Error
- Verify your API key is correct
- Ensure your Smithery account is active
- Check that your API key has the necessary permissions

### "Connection Refused" Error
- Verify the Smithery server URL is correct
- Check your network connectivity
- Ensure there are no firewall rules blocking the connection

### "Rate Limited" Error
- Reduce the frequency of your requests
- Implement exponential backoff in your application
- Consider upgrading your Smithery plan for higher rate limits

## Support

For issues with the Smithery MCP server integration, please:

1. Check the CodeCrucible Synth documentation
2. Review the error messages and logs
3. Submit an issue on the CodeCrucible Synth GitHub repository

For issues with the Smithery API itself, please contact Smithery AI support.