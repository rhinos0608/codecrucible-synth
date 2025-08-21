import { UnifiedModelClient } from '../client.js';
import { logger } from '../logger.js';
import * as fs from 'fs/promises';
import * as path from 'path';
import { VM } from 'vm2';

export interface CodingChallenge {
  id: string;
  title: string;
  prompt: string;
  testCases: TestCase[];
  expectedSolution?: string;
  difficulty: 'easy' | 'medium' | 'hard';
  category: 'algorithms' | 'data-structures' | 'string-manipulation' | 'math' | 'logic';
  language: 'javascript' | 'python' | 'typescript';
  timeLimit?: number; // seconds
}

export interface TestCase {
  input: any;
  expectedOutput: any;
  description?: string;
}

export interface BenchmarkResult {
  challengeId: string;
  passed: boolean;
  generatedCode: string;
  executionTime: number;
  errors: string[];
  testResults: TestResult[];
  confidence: number;
  codeQuality: {
    readability: number;
    efficiency: number;
    correctness: number;
  };
}

export interface TestResult {
  input: any;
  expectedOutput: any;
  actualOutput: any;
  passed: boolean;
  error?: string;
}

export interface BenchmarkSummary {
  totalChallenges: number;
  passed: number;
  failed: number;
  successRate: number;
  averageTime: number;
  averageConfidence: number;
  categoryBreakdown: Record<string, { passed: number; total: number }>;
  difficultyBreakdown: Record<string, { passed: number; total: number }>;
  detailedResults: BenchmarkResult[];
  modelUsed: string;
  timestamp: number;
}

/**
 * HumanEval-inspired benchmark runner for code generation models
 * Evaluates model performance on standardized coding challenges
 */
export class BenchmarkRunner {
  private challenges: CodingChallenge[];
  private hybridClient?: UnifiedModelClient;
  private ollamaClient?: UnifiedModelClient;

  constructor() {
    this.challenges = this.loadDefaultChallenges();
    this.initializeClients();

    logger.info('Benchmark runner initialized with challenges', {
      totalChallenges: this.challenges.length,
      categories: this.getCategoryDistribution(),
    });
  }

  /**
   * Run benchmark suite on specified model
   */
  async runBenchmark(
    modelName?: string,
    options: {
      categories?: string[];
      difficulties?: string[];
      limit?: number;
      timeoutMs?: number;
    } = {}
  ): Promise<BenchmarkSummary> {
    const startTime = Date.now();

    console.log('🧪 Starting benchmark suite...');
    console.log(`📊 Model: ${modelName || 'hybrid'}`);

    // Filter challenges based on options
    let selectedChallenges = this.challenges;

    if (options.categories?.length) {
      selectedChallenges = selectedChallenges.filter(c => options.categories!.includes(c.category));
    }

    if (options.difficulties?.length) {
      selectedChallenges = selectedChallenges.filter(c =>
        options.difficulties!.includes(c.difficulty)
      );
    }

    if (options.limit) {
      selectedChallenges = selectedChallenges.slice(0, options.limit);
    }

    console.log(`🎯 Running ${selectedChallenges.length} challenges`);

    const results: BenchmarkResult[] = [];
    let passed = 0;
    let totalTime = 0;
    let totalConfidence = 0;

    // Run each challenge
    for (let i = 0; i < selectedChallenges.length; i++) {
      const challenge = selectedChallenges[i];

      console.log(
        `\n[${i + 1}/${selectedChallenges.length}] ${challenge.title} (${challenge.difficulty})`
      );

      try {
        const result = await this.runSingleChallenge(challenge, modelName, options.timeoutMs);

        results.push(result);

        if (result.passed) {
          passed++;
          console.log(
            `   ✅ PASSED (${result.executionTime}ms, confidence: ${(result.confidence * 100).toFixed(0)}%)`
          );
        } else {
          console.log(`   ❌ FAILED (${result.errors.length} errors)`);
          if (result.errors.length > 0) {
            console.log(`      ${result.errors[0]}`);
          }
        }

        totalTime += result.executionTime;
        totalConfidence += result.confidence;
      } catch (error) {
        console.log(`   💥 ERROR: ${error instanceof Error ? error.message : 'Unknown error'}`);

        // Add failed result
        results.push({
          challengeId: challenge.id,
          passed: false,
          generatedCode: '',
          executionTime: 0,
          errors: [error instanceof Error ? error.message : 'Benchmark execution error'],
          testResults: [],
          confidence: 0,
          codeQuality: { readability: 0, efficiency: 0, correctness: 0 },
        });
      }

      // Small delay between challenges
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    // Calculate summary statistics
    const successRate = (passed / selectedChallenges.length) * 100;
    const averageTime = totalTime / selectedChallenges.length;
    const averageConfidence = totalConfidence / selectedChallenges.length;

    // Category and difficulty breakdowns
    const categoryBreakdown = this.calculateCategoryBreakdown(selectedChallenges, results);
    const difficultyBreakdown = this.calculateDifficultyBreakdown(selectedChallenges, results);

    const summary: BenchmarkSummary = {
      totalChallenges: selectedChallenges.length,
      passed,
      failed: selectedChallenges.length - passed,
      successRate,
      averageTime,
      averageConfidence,
      categoryBreakdown,
      difficultyBreakdown,
      detailedResults: results,
      modelUsed: modelName || 'hybrid',
      timestamp: Date.now(),
    };

    // Save results
    await this.saveBenchmarkResults(summary);

    const totalDuration = Date.now() - startTime;

    console.log('\n📈 Benchmark Results:');
    console.log(`✅ Passed: ${passed}/${selectedChallenges.length} (${successRate.toFixed(1)}%)`);
    console.log(`⏱️  Average Time: ${averageTime.toFixed(0)}ms per challenge`);
    console.log(`🎯 Average Confidence: ${(averageConfidence * 100).toFixed(1)}%`);
    console.log(`⏳ Total Duration: ${(totalDuration / 1000).toFixed(1)}s`);

    // Category breakdown
    console.log('\n📊 Category Breakdown:');
    Object.entries(categoryBreakdown).forEach(([category, stats]) => {
      const rate = ((stats.passed / stats.total) * 100).toFixed(1);
      console.log(`   ${category}: ${stats.passed}/${stats.total} (${rate}%)`);
    });

    // Difficulty breakdown
    console.log('\n🎚️  Difficulty Breakdown:');
    Object.entries(difficultyBreakdown).forEach(([difficulty, stats]) => {
      const rate = ((stats.passed / stats.total) * 100).toFixed(1);
      console.log(`   ${difficulty}: ${stats.passed}/${stats.total} (${rate}%)`);
    });

    return summary;
  }

  /**
   * Run a single coding challenge
   */
  private async runSingleChallenge(
    challenge: CodingChallenge,
    modelName?: string,
    timeoutMs: number = 30000
  ): Promise<BenchmarkResult> {
    const startTime = Date.now();

    try {
      // Generate code using specified model
      const generation = await this.generateCodeForChallenge(challenge, modelName, timeoutMs);

      const executionTime = Date.now() - startTime;

      // Execute tests
      const testResults = await this.executeTests(challenge, generation.code);

      // Check if all tests passed
      const passed = testResults.every(result => result.passed);

      // Calculate code quality metrics
      const codeQuality = this.assessCodeQuality(generation.code, challenge);

      return {
        challengeId: challenge.id,
        passed,
        generatedCode: generation.code,
        executionTime,
        errors: generation.errors,
        testResults,
        confidence: generation.confidence,
        codeQuality,
      };
    } catch (error) {
      return {
        challengeId: challenge.id,
        passed: false,
        generatedCode: '',
        executionTime: Date.now() - startTime,
        errors: [error instanceof Error ? error.message : 'Unknown execution error'],
        testResults: [],
        confidence: 0,
        codeQuality: { readability: 0, efficiency: 0, correctness: 0 },
      };
    }
  }

  /**
   * Generate code for a challenge using specified model
   */
  private async generateCodeForChallenge(
    challenge: CodingChallenge,
    modelName?: string,
    timeoutMs: number = 30000
  ): Promise<{ code: string; confidence: number; errors: string[] }> {
    const enhancedPrompt = `${challenge.prompt}

Requirements:
- Write only the function implementation
- Use ${challenge.language}
- Do not include test cases or examples
- Ensure the solution handles edge cases
- Return only the code without explanations

Function signature and implementation:`;

    try {
      if (modelName && modelName !== 'hybrid') {
        // Use specific model (Ollama)
        if (this.ollamaClient) {
          const result = (await Promise.race([
            this.ollamaClient.generateText(enhancedPrompt, { includeContext: false }),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), timeoutMs)),
          ])) as any;

          const extractedCode = this.extractCodeFromResponse(result.text, challenge.language);

          return {
            code: extractedCode,
            confidence: 0.8, // Default confidence for Ollama
            errors: [],
          };
        } else {
          throw new Error('Ollama client not available');
        }
      } else {
        // Use hybrid client
        if (this.hybridClient) {
          const result = (await Promise.race([
            this.hybridClient.generateCode(enhancedPrompt, [], {
              taskType: 'algorithms',
              complexity:
                challenge.difficulty === 'easy'
                  ? 'simple'
                  : challenge.difficulty === 'medium'
                    ? 'medium'
                    : 'complex',
            }),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), timeoutMs)),
          ])) as any;

          const extractedCode = this.extractCodeFromResponse(
            result.code || result.synthesis,
            challenge.language
          );

          return {
            code: extractedCode,
            confidence: result.confidence || 0.7,
            errors: [],
          };
        } else {
          throw new Error('Hybrid client not available');
        }
      }
    } catch (error) {
      return {
        code: '',
        confidence: 0,
        errors: [error instanceof Error ? error.message : 'Code generation failed'],
      };
    }
  }

  /**
   * Extract clean code from model response
   */
  private extractCodeFromResponse(response: string, language: string): string {
    // Remove markdown code blocks
    let code = response.replace(/```[\w]*\n?/g, '').replace(/```/g, '');

    // Remove explanatory text (simple heuristic)
    const lines = code.split('\n');
    const codeLines = lines.filter(line => {
      const trimmed = line.trim();
      return (
        trimmed &&
        !trimmed.startsWith('//') &&
        !trimmed.startsWith('#') &&
        !trimmed.startsWith('Here') &&
        !trimmed.startsWith('This') &&
        !trimmed.startsWith('The function')
      );
    });

    code = codeLines.join('\n').trim();

    // Language-specific cleanup
    if (language === 'javascript' || language === 'typescript') {
      // Ensure we have a function
      if (!code.includes('function') && !code.includes('=>')) {
        // Try to wrap in a function if it looks like function body
        if (code.includes('return')) {
          code = `function solution() {\n${code}\n}`;
        }
      }
    } else if (language === 'python') {
      // Ensure proper Python indentation
      const pyLines = code.split('\n');
      if (pyLines.length > 1 && !pyLines[1].startsWith('    ')) {
        // Add indentation
        const indentedLines = pyLines.map((line, i) =>
          i === 0 ? line : line.trim() ? '    ' + line : line
        );
        code = indentedLines.join('\n');
      }
    }

    return code;
  }

  /**
   * Execute test cases against generated code
   */
  private async executeTests(challenge: CodingChallenge, code: string): Promise<TestResult[]> {
    const testResults: TestResult[] = [];

    for (const testCase of challenge.testCases) {
      try {
        const result = await this.executeTestCase(code, testCase, challenge.language);
        testResults.push(result);
      } catch (error) {
        testResults.push({
          input: testCase.input,
          expectedOutput: testCase.expectedOutput,
          actualOutput: null,
          passed: false,
          error: error instanceof Error ? error.message : 'Test execution error',
        });
      }
    }

    return testResults;
  }

  /**
   * Execute a single test case
   */
  private async executeTestCase(
    code: string,
    testCase: TestCase,
    language: string
  ): Promise<TestResult> {
    try {
      if (language === 'javascript' || language === 'typescript') {
        return await this.executeJavaScriptTest(code, testCase);
      } else if (language === 'python') {
        return await this.executePythonTest(code, testCase);
      } else {
        throw new Error(`Language ${language} not supported for execution`);
      }
    } catch (error) {
      return {
        input: testCase.input,
        expectedOutput: testCase.expectedOutput,
        actualOutput: null,
        passed: false,
        error: error instanceof Error ? error.message : 'Execution error',
      };
    }
  }

  /**
   * Execute JavaScript test case using vm2
   */
  private async executeJavaScriptTest(code: string, testCase: TestCase): Promise<TestResult> {
    const vm = new VM({
      timeout: 5000,
      sandbox: {},
    });

    try {
      // Prepare test execution code
      const testCode = `
        ${code}
        
        // Extract function name
        const functionName = ${this.extractFunctionName(code)};
        const result = functionName(${JSON.stringify(testCase.input)});
        result;
      `;

      const actualOutput = vm.run(testCode);
      const passed = this.compareOutputs(actualOutput, testCase.expectedOutput);

      return {
        input: testCase.input,
        expectedOutput: testCase.expectedOutput,
        actualOutput,
        passed,
      };
    } catch (error) {
      return {
        input: testCase.input,
        expectedOutput: testCase.expectedOutput,
        actualOutput: null,
        passed: false,
        error: error instanceof Error ? error.message : 'JavaScript execution error',
      };
    }
  }

  /**
   * Execute Python test case (placeholder - would need Python runtime)
   */
  private async executePythonTest(code: string, testCase: TestCase): Promise<TestResult> {
    try {
      // Check if python is available in the system
      const { spawn } = await import('child_process');
      const { writeFile, unlink } = await import('fs/promises');
      const { join } = await import('path');
      const { randomBytes } = await import('crypto');

      // Create temporary Python file
      const tempId = randomBytes(8).toString('hex');
      const tempFile = join(process.cwd(), `temp_test_${tempId}.py`);

      // Write test code to temporary file
      const testCode = `
import sys
import json

${code}

try:
    result = ${testCase.input}
    print(json.dumps({"result": result, "error": None}))
except Exception as e:
    print(json.dumps({"result": None, "error": str(e)}))
`;

      await writeFile(tempFile, testCode);

      // Execute Python code
      const result = await new Promise<TestResult>(resolve => {
        const python = spawn('python', [tempFile]);
        let stdout = '';
        let stderr = '';

        python.stdout.on('data', data => {
          stdout += data.toString();
        });

        python.stderr.on('data', data => {
          stderr += data.toString();
        });

        python.on('close', async code => {
          // Clean up temporary file
          try {
            await unlink(tempFile);
          } catch {}

          if (code !== 0) {
            resolve({
              input: testCase.input,
              expectedOutput: testCase.expectedOutput,
              actualOutput: null,
              passed: false,
              error: stderr || `Python process exited with code ${code}`,
            });
            return;
          }

          try {
            const output = JSON.parse(stdout.trim());
            if (output.error) {
              resolve({
                input: testCase.input,
                expectedOutput: testCase.expectedOutput,
                actualOutput: null,
                passed: false,
                error: output.error,
              });
            } else {
              const passed =
                JSON.stringify(output.result) === JSON.stringify(testCase.expectedOutput);
              resolve({
                input: testCase.input,
                expectedOutput: testCase.expectedOutput,
                actualOutput: output.result,
                passed,
                error: null,
              });
            }
          } catch (parseError) {
            resolve({
              input: testCase.input,
              expectedOutput: testCase.expectedOutput,
              actualOutput: stdout,
              passed: false,
              error: `Failed to parse Python output: ${parseError}`,
            });
          }
        });
      });

      return result;
    } catch (error) {
      return {
        input: testCase.input,
        expectedOutput: testCase.expectedOutput,
        actualOutput: null,
        passed: false,
        error: `Python execution failed: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  /**
   * Extract function name from code
   */
  private extractFunctionName(code: string): string {
    // Try to find function declaration
    const functionMatch = code.match(/function\s+(\w+)/);
    if (functionMatch) {
      return functionMatch[1];
    }

    // Try to find arrow function assignment
    const arrowMatch = code.match(/(?:const|let|var)\s+(\w+)\s*=/);
    if (arrowMatch) {
      return arrowMatch[1];
    }

    // Default to a common name
    return 'solution';
  }

  /**
   * Compare actual vs expected outputs
   */
  private compareOutputs(actual: any, expected: any): boolean {
    if (typeof actual !== typeof expected) {
      return false;
    }

    if (Array.isArray(actual) && Array.isArray(expected)) {
      if (actual.length !== expected.length) {
        return false;
      }
      return actual.every((item, index) => this.compareOutputs(item, expected[index]));
    }

    if (typeof actual === 'object' && actual !== null && expected !== null) {
      const actualKeys = Object.keys(actual).sort();
      const expectedKeys = Object.keys(expected).sort();

      if (actualKeys.length !== expectedKeys.length) {
        return false;
      }

      return actualKeys.every(
        key => expectedKeys.includes(key) && this.compareOutputs(actual[key], expected[key])
      );
    }

    return actual === expected;
  }

  /**
   * Assess code quality metrics
   */
  private assessCodeQuality(
    code: string,
    challenge: CodingChallenge
  ): {
    readability: number;
    efficiency: number;
    correctness: number;
  } {
    let readability = 0.5;
    let efficiency = 0.5;
    let correctness = 0.5;

    // Readability factors
    if (code.includes('\n')) readability += 0.1; // Multi-line
    if (code.match(/\/\/|\/\*/)) readability += 0.1; // Comments
    if (code.length > 50) readability += 0.1; // Substantial code
    if (code.match(/\s{2,}/)) readability += 0.1; // Proper spacing

    // Efficiency factors (basic heuristics)
    const codeLength = code.length;
    if (codeLength < 200) efficiency += 0.2; // Concise
    if (!code.includes('for') || code.includes('while')) efficiency += 0.1; // Not obviously inefficient
    if (code.includes('return')) efficiency += 0.1; // Proper return

    // Correctness factors
    if (code.includes('function') || code.includes('=>')) correctness += 0.2; // Is a function
    if (code.includes('return')) correctness += 0.2; // Returns something
    if (!code.includes('undefined') && !code.includes('null')) correctness += 0.1; // No obvious nulls

    return {
      readability: Math.min(1, readability),
      efficiency: Math.min(1, efficiency),
      correctness: Math.min(1, correctness),
    };
  }

  /**
   * Calculate category breakdown
   */
  private calculateCategoryBreakdown(
    challenges: CodingChallenge[],
    results: BenchmarkResult[]
  ): Record<string, { passed: number; total: number }> {
    const breakdown: Record<string, { passed: number; total: number }> = {};

    challenges.forEach((challenge, index) => {
      const category = challenge.category;
      if (!breakdown[category]) {
        breakdown[category] = { passed: 0, total: 0 };
      }
      breakdown[category].total++;

      if (results[index]?.passed) {
        breakdown[category].passed++;
      }
    });

    return breakdown;
  }

  /**
   * Calculate difficulty breakdown
   */
  private calculateDifficultyBreakdown(
    challenges: CodingChallenge[],
    results: BenchmarkResult[]
  ): Record<string, { passed: number; total: number }> {
    const breakdown: Record<string, { passed: number; total: number }> = {};

    challenges.forEach((challenge, index) => {
      const difficulty = challenge.difficulty;
      if (!breakdown[difficulty]) {
        breakdown[difficulty] = { passed: 0, total: 0 };
      }
      breakdown[difficulty].total++;

      if (results[index]?.passed) {
        breakdown[difficulty].passed++;
      }
    });

    return breakdown;
  }

  /**
   * Get category distribution of challenges
   */
  private getCategoryDistribution(): Record<string, number> {
    const distribution: Record<string, number> = {};
    this.challenges.forEach(challenge => {
      distribution[challenge.category] = (distribution[challenge.category] || 0) + 1;
    });
    return distribution;
  }

  /**
   * Initialize LLM clients
   */
  private initializeClients(): void {
    try {
      this.hybridClient = new UnifiedModelClient({
        providers: [
          { type: 'ollama', endpoint: 'http://localhost:11434', model: 'auto', timeout: 30000 },
          { type: 'lm-studio', endpoint: 'http://localhost:1234', model: 'auto', timeout: 30000 },
        ],
        executionMode: 'auto',
        fallbackChain: ['ollama', 'lm-studio'],
        performanceThresholds: {
          fastModeMaxTokens: 2048,
          timeoutMs: 30000,
          maxConcurrentRequests: 3,
        },
      });

      this.ollamaClient = new UnifiedModelClient({
        endpoint: 'http://localhost:11434',
        model: 'codellama:34b',
        timeout: 60000,
      });

      logger.debug('Benchmark clients initialized');
    } catch (error) {
      logger.warn('Some benchmark clients failed to initialize:', error);
    }
  }

  /**
   * Load default coding challenges (HumanEval-inspired)
   */
  private loadDefaultChallenges(): CodingChallenge[] {
    return [
      {
        id: 'reverse-string',
        title: 'Reverse String',
        prompt: 'Write a function that reverses a string.',
        testCases: [
          { input: 'hello', expectedOutput: 'olleh' },
          { input: 'world', expectedOutput: 'dlrow' },
          { input: '', expectedOutput: '' },
          { input: 'a', expectedOutput: 'a' },
        ],
        difficulty: 'easy',
        category: 'string-manipulation',
        language: 'javascript',
      },
      {
        id: 'fibonacci',
        title: 'Fibonacci Sequence',
        prompt: 'Write a function that returns the nth Fibonacci number.',
        testCases: [
          { input: 0, expectedOutput: 0 },
          { input: 1, expectedOutput: 1 },
          { input: 5, expectedOutput: 5 },
          { input: 10, expectedOutput: 55 },
        ],
        difficulty: 'medium',
        category: 'math',
        language: 'javascript',
      },
      {
        id: 'two-sum',
        title: 'Two Sum',
        prompt: 'Write a function that finds two numbers in an array that add up to a target sum.',
        testCases: [
          { input: { nums: [2, 7, 11, 15], target: 9 }, expectedOutput: [0, 1] },
          { input: { nums: [3, 2, 4], target: 6 }, expectedOutput: [1, 2] },
          { input: { nums: [3, 3], target: 6 }, expectedOutput: [0, 1] },
        ],
        difficulty: 'medium',
        category: 'algorithms',
        language: 'javascript',
      },
      {
        id: 'palindrome-check',
        title: 'Palindrome Check',
        prompt: 'Write a function that checks if a string is a palindrome.',
        testCases: [
          { input: 'racecar', expectedOutput: true },
          { input: 'hello', expectedOutput: false },
          { input: 'A man a plan a canal Panama', expectedOutput: true },
          { input: '', expectedOutput: true },
        ],
        difficulty: 'easy',
        category: 'string-manipulation',
        language: 'javascript',
      },
      {
        id: 'binary-search',
        title: 'Binary Search',
        prompt: 'Write a function that performs binary search on a sorted array.',
        testCases: [
          { input: { arr: [1, 2, 3, 4, 5], target: 3 }, expectedOutput: 2 },
          { input: { arr: [1, 2, 3, 4, 5], target: 6 }, expectedOutput: -1 },
          { input: { arr: [], target: 1 }, expectedOutput: -1 },
        ],
        difficulty: 'medium',
        category: 'algorithms',
        language: 'javascript',
      },
    ];
  }

  /**
   * Save benchmark results to file
   */
  private async saveBenchmarkResults(summary: BenchmarkSummary): Promise<void> {
    try {
      const resultsDir = path.join(process.cwd(), 'benchmark-results');
      await fs.mkdir(resultsDir, { recursive: true });

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `benchmark-${summary.modelUsed}-${timestamp}.json`;
      const filepath = path.join(resultsDir, filename);

      await fs.writeFile(filepath, JSON.stringify(summary, null, 2));
      console.log(`📄 Results saved to: ${filepath}`);
    } catch (error) {
      logger.warn('Failed to save benchmark results:', error);
    }
  }
}
