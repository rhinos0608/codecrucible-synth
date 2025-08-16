/**
 * Simplified ReAct prompts optimized for better JSON generation
 * Designed to work well with codellama and other coding models
 */

export class SimplifiedReActPrompts {
  
  static createSimplePrompt(
    toolDefinitions: Array<{name: string, description: string, parameters: any, examples?: string[]}>, 
    recentMessages: Array<{role: string, content: string}>,
    filesExplored: number
  ): string {
    // Enhanced context handling - show full tool results but limit user messages
    const conversation = recentMessages
      .slice(-6) // Include more history for better context
      .map(msg => {
        if (msg.role === 'tool') {
          // Show full tool results but truncate if extremely long
          const content = msg.content.length > 1000 ? 
            msg.content.slice(0, 1000) + '\n[...truncated for length...]' : 
            msg.content;
          return `TOOL RESULT: ${content}`;
        } else if (msg.role === 'assistant') {
          // Show assistant actions for context
          try {
            const parsed = JSON.parse(msg.content);
            return `PREVIOUS ACTION: ${parsed.thought} → Used ${parsed.tool}`;
          } catch {
            return `ASSISTANT: ${msg.content.slice(0, 100)}${msg.content.length > 100 ? '...' : ''}`;
          }
        } else {
          // User messages
          return `USER: ${msg.content.slice(0, 150)}${msg.content.length > 150 ? '...' : ''}`;
        }
      })
      .join('\n');

    // Generate comprehensive tool documentation
    const toolDocs = this.generateToolDocumentation(toolDefinitions);
    
    return `You are an expert coding assistant using the ReAct pattern. You systematically answer questions by:
1. REASONING about what information you need to answer the user's question
2. ACTING with the appropriate tool to get that information
3. OBSERVING the results and answering if you have enough information

CRITICAL RULES:
- FOCUS on answering the user's specific question, not general exploration
- If tool results contain the answer to the user's question, use "final_answer" immediately
- NEVER repeat the same tool call with identical parameters
- Don't explore beyond what's needed to answer the question
- Always provide valid JSON with correct parameter names and types

${toolDocs}

REQUIRED JSON FORMAT (respond with ONLY valid JSON):
{
  "thought": "Based on previous results, I need to...",
  "tool": "tool_name",
  "toolInput": {"param1": "value1", "param2": "value2"}
}

CONTEXT:
Files explored: ${filesExplored}

CONVERSATION HISTORY:
${conversation}

REMEMBER: If the tool results above contain the answer to the user's question, use "final_answer" with that answer immediately. Don't continue exploring unnecessarily.

Your next action (JSON only):`;
  }

  /**
   * Generate comprehensive tool documentation with parameters and examples
   */
  private static generateToolDocumentation(toolDefinitions: Array<{name: string, description: string, parameters: any, examples?: string[]}>): string {
    // Prioritize autonomous code analysis tools first for better file reading
    const autonomousTools = ['readCodeStructure', 'readFiles'];
    const basicTools = ['listFiles', 'readFile', 'writeFile', 'confirmedWrite', 'gitStatus', 'gitDiff'];
    const prioritizedTools = [];
    
    // Add autonomous tools first (they're more powerful for code analysis)
    for (const autonomousTool of autonomousTools) {
      const tool = toolDefinitions.find(t => t.name === autonomousTool);
      if (tool) prioritizedTools.push(tool);
    }
    
    // Add basic tools next
    for (const basicTool of basicTools) {
      const tool = toolDefinitions.find(t => t.name === basicTool);
      if (tool && !prioritizedTools.includes(tool)) prioritizedTools.push(tool);
    }
    
    // Add remaining tools (limit total to 10 to include more autonomous tools)
    const remainingTools = toolDefinitions.filter(t => 
      !autonomousTools.includes(t.name) && 
      !basicTools.includes(t.name)
    );
    prioritizedTools.push(...remainingTools.slice(0, 10 - prioritizedTools.length));
    
    const toolDocs = prioritizedTools.map(tool => {
      const params = this.extractParameterInfo(tool.parameters);
      const examples = tool.examples ? `\n    Examples: ${tool.examples.join(', ')}` : '';
      
      return `  "${tool.name}": ${tool.description}
    Parameters: ${params}${examples}`;
    }).join('\n');

    const priorityToolNames = prioritizedTools.slice(0, 7).map(t => `"${t.name}"`).join(', ');
    const allToolNames = toolDefinitions.map(t => `"${t.name}"`).join(', ');

    return `MOST POWERFUL TOOLS (start with these for code analysis):
${toolDocs}
  "final_answer": Provide final response when analysis is complete
    Parameters: {"answer": "your complete response"}

PRIORITY: For code analysis, use autonomous tools first: "readCodeStructure", "readFiles"
THEN: Use standard tools: ${priorityToolNames}
ALL AVAILABLE: ${allToolNames}, "final_answer"
CRITICAL: Use EXACT tool names only - do not modify or guess names.

AUTONOMOUS CODE ANALYSIS PATTERN:
1. When user asks about code structure/files → use "readCodeStructure" first
2. When user asks to read specific files → use "readFiles" with file list
3. For basic tasks → use standard tools like "listFiles", "readFile"`;
  }

  /**
   * Extract parameter information from Zod schema
   */
  private static extractParameterInfo(parameters: any): string {
    if (!parameters || !parameters.shape) {
      return "{}";
    }

    try {
      const paramNames = Object.keys(parameters.shape);
      const paramInfo = paramNames.map(name => {
        const field = parameters.shape[name];
        let type = 'string';
        
        if (field._def?.typeName) {
          switch (field._def.typeName) {
            case 'ZodString': type = 'string'; break;
            case 'ZodNumber': type = 'number'; break;
            case 'ZodBoolean': type = 'boolean'; break;
            case 'ZodObject': type = 'object'; break;
            case 'ZodArray': type = 'array'; break;
            default: type = 'string';
          }
        }

        return `"${name}": ${type}`;
      });

      return `{${paramInfo.join(', ')}}`;
    } catch (error) {
      return "{}";
    }
  }

  static createCodeAnalysisPrompt(
    availableTools: string[],
    workingDirectory: string,
    previousActions: string
  ): string {
    return `You are analyzing code. Use tools systematically. Respond with JSON only.

Tools: ${availableTools.join(', ')}

Format: {"thought": "plan", "tool": "name", "toolInput": {"param": "value"}}

Working dir: ${workingDirectory}
Previous: ${previousActions.slice(0, 200)}

JSON response:`;
  }

  static createErrorDiagnosisPrompt(
    tools: string[],
    errorContext: string
  ): string {
    return `Find and diagnose errors. JSON only.

Tools: ${tools.join(', ')}
Context: ${errorContext.slice(0, 150)}

Format: {"thought": "plan", "tool": "name", "toolInput": {}}

JSON:`;
  }
}

/**
 * Enhanced JSON parsing with better error recovery for simplified prompts
 */
export class SimplifiedJSONParser {
  
  static parseSimpleResponse(response: string): {thought: string, tool: string, toolInput: any} {
    try {
      // First try direct parsing
      const parsed = JSON.parse(response);
      if (parsed.thought && parsed.tool && parsed.toolInput) {
        // Apply typo correction to tool name
        const correctedTool = this.fixCommonToolNameTypos(parsed.tool);
        return {
          thought: parsed.thought,
          tool: correctedTool,
          toolInput: parsed.toolInput
        };
      }
    } catch (e) {
      // Continue to fallback strategies
    }

    // Strategy 1: Extract JSON from response
    const jsonMatch = response.match(/\{[\s\S]*?\}/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        if (parsed.tool && parsed.toolInput) {
          const correctedTool = this.fixCommonToolNameTypos(parsed.tool);
          return {
            thought: parsed.thought || `Using ${correctedTool}`,
            tool: correctedTool,
            toolInput: parsed.toolInput
          };
        }
      } catch (e) {
        // Continue to next strategy
      }
    }

    // Strategy 2: Extract components using regex
    const thoughtMatch = response.match(/"thought":\s*"([^"]+)"/);
    const toolMatch = response.match(/"tool":\s*"([^"]+)"/);
    const inputMatch = response.match(/"toolInput":\s*(\{[^}]*\})/);

    if (toolMatch) {
      const thought = thoughtMatch ? thoughtMatch[1] : `Using ${toolMatch[1]}`;
      let toolInput = {};
      
      if (inputMatch) {
        try {
          toolInput = JSON.parse(inputMatch[1]);
        } catch (e) {
          // Use empty object if parsing fails
        }
      }

      const correctedTool = this.fixCommonToolNameTypos(toolMatch[1]);
      return {
        thought,
        tool: correctedTool,
        toolInput
      };
    }

    // Strategy 3: Intelligent defaults for common responses (prioritize autonomous tools)
    if (response.includes('readCodeStructure') || response.includes('code structure') || response.includes('analyze codebase')) {
      return {
        thought: "Analyzing codebase structure autonomously",
        tool: "readCodeStructure",
        toolInput: { path: ".", maxFiles: 50, includeContent: false }
      };
    }

    if (response.includes('readFiles') || response.includes('read multiple files') || response.includes('intelligent file reading')) {
      return {
        thought: "Reading multiple files with intelligent analysis",
        tool: "readFiles",
        toolInput: { files: ["src"], maxFiles: 20, includeMetadata: true, extractDefinitions: true }
      };
    }

    if (response.includes('listFiles') || response.includes('list files')) {
      return {
        thought: "Listing files to understand structure",
        tool: "listFiles",
        toolInput: { path: "." }
      };
    }

    if (response.includes('readFile') || response.includes('read file')) {
      return {
        thought: "Reading file for analysis",
        tool: "readFile", 
        toolInput: { path: "package.json" }
      };
    }

    if (response.includes('gitStatus') || response.includes('git status')) {
      return {
        thought: "Checking git status",
        tool: "gitStatus",
        toolInput: {}
      };
    }

    if (response.includes('final') || response.includes('complete') || response.includes('done')) {
      return {
        thought: "Analysis complete",
        tool: "final_answer",
        toolInput: { answer: "Analysis completed based on available information." }
      };
    }

    // Last resort: default action
    throw new Error(`Could not parse response: ${response.slice(0, 200)}`);
  }

  static validateAndFixToolInput(tool: string, input: any): any {
    // Ensure input is an object
    const safeInput = input && typeof input === 'object' ? input : {};
    
    // Common fixes for tool inputs
    switch (tool) {
      case 'readCodeStructure':
        return {
          path: safeInput.path || safeInput.directory || safeInput.folder || ".",
          maxFiles: safeInput.maxFiles || 50,
          includeContent: safeInput.includeContent || false
        };
      
      case 'readFiles':
        return {
          files: safeInput.files || safeInput.paths || ["src"],
          maxFiles: safeInput.maxFiles || 20,
          includeMetadata: safeInput.includeMetadata !== false,
          extractDefinitions: safeInput.extractDefinitions !== false,
          maxFileSize: safeInput.maxFileSize || 200000
        };
      
      case 'listFiles':
        return { 
          path: safeInput.path || safeInput.directory || safeInput.folder || "." 
        };
      
      case 'readFile':
        return { 
          path: safeInput.path || safeInput.file || safeInput.filename || "package.json" 
        };
      
      case 'searchFiles':
        return { 
          pattern: safeInput.pattern || safeInput.query || safeInput.search || "*.js",
          path: safeInput.path || safeInput.directory || safeInput.folder || "."
        };
      
      case 'gitStatus':
      case 'gitDiff':
        return {};
      
      case 'lintCode':
      case 'getAst':
        return { 
          path: safeInput.path || safeInput.file || safeInput.filename || "src/index.ts" 
        };
      
      case 'final_answer':
        return { 
          answer: safeInput.answer || safeInput.response || safeInput.result || "Analysis completed." 
        };
      
      default:
        // For unknown tools, ensure we return a valid object
        return safeInput;
    }
  }

  static fixCommonToolNameTypos(toolName: string): string {
    // Fix common typos in tool names
    const corrections: Record<string, string> = {
      'searchhFile': 'searchFiles',
      'searchFile': 'searchFiles', 
      'readfiles': 'readFiles',
      'listfiles': 'listFiles',
      'gitSatus': 'gitStatus',
      'final-answer': 'final_answer',
      'finalAnswer': 'final_answer'
    };
    
    return corrections[toolName] || toolName;
  }
}