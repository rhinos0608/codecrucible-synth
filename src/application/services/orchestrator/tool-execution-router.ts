import type { WorkflowRequest } from '../../../domain/interfaces/workflow-orchestrator.js';
import type { ModelRequest, ModelResponse } from '../../../domain/interfaces/model-client.js';
import type { IMcpManager } from '../../../domain/interfaces/mcp-manager.js';
import type { IToolExecutionRouter } from '../../../domain/interfaces/tool-execution-router.js';
import { logger } from '../../../infrastructure/logging/logger.js';
import { getErrorMessage } from '../../../utils/error-utils.js';
import { getGlobalEnhancedToolIntegration } from '../../../infrastructure/tools/enhanced-tool-integration.js';

/**
 * Routes tool execution requests and handles follow-up model synthesis.
 */
export class ToolExecutionRouter implements IToolExecutionRouter {
  public constructor(private readonly mcpManager: IMcpManager) {}

  public async handleToolCalls(
    response: Readonly<ModelResponse>,
    request: Readonly<WorkflowRequest>,
    modelRequest: Readonly<ModelRequest>,
    processModelRequest: (req: Readonly<ModelRequest>) => Promise<ModelResponse>
  ): Promise<ModelResponse> {
    if (!response.toolCalls || response.toolCalls.length === 0) {
      return response;
    }

    logger.info(`🔧 AI model made ${response.toolCalls.length} tool calls`);
    const toolResults: Array<{ id: string; result: unknown; error?: string }> = [];

    for (const toolCall of response.toolCalls) {
      let parsedArgs: Record<string, unknown>;
      try {
        parsedArgs = JSON.parse(toolCall.function.arguments) as Record<string, unknown>;
      } catch (parseError) {
        logger.error(
          `❌ Failed to parse arguments for tool call ${toolCall.function.name}: ${getErrorMessage(parseError)}. Arguments: ${toolCall.function.arguments}`
        );
        toolResults.push({
          id: toolCall.id || toolCall.function.name,
          result: null,
          error: `Malformed tool arguments: ${getErrorMessage(parseError)}`,
        });
        continue;
      }
      try {
        let toolResult: unknown;

        // Try to use EnhancedToolIntegration for caching and performance benefits
        const enhancedIntegration = getGlobalEnhancedToolIntegration();

        if (enhancedIntegration) {
          // Route through EnhancedToolIntegration for caching, monitoring, and intelligent routing
          const toolCallObj = {
            id: toolCall.id || `${toolCall.function.name}_${Date.now()}`,
            function: {
              name: toolCall.function.name,
              arguments: JSON.stringify(parsedArgs),
            },
          };

          const context = {
            sessionId: request.context?.sessionId || request.id,
            priority: 'medium' as const,
            metadata: {
              workflowRequestId: request.id,
              originalContext: request.context,
            },
          };

          toolResult = await enhancedIntegration.executeToolCall(toolCallObj, context);
          logger.info(
            `✅ Tool call ${toolCall.function.name} executed via EnhancedToolIntegration`
          );
        } else {
          // Fallback to direct MCP manager execution
          toolResult = await this.mcpManager.executeTool(
            toolCall.function.name,
            parsedArgs,
            request.context
          );
          logger.info(`✅ Tool call ${toolCall.function.name} executed via MCP fallback`);
        }

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
    return processModelRequest(followUpRequest);
  }
}
