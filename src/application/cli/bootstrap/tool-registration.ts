import { logger } from '../../../infrastructure/logging/logger.js';

export async function bootstrapToolRegistration() {
  logger.info('Initializing MCP system...');
  const { bootstrapMcpServers } = await import('../../../mcp-servers/mcp-bootstrap.js');
  const mcpServerManager = await bootstrapMcpServers();

  if (mcpServerManager) {
    const { initializeGlobalToolIntegration } = await import(
      '../../../infrastructure/tools/tool-integration.js'
    );
    initializeGlobalToolIntegration(mcpServerManager);

    const { EnhancedToolIntegration, setGlobalEnhancedToolIntegration } = await import(
      '../../../infrastructure/tools/enhanced-tool-integration.js'
    );
    const enhancedIntegration = new EnhancedToolIntegration({});
    if (
      'setMcpServerManager' in enhancedIntegration &&
      typeof enhancedIntegration.setMcpServerManager === 'function'
    ) {
      enhancedIntegration.setMcpServerManager(mcpServerManager);
    }
    setGlobalEnhancedToolIntegration(enhancedIntegration);
  }

  return { mcpServerManager };
}

export default bootstrapToolRegistration;
