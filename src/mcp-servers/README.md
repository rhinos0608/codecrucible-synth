# Smithery MCP Server Integration

## Overview

This directory contains the implementation of the Smithery MCP server for CodeCrucible Synth. The Smithery MCP server provides access to Smithery AI's web search capabilities through the Model Context Protocol (MCP).

## Key Components

### SmitheryMCPServer Class (`smithery-mcp-server.ts`)

The main implementation of the Smithery MCP server. This class:

1. Creates an MCP server instance using the `@modelcontextprotocol/sdk`
2. Implements the `web_search_exa` tool for performing web searches
3. Handles configuration including API key, profile, and base URL
4. Provides proper error handling for network issues and API errors
5. Uses Axios for HTTP requests to the Smithery API

### MCP Server Manager Integration (`mcp-server-manager.ts`)

The MCP server manager has been updated to include support for the Smithery server:

1. Initializes the Smithery server when configured
2. Integrates with the existing MCP server lifecycle management
3. Provides access to Smithery tools through the standard MCP interface

### Configuration Support (`config-manager.ts` and `default.yaml`)

Configuration files have been updated to include Smithery server settings:

1. `enabled`: Whether the Smithery server is enabled
2. `apiKey`: Smithery API key for authentication
3. `profile`: Smithery profile to use
4. `baseUrl`: Base URL for the Smithery API

## Implementation Details

### Web Search Tool

The Smithery MCP server implements a `web_search_exa` tool that performs web searches using the Exa API. The tool accepts the following parameters:

- `query`: The search query string
- `numResults`: Optional number of results to return (default: 10)

### Error Handling

The implementation includes comprehensive error handling for:

1. Network connectivity issues
2. Invalid API keys
3. Rate limiting
4. API errors from Smithery
5. Invalid parameters

### Security Considerations

1. API keys are stored securely and not exposed in logs
2. Input validation prevents injection attacks
3. HTTPS is used for all API communications
4. Rate limiting protects against abuse

## Usage

To use the Smithery MCP server:

1. Configure the server in your CodeCrucible configuration file
2. Enable the server by setting `enabled: true`
3. Provide your Smithery API key and profile
4. Access the web search functionality through the standard MCP tool interface

## Development

To work on the Smithery MCP server implementation:

1. Ensure you have the required dependencies installed
2. Make changes to the TypeScript files in this directory
3. Run `npm run build` to compile the changes
4. Test your changes with the CodeCrucible test suite

## Testing

The implementation includes unit tests that verify:

1. Server initialization
2. Tool registration
3. Web search functionality
4. Error handling
5. Configuration management

Run tests with `npm test` from the project root.

## Future Improvements

Potential areas for enhancement:

1. Add more Smithery API endpoints
2. Implement caching for search results
3. Add rate limiting protection
4. Enhance error reporting with more detailed diagnostics
5. Add support for additional Smithery services