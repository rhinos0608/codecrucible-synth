import { WorkflowRequest } from '../../../domain/interfaces/workflow-orchestrator.js';
import { ModelRequest, ModelResponse } from '../../../domain/interfaces/model-client.js';
import { MCPServerManager } from '../../../mcp-servers/mcp-server-manager.js';
import { logger } from '../../../infrastructure/logging/logger.js';
import { getErrorMessage } from '../../../utils/error-utils.js';

/**
 * Routes tool execution requests and handles follow-up model synthesis.
 */
export class ToolExecutionRouter {
  constructor(private mcpManager: MCPServerManager) {}

  async handleToolCalls(
    response: ModelResponse,
    request: WorkflowRequest,
    modelRequest: ModelRequest,
    processModelRequest: (req: ModelRequest) => Promise<ModelResponse>
  ): Promise<ModelResponse> {
    if (!response.toolCalls || response.toolCalls.length === 0) {
      return response;
    }

    logger.info(`🔧 AI model made ${response.toolCalls.length} tool calls`);
    const toolResults: Array<{ id: string; result: any; error?: string }> = [];

    for (const toolCall of response.toolCalls) {
      try {
        const toolResult = await this.mcpManager.executeTool(
          toolCall.function.name,
          JSON.parse(toolCall.function.arguments),
          request.context
        );
        logger.info(`✅ Tool call ${toolCall.function.name} executed successfully`);
        toolResults.push({ id: toolCall.id || toolCall.function.name, result: toolResult });
      } catch (error) {
        logger.error(`❌ Tool call ${toolCall.function.name} failed:`, error);
        toolResults.push({
          id: toolCall.id || toolCall.function.name,
          result: null,
          error: getErrorMessage(error),
        });
      }
    }

    if (toolResults.length === 0) {
      return response;
    }

    const structuredMessages = [
      { role: 'user' as const, content: request.payload.input || request.payload.prompt },
      {
        role: 'assistant' as const,
        content: response.content || 'I need to use tools to help with this request.',
        tool_calls: response.toolCalls,
      },
      {
        role: 'tool' as const,
        content: JSON.stringify(toolResults, null, 2),
        tool_call_id: 'batch_results',
      },
    ];

    const followUpRequest: ModelRequest = {
      id: `${request.id}-structured-followup`,
      prompt: `User request: ${request.payload.input || request.payload.prompt}\n\nTool execution results are provided in the conversation history. Please provide a comprehensive, well-formatted response based on these results. Do not make any additional tool calls - just synthesize the information provided.`,
      model: modelRequest.model,
      temperature: modelRequest.temperature,
      maxTokens: modelRequest.maxTokens,
      tools: [],
      messages: structuredMessages,
      context: request.context,
    } as ModelRequest;

    logger.info(
      `🔄 Sending ${toolResults.length} tool results back to AI model for synthesis (STRUCTURED)`
    );
    return await processModelRequest(followUpRequest);
  }
}
