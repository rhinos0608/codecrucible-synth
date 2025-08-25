import { BaseTool } from '../base-tool.js';
import { E2BService, ExecutionResult } from '../../e2b/e2b-service.js';
import { SecurityValidator, ValidationResult } from '../../e2b/security-validator.js';
import { logger } from '../../logger.js';
import { z } from 'zod';

/**
 * Secure E2B Code Execution Tool
 *
 * Replaces the unsafe CodeExecutionTool with sandboxed execution
 * using E2B infrastructure for complete isolation and security.
 */
export class E2BCodeExecutionTool extends BaseTool {
  private e2bService: E2BService;
  private securityValidator: SecurityValidator;

  constructor(e2bService: E2BService, agentContext: any, securityValidator?: SecurityValidator) {
    super({
      name: 'executeCode',
      description: 'Execute code safely in an isolated E2B sandbox environment',
      category: 'Code Execution',
      parameters: z.object({
        code: z.string().min(1).describe('The code to execute'),
        language: z
          .enum(['python', 'javascript', 'typescript', 'bash', 'shell'])
          .describe('Programming language'),
        sessionId: z.string().optional().describe('Session ID for persistent execution context'),
        timeout: z.number().optional().default(30000).describe('Execution timeout in milliseconds'),
        description: z.string().optional().describe('Description of what the code does'),
        expectedOutput: z.string().optional().describe('Expected output for validation'),
        variables: z
          .record(z.any())
          .optional()
          .describe('Variables to make available in execution context'),
      }),
    });

    this.e2bService = e2bService;
    this.securityValidator = securityValidator || new SecurityValidator();
  }

  async execute(args: any): Promise<any> {
    const startTime = Date.now();

    try {
      logger.info(`🔐 E2B Code Execution Request: ${args.language} (${args.code.length} chars)`);

      // Security validation
      const validationResult = this.securityValidator.validateCode(args.code, args.language);
      if (!validationResult.isValid) {
        logger.warn(`🚨 Code execution blocked: ${validationResult.reason}`);

        this.securityValidator.logSecurityViolation(
          args.sessionId || 'unknown',
          'code_execution',
          args.code,
          validationResult.severity
        );

        return {
          success: false,
          error: `Security validation failed: ${validationResult.reason}`,
          executionTime: Date.now() - startTime,
          sessionId: args.sessionId || 'none',
          securityWarnings: [validationResult.reason],
        };
      }

      // Generate session ID if not provided
      const sessionId = args.sessionId || this.generateSessionId();

      // Prepare code for execution
      const preparedCode = await this.prepareCodeForExecution(args);

      // Execute in E2B sandbox
      const executionResult = await this.e2bService.executeCode(
        sessionId,
        preparedCode,
        args.language
      );

      // Process and validate results
      const processedResult = await this.processExecutionResult(executionResult, args);

      logger.info(
        `✅ E2B Code execution completed - Success: ${processedResult.success}, Time: ${processedResult.executionTime}ms`
      );

      return {
        success: processedResult.success,
        output: processedResult.output,
        error: processedResult.error,
        executionTime: processedResult.executionTime,
        sessionId,
        securityWarnings:
          validationResult.severity !== 'low' ? [validationResult.reason] : undefined,
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;
      logger.error('❌ E2B Code execution failed:', error);

      return {
        success: false,
        error: `Execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        executionTime,
        sessionId: args.sessionId || 'none',
      };
    }
  }

  /**
   * Prepare code for safe execution with context setup
   */
  private async prepareCodeForExecution(args: any): Promise<string> {
    let preparedCode = args.code;

    // Add variable context if provided
    if (args.variables && Object.keys(args.variables).length > 0) {
      const variableSetup = this.generateVariableSetup(args.variables, args.language);
      preparedCode = `${variableSetup  }\n${  preparedCode}`;
    }

    // Add safety wrappers based on language
    switch (args.language.toLowerCase()) {
      case 'python':
        preparedCode = this.wrapPythonCode(preparedCode, args);
        break;
      case 'javascript':
      case 'typescript':
        preparedCode = this.wrapJavaScriptCode(preparedCode, args);
        break;
      case 'bash':
      case 'shell':
        preparedCode = this.wrapBashCode(preparedCode, args);
        break;
    }

    return preparedCode;
  }

  /**
   * Generate variable setup code for different languages
   */
  private generateVariableSetup(variables: Record<string, any>, language: string): string {
    switch (language.toLowerCase()) {
      case 'python':
        return Object.entries(variables)
          .map(([key, value]) => `${key} = ${JSON.stringify(value)}`)
          .join('\n');

      case 'javascript':
      case 'typescript':
        return Object.entries(variables)
          .map(([key, value]) => `const ${key} = ${JSON.stringify(value)};`)
          .join('\n');

      case 'bash':
      case 'shell':
        return Object.entries(variables)
          .map(([key, value]) => `${key}="${String(value)}"`)
          .join('\n');

      default:
        return '';
    }
  }

  /**
   * Wrap Python code with safety and monitoring
   */
  private wrapPythonCode(code: string, args: any): string {
    const safetyWrapper = `
import sys
import time
import traceback
from contextlib import redirect_stdout, redirect_stderr
from io import StringIO

# Execution timeout safety
start_time = time.time()
timeout_seconds = ${args.timeout / 1000}

def check_timeout():
    if time.time() - start_time > timeout_seconds:
        raise TimeoutError(f"Execution exceeded {timeout_seconds} seconds")

# Capture output
stdout_capture = StringIO()
stderr_capture = StringIO()

try:
    with redirect_stdout(stdout_capture), redirect_stderr(stderr_capture):
        check_timeout()
        
        # User code execution
${code
  .split('\n')
  .map(line => `        ${  line}`)
  .join('\n')}
        
        check_timeout()
        
    # Print captured output
    stdout_content = stdout_capture.getvalue()
    stderr_content = stderr_capture.getvalue()
    
    if stdout_content:
        print(stdout_content, end='')
    if stderr_content:
        print(stderr_content, file=sys.stderr, end='')
        
except TimeoutError as e:
    print(f"TIMEOUT_ERROR: {e}", file=sys.stderr)
    sys.exit(1)
except Exception as e:
    print(f"EXECUTION_ERROR: {e}", file=sys.stderr)
    print(f"TRACEBACK: {traceback.format_exc()}", file=sys.stderr)
    sys.exit(1)
`;

    return safetyWrapper;
  }

  /**
   * Wrap JavaScript code with safety (convert to Python execution)
   */
  private wrapJavaScriptCode(code: string, args: any): string {
    // Convert simple JavaScript to Python for execution in E2B
    const convertedCode = this.convertJSToPython(code);
    return this.wrapPythonCode(convertedCode, args);
  }

  /**
   * Convert basic JavaScript to Python
   */
  private convertJSToPython(jsCode: string): string {
    let pythonCode = jsCode;

    // Basic conversions
    pythonCode = pythonCode
      .replace(/console\.log\s*\(/g, 'print(')
      .replace(/let\s+(\w+)\s*=/g, '$1 =')
      .replace(/const\s+(\w+)\s*=/g, '$1 =')
      .replace(/var\s+(\w+)\s*=/g, '$1 =')
      .replace(/===\s/g, '== ')
      .replace(/!==\s/g, '!= ')
      .replace(/true\b/g, 'True')
      .replace(/false\b/g, 'False')
      .replace(/null\b/g, 'None')
      .replace(/undefined\b/g, 'None')
      .replace(/\/\/\s*(.*)/g, '# $1') // Convert comments
      .replace(/function\s+(\w+)\s*\(/g, 'def $1(')
      .replace(/\bMath\.(\w+)/g, 'math.$1'); // Math object

    // Add necessary imports
    if (pythonCode.includes('math.')) {
      pythonCode = `import math\n${  pythonCode}`;
    }

    return pythonCode;
  }

  /**
   * Wrap Bash code with safety
   */
  private wrapBashCode(code: string, args: any): string {
    const safetyWrapper = `
import subprocess
import sys
import time
import signal

# Timeout handling
timeout_seconds = ${args.timeout / 1000}

def timeout_handler(signum, frame):
    raise TimeoutError(f"Command execution exceeded {timeout_seconds} seconds")

signal.signal(signal.SIGALRM, timeout_handler)
signal.alarm(int(timeout_seconds))

try:
    # Execute bash command safely
    result = subprocess.run(
        ${JSON.stringify(code)},
        shell=True,
        capture_output=True,
        text=True,
        timeout=${args.timeout / 1000}
    )
    
    signal.alarm(0)  # Cancel timeout
    
    if result.stdout:
        print(result.stdout, end='')
    if result.stderr:
        print(result.stderr, file=sys.stderr, end='')
        
    sys.exit(result.returncode)
    
except subprocess.TimeoutExpired:
    print("TIMEOUT_ERROR: Command execution timed out", file=sys.stderr)
    sys.exit(1)
except TimeoutError as e:
    print(f"TIMEOUT_ERROR: {e}", file=sys.stderr)
    sys.exit(1)
except Exception as e:
    print(f"EXECUTION_ERROR: {e}", file=sys.stderr)
    sys.exit(1)
`;

    return safetyWrapper;
  }

  /**
   * Process execution result and add additional analysis
   */
  private async processExecutionResult(
    executionResult: ExecutionResult,
    args: any
  ): Promise<ExecutionResult> {
    // Validate expected output if provided
    if (args.expectedOutput && executionResult.output) {
      const outputMatches = executionResult.output.includes(args.expectedOutput);
      if (!outputMatches) {
        logger.info(`⚠️ Output validation: Expected "${args.expectedOutput}" not found in result`);
      }
    }

    // Check for timeout errors
    if (executionResult.error?.includes('TIMEOUT_ERROR')) {
      executionResult.error =
        'Code execution timed out. Consider optimizing your code or reducing complexity.';
    }

    // Check for execution errors
    if (executionResult.error?.includes('EXECUTION_ERROR')) {
      executionResult.error = executionResult.error.replace('EXECUTION_ERROR: ', '');
    }

    // Clean up output formatting
    if (executionResult.output) {
      executionResult.output = executionResult.output.trim();
    }

    return executionResult;
  }

  /**
   * Generate unique session ID
   */
  private generateSessionId(): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    return `e2b_session_${timestamp}_${random}`;
  }

  /**
   * Get execution statistics
   */
  getExecutionStats(): any {
    return {
      toolName: this.definition.name,
      securityPolicy: this.securityValidator.getPolicy(),
      e2bServiceStats: this.e2bService.getStats(),
    };
  }

  /**
   * Update security policy
   */
  updateSecurityPolicy(newPolicy: any): void {
    this.securityValidator.updatePolicy(newPolicy);
    logger.info('🔒 E2B Code Execution Tool security policy updated');
  }
}
