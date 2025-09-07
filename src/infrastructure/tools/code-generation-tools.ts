import { z } from 'zod';
import { BaseTool } from './base-tool.js';
import { promises as fs } from 'fs';
import { dirname, isAbsolute, join } from 'path';
import { UnifiedModelClient } from '../../application/services/client.js';

const GenerateCodeSchema = z.object({
  specification: z.string().describe('Natural language description of what code to generate'),
  language: z
    .enum(['typescript', 'javascript', 'python', 'java', 'cpp', 'csharp'])
    .default('typescript')
    .describe('Programming language to generate'),
  codeType: z
    .enum(['function', 'class', 'component', 'module', 'interface', 'type', 'hook', 'service'])
    .describe('Type of code structure to generate'),
  fileName: z.string().optional().describe('Optional file name to save the generated code'),
  context: z.string().optional().describe('Additional context about the project or existing code'),
});

export class CodeGeneratorTool extends BaseTool {
  private modelClient: UnifiedModelClient;

  constructor(
    private agentContext: { workingDirectory: string },
    modelClient: UnifiedModelClient
  ) {
    super({
      name: 'generateCode',
      description: 'Generates code from natural language specifications using AI',
      category: 'Code Generation',
      parameters: GenerateCodeSchema,
    });
    this.modelClient = modelClient;
  }

  async execute(args: z.infer<typeof GenerateCodeSchema>): Promise<string> {
    try {
      const { specification, language, codeType, fileName, context } = args;

      // Create a comprehensive prompt for code generation
      const codeGenPrompt = this.buildCodeGenerationPrompt(
        specification,
        language,
        codeType,
        context
      );

      // Generate code using the AI model
      const generatedCode = await this.modelClient.generateText(codeGenPrompt);

      // Extract clean code from the response
      const cleanCode = this.extractCodeFromResponse(generatedCode);

      // If fileName is provided, save the code to file
      if (fileName) {
        const filePath = this.resolvePath(fileName);
        await this.ensureDirectoryExists(filePath);
        await fs.writeFile(filePath, cleanCode, 'utf-8');

        return `Generated ${codeType} code and saved to ${fileName}:\n\n${cleanCode}`;
      }

      return `Generated ${codeType} code:\n\n${cleanCode}`;
    } catch (error) {
      return `Error generating code: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  }

  private buildCodeGenerationPrompt(
    specification: string,
    language: string,
    codeType: string,
    context?: string
  ): string {
    const languageTemplates = {
      typescript: this.getTypeScriptTemplate(codeType),
      javascript: this.getJavaScriptTemplate(codeType),
      python: this.getPythonTemplate(codeType),
      java: this.getJavaTemplate(codeType),
      cpp: this.getCppTemplate(codeType),
      csharp: this.getCSharpTemplate(codeType),
    };

    const template =
      languageTemplates[language as keyof typeof languageTemplates] || languageTemplates.typescript;

    return `You are an expert ${language} developer. Generate clean, production-ready ${codeType} code based on the following specification.

SPECIFICATION:
${specification}

LANGUAGE: ${language}
CODE TYPE: ${codeType}
${context ? `\nPROJECT CONTEXT:\n${context}` : ''}

REQUIREMENTS:
1. Write clean, readable, and well-documented code
2. Follow ${language} best practices and conventions
3. Include proper type annotations (if applicable)
4. Add comprehensive JSDoc/docstring comments
5. Handle errors appropriately
6. Use modern ${language} features
7. Ensure code is production-ready

TEMPLATE STRUCTURE:
${template}

Generate ONLY the code without explanations. Wrap the code in triple backticks with language specification.`;
  }

  private getTypeScriptTemplate(codeType: string): string {
    const templates = {
      function: `\`\`\`typescript
/**
 * [Function description]
 * @param [param] - [parameter description]
 * @returns [return description]
 */
export function functionName(param: Type): ReturnType {
  // Implementation
}
\`\`\``,
      class: `\`\`\`typescript
/**
 * [Class description]
 */
export class ClassName {
  private property: Type;

  constructor(param: Type) {
    // Constructor implementation
  }

  /**
   * [Method description]
   */
  public methodName(): ReturnType {
    // Method implementation
  }
}
\`\`\``,
      component: `\`\`\`typescript
import React from 'react';

interface ComponentProps {
  // Props interface
}

/**
 * [Component description]
 */
export const ComponentName: React.FC<ComponentProps> = ({ }) => {
  return (
    <div>
      {/* Component JSX */}
    </div>
  );
};

export default ComponentName;
\`\`\``,
      interface: `\`\`\`typescript
/**
 * [Interface description]
 */
export interface InterfaceName {
  // Interface properties
}
\`\`\``,
      type: `\`\`\`typescript
/**
 * [Type description]
 */
export type TypeName = {
  // Type definition
};
\`\`\``,
      hook: `\`\`\`typescript
import { useState, useEffect } from 'react';

/**
 * [Hook description]
 */
export const useHookName = () => {
  // Hook implementation
  
  return {
    // Return values
  };
};
\`\`\``,
      service: `\`\`\`typescript
/**
 * [Service description]
 */
export class ServiceName {
  /**
   * [Method description]
   */
  public async methodName(): Promise<ReturnType> {
    // Service implementation
  }
}

export const serviceInstance = new ServiceName();
\`\`\``,
      module: `\`\`\`typescript
/**
 * [Module description]
 */

// Exports
export { };
\`\`\``,
    };

    return templates[codeType as keyof typeof templates] || templates.function;
  }

  private getJavaScriptTemplate(codeType: string): string {
    const templates = {
      function: `\`\`\`javascript
/**
 * [Function description]
 * @param {Type} param - [parameter description]
 * @returns {Type} [return description]
 */
export function functionName(param) {
  // Implementation
}
\`\`\``,
      class: `\`\`\`javascript
/**
 * [Class description]
 */
export class ClassName {
  constructor(param) {
    // Constructor implementation
  }

  /**
   * [Method description]
   */
  methodName() {
    // Method implementation
  }
}
\`\`\``,
      component: `\`\`\`javascript
import React from 'react';

/**
 * [Component description]
 */
export const ComponentName = ({ }) => {
  return (
    <div>
      {/* Component JSX */}
    </div>
  );
};

export default ComponentName;
\`\`\``,
    };

    return templates[codeType as keyof typeof templates] || templates.function;
  }

  private getPythonTemplate(codeType: string): string {
    const templates = {
      function: `\`\`\`python
def function_name(param: Type) -> ReturnType:
    """
    [Function description]
    
    Args:
        param: [parameter description]
        
    Returns:
        [return description]
    """
    # Implementation
    pass
\`\`\``,
      class: `\`\`\`python
class ClassName:
    """[Class description]"""
    
    def __init__(self, param: Type):
        """Initialize the class."""
        # Constructor implementation
        pass
    
    def method_name(self) -> ReturnType:
        """[Method description]"""
        # Method implementation
        pass
\`\`\``,
    };

    return templates[codeType as keyof typeof templates] || templates.function;
  }

  private getJavaTemplate(codeType: string): string {
    const templates = {
      class: `\`\`\`java
/**
 * [Class description]
 */
public class ClassName {
    private Type property;

    /**
     * Constructor
     */
    public ClassName(Type param) {
        // Constructor implementation
    }

    /**
     * [Method description]
     */
    public ReturnType methodName() {
        // Method implementation
    }
}
\`\`\``,
    };

    return templates[codeType as keyof typeof templates] || templates.class;
  }

  private getCppTemplate(codeType: string): string {
    const templates = {
      class: `\`\`\`cpp
/**
 * [Class description]
 */
class ClassName {
private:
    Type property;

public:
    /**
     * Constructor
     */
    ClassName(Type param);

    /**
     * [Method description]
     */
    ReturnType methodName();
};
\`\`\``,
    };

    return templates[codeType as keyof typeof templates] || templates.class;
  }

  private getCSharpTemplate(codeType: string): string {
    const templates = {
      class: `\`\`\`csharp
/// <summary>
/// [Class description]
/// </summary>
public class ClassName
{
    private Type property;

    /// <summary>
    /// Constructor
    /// </summary>
    public ClassName(Type param)
    {
        // Constructor implementation
    }

    /// <summary>
    /// [Method description]
    /// </summary>
    public ReturnType MethodName()
    {
        // Method implementation
    }
}
\`\`\``,
    };

    return templates[codeType as keyof typeof templates] || templates.class;
  }

  private extractCodeFromResponse(response: string): string {
    // Extract code from markdown code blocks
    const codeBlockRegex = /```[\w]*\n([\s\S]*?)\n```/g;
    const matches = [];
    let match;

    while ((match = codeBlockRegex.exec(response)) !== null) {
      matches.push(match[1]);
    }

    if (matches.length > 0) {
      return matches.join('\n\n');
    }

    // If no code blocks found, return the response as-is
    return response.trim();
  }

  private async ensureDirectoryExists(filePath: string): Promise<void> {
    const dir = dirname(filePath);
    try {
      await fs.mkdir(dir, { recursive: true });
    } catch (error) {
      // Directory might already exist, ignore error
    }
  }

  private resolvePath(path: string): string {
    if (isAbsolute(path)) {
      return path;
    }
    return join(this.agentContext.workingDirectory, path);
  }
}

const ModifyCodeSchema = z.object({
  filePath: z.string().describe('Path to the file to modify'),
  modification: z.string().describe('Description of the modification to make'),
  preserveFormatting: z
    .boolean()
    .default(true)
    .describe('Whether to preserve existing code formatting'),
  createBackup: z
    .boolean()
    .default(true)
    .describe('Whether to create a backup before modification'),
});

export class CodeModifierTool extends BaseTool {
  private readonly modelClient: UnifiedModelClient;

  public constructor(
    private readonly agentContext: Readonly<{ workingDirectory: string }>,
    modelClient: UnifiedModelClient
  ) {
    super({
      name: 'modifyCode',
      description: 'Modifies existing code files based on natural language instructions',
      category: 'Code Modification',
      parameters: ModifyCodeSchema,
    });
    this.modelClient = modelClient;
  }

  public async execute(args: Readonly<z.infer<typeof ModifyCodeSchema>>): Promise<string> {
    try {
      const { filePath, modification, preserveFormatting, createBackup } = args;

      const fullPath = this.resolvePath(filePath);

      // Read the existing file
      const existingCode = await fs.readFile(fullPath, 'utf-8');

      // Create backup if requested
      if (createBackup) {
        const backupPath = `${fullPath}.backup.${Date.now()}`;
        await fs.writeFile(backupPath, existingCode, 'utf-8');
      }

      // Generate the modification prompt
      const modificationPrompt = this.buildModificationPrompt(
        existingCode,
        modification,
        preserveFormatting
      );

      // Get modified code from AI
      const modifiedResponse = await this.modelClient.generateText(modificationPrompt);
      const modifiedCode = this.extractCodeFromResponse(modifiedResponse);

      // Write the modified code back to the file
      await fs.writeFile(fullPath, modifiedCode, 'utf-8');

      return `Successfully modified ${filePath}. ${createBackup ? 'Backup created.' : ''}\n\nModification applied: ${modification}`;
    } catch (error) {
      return `Error modifying code: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  }

  private buildModificationPrompt(
    existingCode: string,
    modification: string,
    preserveFormatting: boolean
  ): string {
    return `You are an expert code editor. Modify the following code according to the specified instructions.

EXISTING CODE:
\`\`\`
${existingCode}
\`\`\`

MODIFICATION INSTRUCTIONS:
${modification}

REQUIREMENTS:
1. Apply ONLY the requested modification
2. Preserve all other functionality
3. Maintain code quality and best practices
4. ${preserveFormatting ? 'Preserve existing formatting and style' : 'Apply proper formatting'}
5. Keep existing imports and dependencies unless modification requires changes
6. Ensure the modified code is syntactically correct
7. Maintain existing error handling patterns

Return ONLY the complete modified code wrapped in triple backticks. Do not include explanations.`;
  }

  private extractCodeFromResponse(response: string): string {
    // Extract code from markdown code blocks
    const codeBlockRegex = /```[\w]*\n([\s\S]*?)\n```/g;
    const matches = [];
    let match;

    while ((match = codeBlockRegex.exec(response)) !== null) {
      matches.push(match[1]);
    }

    if (matches.length > 0) {
      return matches.join('\n\n');
    }

    // If no code blocks found, return the response as-is
    return response.trim();
  }

  private resolvePath(path: string): string {
    if (isAbsolute(path)) {
      return path;
    }
    return join(this.agentContext.workingDirectory, path);
  }
}

const RefactorCodeSchema = z.object({
  filePath: z.string().describe('Path to the file to refactor'),
  refactorType: z
    .enum([
      'extract_function',
      'extract_class',
      'rename_variable',
      'inline_function',
      'move_method',
      'split_class',
      'merge_classes',
      'optimize_imports',
      'modernize_syntax',
      'improve_naming',
    ])
    .describe('Type of refactoring to perform'),
  targetElement: z
    .string()
    .optional()
    .describe('Specific element to refactor (function name, variable name, etc.)'),
  newName: z.string().optional().describe('New name for rename operations'),
  extractionOptions: z
    .object({
      startLine: z.number().optional(),
      endLine: z.number().optional(),
      newFunctionName: z.string().optional(),
    })
    .optional()
    .describe('Options for extraction refactorings'),
});

export class RefactoringTool extends BaseTool {
  private readonly modelClient: UnifiedModelClient;

  public constructor(
    private readonly agentContext: Readonly<{ workingDirectory: string }>,
    modelClient: Readonly<UnifiedModelClient>
  ) {
    super({
      name: 'refactorCode',
      description: 'Performs automated code refactoring operations',
      category: 'Code Refactoring',
      parameters: RefactorCodeSchema,
    });
    this.modelClient = modelClient as UnifiedModelClient;
  }

  public async execute(args: Readonly<z.infer<typeof RefactorCodeSchema>>): Promise<string> {
    try {
      const { filePath, refactorType, targetElement, newName, extractionOptions } = args;

      const fullPath = this.resolvePath(filePath);
      const existingCode = await fs.readFile(fullPath, 'utf-8');

      // Create backup
      const backupPath = `${fullPath}.backup.${Date.now()}`;
      await fs.writeFile(backupPath, existingCode, 'utf-8');

      // Generate refactoring prompt based on type
      const refactoringPrompt = this.buildRefactoringPrompt(
        existingCode,
        refactorType,
        targetElement,
        newName,
        extractionOptions
      );

      // Get refactored code from AI
      const refactoredResponse = await this.modelClient.generateText(refactoringPrompt);
      const refactoredCode = this.extractCodeFromResponse(refactoredResponse);

      // Write the refactored code back to the file
      await fs.writeFile(fullPath, refactoredCode, 'utf-8');

      return `Successfully performed ${refactorType} refactoring on ${filePath}. Backup created at ${backupPath}`;
    } catch (error) {
      return `Error refactoring code: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  }

  private buildRefactoringPrompt(
    existingCode: string,
    refactorType: string,
    targetElement?: string,
    newName?: string,
    extractionOptions?: {
      startLine?: number;
      endLine?: number;
      newFunctionName?: string;
    }
  ): string {
    const startLine = extractionOptions?.startLine ?? '';
    const endLine = extractionOptions?.endLine ?? '';
    const newFunctionName = extractionOptions?.newFunctionName ?? 'extractedFunction';

    const refactorInstructions = {
      extract_function: `Extract the code between lines ${startLine} and ${endLine} into a new function named "${newFunctionName}"`,
      extract_class: `Extract related methods and properties into a new class`,
      rename_variable: `Rename the variable "${targetElement}" to "${newName}" throughout the code`,
      inline_function: `Inline the function "${targetElement}" by replacing all calls with the function body`,
      move_method: `Move the method "${targetElement}" to a more appropriate class or module`,
      split_class: `Split the class into smaller, more focused classes`,
      merge_classes: `Merge related classes into a single cohesive class`,
      optimize_imports: `Optimize and organize import statements`,
      modernize_syntax: `Update code to use modern language features and syntax`,
      improve_naming: `Improve variable, function, and class names for better readability`,
    };

    const instruction =
      refactorInstructions[refactorType as keyof typeof refactorInstructions] ||
      `Perform ${refactorType} refactoring`;

    return `You are an expert code refactoring specialist. Perform the following refactoring on the provided code.

EXISTING CODE:
\`\`\`
${existingCode}
\`\`\`

REFACTORING INSTRUCTION:
${instruction}

REQUIREMENTS:
1. Preserve all existing functionality
2. Maintain or improve code quality
3. Follow language best practices
4. Ensure the refactored code is syntactically correct
5. Maintain existing error handling
6. Update comments and documentation as needed
7. Ensure proper typing (if applicable)

Return ONLY the complete refactored code wrapped in triple backticks. Do not include explanations.`;
  }

  private extractCodeFromResponse(response: string): string {
    const codeBlockRegex = /```[\w]*\n([\s\S]*?)\n```/g;
    const matches = [];
    let match;

    while ((match = codeBlockRegex.exec(response)) !== null) {
      matches.push(match[1]);
    }

    if (matches.length > 0) {
      return matches.join('\n\n');
    }

    return response.trim();
  }

  private resolvePath(path: string): string {
    if (isAbsolute(path)) {
      return path;
    }
    return join(this.agentContext.workingDirectory, path);
  }
}
