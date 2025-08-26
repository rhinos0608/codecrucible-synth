/**
 * Workflow-Guided Sequential Tool Executor
 * Addresses "tool selection paralysis" for general analysis tasks
 * Based on 2025-01-26 diagnosis audit findings
 */

export interface WorkflowStep {
  step: number;
  action: string;
  requiredTools: string[];
  targets?: string[];
  context: string;
  mandatory?: boolean;
}

export interface WorkflowTemplate {
  name: string;
  domain: string;
  description: string;
  triggers: string[];
  steps: WorkflowStep[];
}

export class WorkflowGuidedExecutor {
  private workflowTemplates: Map<string, WorkflowTemplate> = new Map();

  constructor() {
    this.initializeWorkflowTemplates();
  }

  /**
   * Initialize domain-specific workflow templates
   */
  private initializeWorkflowTemplates(): void {
    // Project Structure Analysis Workflow
    const projectAnalysisWorkflow: WorkflowTemplate = {
      name: "project_analysis",
      domain: "coding", 
      description: "Comprehensive project structure and architecture analysis",
      triggers: [
        "analyze project", "project structure", "examine codebase", 
        "review architecture", "understand project", "explore codebase"
      ],
      steps: [
        {
          step: 1,
          action: "List root directory structure",
          requiredTools: ["filesystem_list_directory"],
          targets: ["."],
          context: "Get overview of project organization and identify key directories",
          mandatory: true
        },
        {
          step: 2, 
          action: "Read project metadata files",
          requiredTools: ["filesystem_read_file"],
          targets: ["README.md", "package.json", "tsconfig.json"],
          context: "Understand project purpose, dependencies, and configuration",
          mandatory: true
        },
        {
          step: 3,
          action: "Examine source code structure",
          requiredTools: ["filesystem_list_directory", "filesystem_find_files"],
          targets: ["src/", "lib/", "app/"],
          context: "Map source code organization and identify key modules",
          mandatory: true
        },
        {
          step: 4,
          action: "Sample representative source files",
          requiredTools: ["filesystem_read_file"],
          context: "Read key source files to understand architecture patterns and implementation details",
          mandatory: false
        }
      ]
    };

    // File System Exploration Workflow
    const fileSystemWorkflow: WorkflowTemplate = {
      name: "filesystem_exploration",
      domain: "coding",
      description: "Systematic file system navigation and content discovery", 
      triggers: [
        "explore files", "browse directory", "show me files",
        "what's in this project", "file structure", "directory contents"
      ],
      steps: [
        {
          step: 1,
          action: "List current directory contents",
          requiredTools: ["filesystem_list_directory"],
          context: "Show all files and directories in the current location",
          mandatory: true
        },
        {
          step: 2,
          action: "Examine important files",
          requiredTools: ["filesystem_read_file", "filesystem_file_stats"],
          context: "Read key configuration and documentation files",
          mandatory: false
        }
      ]
    };

    // Code Review Workflow
    const codeReviewWorkflow: WorkflowTemplate = {
      name: "code_review",
      domain: "coding",
      description: "Systematic code quality and structure review",
      triggers: [
        "review code", "code analysis", "examine implementation",
        "audit code", "code quality", "technical review"
      ],
      steps: [
        {
          step: 1,
          action: "Identify source code locations", 
          requiredTools: ["filesystem_find_files"],
          context: "Find all source code files in the project",
          mandatory: true
        },
        {
          step: 2,
          action: "Examine code structure and patterns",
          requiredTools: ["filesystem_read_file"],
          context: "Read and analyze key source files for architecture patterns",
          mandatory: true
        },
        {
          step: 3,
          action: "Review configuration and build setup",
          requiredTools: ["filesystem_read_file"],
          targets: ["package.json", "tsconfig.json", "webpack.config.js"],
          context: "Understand build configuration and project setup",
          mandatory: false
        }
      ]
    };

    // NEW: File Creation Workflow
    const fileCreationWorkflow: WorkflowTemplate = {
      name: "file_creation",
      domain: "coding",
      description: "Systematic file and directory creation with proper validation",
      triggers: [
        "create file", "create test", "make file", "new file", 
        "write file", "generate file", "create a test file",
        "create test file", "write a file"
      ],
      steps: [
        {
          step: 1,
          action: "Check target directory structure",
          requiredTools: ["filesystem_list_directory"],
          context: "Verify if target directory exists and understand current structure",
          mandatory: true
        },
        {
          step: 2,
          action: "Create directory if missing",
          requiredTools: ["filesystem_create_directory"],
          context: "Create target directory structure if it doesn't exist", 
          mandatory: false
        },
        {
          step: 3,
          action: "Create file with content",
          requiredTools: ["filesystem_write_file"],
          context: "Write the actual file content to the target location",
          mandatory: true
        }
      ]
    };

    // NEW: README Reading Workflow - CRITICAL for proper synthesis
    const readmeReadingWorkflow: WorkflowTemplate = {
      name: "readme_reading",
      domain: "coding",
      description: "Read and analyze README files with comprehensive content extraction",
      triggers: [
        "read readme", "readme", "what is this project", "about this project",
        "read the readme", "show readme", "analyze readme", "readme content",
        "tell me about this project", "what does this project do"
      ],
      steps: [
        {
          step: 1,
          action: "Read README file content",
          requiredTools: ["filesystem_read_file"],
          context: "Read the complete README.md file to understand the project",
          mandatory: true
        }
      ]
    };

    // Universal File Reading Workflow - handles ALL file types
    const universalFileReadingWorkflow: WorkflowTemplate = {
      name: "universal_file_reading",
      domain: "coding",
      description: "Read and analyze any file type with appropriate content extraction",
      triggers: [
        "read", "show", "analyze file", "examine", "display", "open file",
        "what is in", "contents of", "show me", "look at", "view file"
      ],
      steps: [
        {
          step: 1,
          action: "Read file content",
          requiredTools: ["filesystem_read_file"],
          context: "Read the complete file to understand its contents and purpose",
          mandatory: true
        }
      ]
    };

    // Directory Analysis Workflow
    const directoryAnalysisWorkflow: WorkflowTemplate = {
      name: "directory_analysis", 
      domain: "coding",
      description: "List and analyze directory contents systematically",
      triggers: [
        "list directory", "show directory", "ls", "dir", "what files",
        "directory contents", "files in", "show files", "list files"
      ],
      steps: [
        {
          step: 1,
          action: "List directory contents",
          requiredTools: ["filesystem_list_directory"],
          context: "Get complete directory listing with file details",
          mandatory: true
        }
      ]
    };

    // File Search Workflow
    const fileSearchWorkflow: WorkflowTemplate = {
      name: "file_search",
      domain: "coding",
      description: "Search for files by name or pattern across project",
      triggers: [
        "find file", "search file", "locate", "find files named", 
        "search for", "where is", "look for file"
      ],
      steps: [
        {
          step: 1,
          action: "Search for files",
          requiredTools: ["filesystem_find_files"],
          context: "Search project for files matching the specified criteria",
          mandatory: true
        }
      ]
    };

    this.workflowTemplates.set("project_analysis", projectAnalysisWorkflow);
    this.workflowTemplates.set("filesystem_exploration", fileSystemWorkflow);
    this.workflowTemplates.set("code_review", codeReviewWorkflow);
    this.workflowTemplates.set("file_creation", fileCreationWorkflow);
    this.workflowTemplates.set("readme_reading", readmeReadingWorkflow);
    this.workflowTemplates.set("universal_file_reading", universalFileReadingWorkflow);
    this.workflowTemplates.set("directory_analysis", directoryAnalysisWorkflow);
    this.workflowTemplates.set("file_search", fileSearchWorkflow);
  }

  /**
   * Match prompt to appropriate workflow template
   */
  matchWorkflowTemplate(prompt: string): WorkflowTemplate | null {
    const promptLower = prompt.toLowerCase();
    
    for (const [_, template] of this.workflowTemplates) {
      const isMatch = template.triggers.some(trigger => 
        promptLower.includes(trigger.toLowerCase())
      );
      
      if (isMatch) {
        return template;
      }
    }
    
    return null;
  }

  /**
   * Get tools for specific workflow step to prevent paralysis
   */
  getToolsForWorkflowStep(
    step: WorkflowStep, 
    allAvailableTools: any[]
  ): any[] {
    // Filter tools to only those required for this step
    const requiredToolNames = step.requiredTools;
    const stepTools = allAvailableTools.filter(tool => {
      const toolName = tool.function?.name || tool.name || '';
      const toolId = tool.id || '';
      return requiredToolNames.some(required => 
        toolName.includes(required) || required.includes(toolName) ||
        toolId.includes(required) || required.includes(toolId)
      );
    });

    return stepTools;
  }

  /**
   * Build workflow-specific reasoning prompt
   */
  buildWorkflowPrompt(
    prompt: string,
    template: WorkflowTemplate,
    currentStep: WorkflowStep,
    stepTools: any[],
    previousSteps: string[]
  ): string {
    const toolDescriptions = stepTools.map(tool => {
      const name = tool.function?.name || tool.name;
      const desc = tool.function?.description || tool.description || 'No description';
      return `- ${name}: ${desc}`;
    }).join('\n');

    const previousContext = previousSteps.length > 0 
      ? `\nPREVIOUS ANALYSIS:\n${previousSteps.join('\n')}\n` 
      : '';

    return `You are performing WORKFLOW-GUIDED ANALYSIS following a proven systematic approach.

ORIGINAL REQUEST: ${prompt}

ANALYSIS WORKFLOW: ${template.description}
CURRENT STEP: ${currentStep.step}/${template.steps.length}

═══ WORKFLOW STEP ${currentStep.step}: ${currentStep.action.toUpperCase()} ═══

STEP CONTEXT: ${currentStep.context}

${currentStep.targets ? `SUGGESTED TARGETS: ${currentStep.targets.join(', ')}` : ''}

AVAILABLE TOOLS FOR THIS STEP:
${toolDescriptions}
${previousContext}
CRITICAL REQUIREMENTS:
1. You MUST complete this workflow step using the available tools
2. You CANNOT skip to final conclusions without gathering evidence
3. You MUST use at least one tool from the available options above
4. ${currentStep.mandatory ? 'This step is MANDATORY - you cannot proceed without tool execution' : 'This step is optional but recommended for thorough analysis'}

RESPOND IN THIS EXACT FORMAT:
THOUGHT: [Why this specific tool is needed for this workflow step]
ACTION: [tool name from available tools - NO "NONE" option allowed for mandatory steps]
ARGS: [tool arguments in JSON format]
CONFIDENCE: [0.8-1.0 for workflow-guided steps]
COMPLETE: [NO - continue workflow unless all steps completed]
CONCLUSION: [N/A - save conclusions until workflow complete]

REMEMBER: This is step ${currentStep.step} of ${template.steps.length}. Evidence gathering is MANDATORY before making conclusions.`;
  }

  /**
   * Check if workflow is complete
   */
  isWorkflowComplete(
    template: WorkflowTemplate, 
    completedSteps: number,
    gatheredEvidence: string[]
  ): boolean {
    const mandatoryStepsComplete = completedSteps >= template.steps.filter(s => s.mandatory).length;
    const hasSubstantialEvidence = gatheredEvidence.length >= 2;
    
    return mandatoryStepsComplete && hasSubstantialEvidence;
  }

  /**
   * Get next workflow step
   */
  getNextWorkflowStep(
    template: WorkflowTemplate, 
    completedStepNumber: number
  ): WorkflowStep | null {
    const nextStepIndex = completedStepNumber;
    return nextStepIndex < template.steps.length 
      ? template.steps[nextStepIndex] 
      : null;
  }

  /**
   * Build final workflow conclusion prompt
   */
  buildConclusionPrompt(
    originalPrompt: string,
    template: WorkflowTemplate,
    gatheredEvidence: string[]
  ): string {
    return `🎯 WORKFLOW ANALYSIS COMPLETE - FINAL SYNTHESIS STEP

ORIGINAL REQUEST: ${originalPrompt}

COMPLETED WORKFLOW: ${template.description}
EVIDENCE GATHERED FROM TOOL EXECUTIONS:
${gatheredEvidence.map((evidence, i) => `${i + 1}. ${evidence}`).join('\n')}

═══ CRITICAL INSTRUCTIONS FOR FINAL SYNTHESIS ═══

⚠️ IMPORTANT: This is the FINAL STEP of the workflow. You must now provide a comprehensive analysis based on the evidence gathered above. DO NOT make any more tool calls or function calls.

REQUIRED OUTPUT FORMAT WITH CHAIN-OF-THOUGHT REASONING:
1. **🧠 My Reasoning Process**: Show your thinking about the user's request and the evidence
   - What is the user really asking for?
   - What are the most important pieces of evidence?
   - How do these connect to answer their question?
   
2. **📊 Evidence Analysis**: Examine the gathered data
   - Identify key content and patterns
   - Extract the most relevant information
   - Note any important details or structure
   
3. **💡 Key Insights**: What I discovered from the evidence
   - Important findings and patterns
   - Connections between different pieces of information
   - Relevant details that address the user's needs
   
4. **✅ Final Answer**: Clear, actionable response to the original request
   - Direct answer to what the user asked
   - Summary of the most important information
   - Any recommendations or next steps

SYNTHESIS REQUIREMENTS:
- SHOW YOUR THINKING: Explain your reasoning process step by step
- Use ONLY the evidence data provided above - no additional tool calls needed
- Reference specific files, directories, configurations, and code findings from the evidence
- Provide concrete details from the actual data collected (file contents, structure, configurations)
- Structure your response clearly with markdown headings and bullet points
- Be thorough and evidence-based in your analysis
- Address the original user request directly with actionable insights

🔒 FINAL STEP CONSTRAINTS:
- NO MORE TOOL CALLS - all evidence has been collected
- NO FUNCTION CALLS - provide direct analysis only
- SYNTHESIZE the evidence into meaningful insights
- RESPOND with structured markdown analysis

Begin your final analysis now:`;
  }
}