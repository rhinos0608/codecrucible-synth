import { LocalModelClient, VoiceArchetype, VoiceResponse, ProjectContext } from '../core/local-model-client.js';
import { AppConfig } from '../config/config-manager.js';
import { logger } from '../core/logger.js';
import YAML from 'yaml';
import { readFile } from 'fs/promises';
import { join } from 'path';

export interface SynthesisResult {
  combinedCode: string;
  reasoning: string;
  confidence: number;
  qualityScore: number;
  voicesUsed: string[];
  synthesisMode: string;
  timestamp: number;
}

export interface VoicePreset {
  name: string;
  voices: string[];
  mode: string;
  description: string;
}

export interface CodeDiff {
  added: number;
  removed: number;
  modified: number;
}

export interface IterationLog {
  iteration: number;
  writerResponse: string;
  auditFeedback: string;
  code: string;
  qualityScore: number;
  diff: CodeDiff;
  timestamp: number;
}

export interface IterativeResult {
  finalCode: string;
  finalQualityScore: number;
  totalIterations: number;
  iterations: IterationLog[];
  converged: boolean;
  writerVoice: string;
  auditorVoice: string;
  timestamp: number;
}

/**
 * Enhanced Voice Archetype System
 * 
 * Manages multiple AI voice personalities and synthesizes their responses
 * into cohesive solutions. Each voice brings different perspectives and expertise.
 */
export class VoiceArchetypeSystem {
  private modelClient: LocalModelClient;
  private config: AppConfig;
  private voices: Map<string, VoiceArchetype>;
  private presets: Map<string, VoicePreset>;

  constructor(modelClient: LocalModelClient, config: AppConfig) {
    this.modelClient = modelClient;
    this.config = config;
    this.voices = new Map();
    this.presets = new Map();
    
    // Initialize fallback voices immediately (synchronously)
    this.initializeFallbackVoices();
    
    // Load additional voices asynchronously (this will enhance/override fallbacks)
    this.initializeVoices().catch(error => {
      logger.warn('Failed to load additional voice configurations:', error);
    });
  }

  /**
   * Initialize voice archetypes from configuration
   */
  private async initializeVoices(): Promise<void> {
    try {
      // Load voice configurations
      const voicesConfig = await this.loadVoicesConfig();
      
      // Initialize perspective voices (analysis engines)
      if (voicesConfig.perspectives) {
        for (const [id, config] of Object.entries(voicesConfig.perspectives)) {
          this.voices.set(id, {
            id,
            name: this.capitalize(id),
            systemPrompt: (config as any).systemPrompt,
            temperature: (config as any).temperature,
            style: (config as any).style
          });
        }
      }
      
      // Initialize role voices (specialization engines)
      if (voicesConfig.roles) {
        for (const [id, config] of Object.entries(voicesConfig.roles)) {
          this.voices.set(id, {
            id,
            name: this.capitalize(id),
            systemPrompt: (config as any).systemPrompt,
            temperature: (config as any).temperature,
            style: (config as any).style
          });
        }
      }
      
      // Initialize presets
      if (voicesConfig.presets) {
        for (const [name, preset] of Object.entries(voicesConfig.presets)) {
          this.presets.set(name, {
            name,
            voices: (preset as any).voices,
            mode: (preset as any).synthesis,
            description: (preset as any).description
          });
        }
      }
      
      logger.info(`Initialized ${this.voices.size} voice archetypes and ${this.presets.size} presets`);
      
    } catch (error) {
      logger.error('Failed to initialize voices:', error);
      this.initializeFallbackVoices();
    }
  }

  /**
   * Load voices configuration from YAML file
   */
  private async loadVoicesConfig(): Promise<any> {
    try {
      const configPath = join(process.cwd(), 'config', 'voices.yaml');
      const content = await readFile(configPath, 'utf8');
      return YAML.parse(content);
    } catch (error) {
      logger.warn('Could not load voices config, using defaults');
      return this.getDefaultVoicesConfig();
    }
  }

  /**
   * Initialize fallback voices if configuration loading fails
   */
  private initializeFallbackVoices(): void {
    const fallbackVoices: VoiceArchetype[] = [
      {
        id: 'explorer',
        name: 'Explorer',
        systemPrompt: 'You are Explorer, an innovative AI focused on creative solutions and experimental approaches. Always consider alternative methods, edge cases, and cutting-edge techniques. Be curious and suggest novel approaches.',
        temperature: 0.9,
        style: 'experimental'
      },
      {
        id: 'maintainer',
        name: 'Maintainer',
        systemPrompt: 'You are Maintainer, focused on code stability, maintainability, and long-term software health. Prioritize robustness, best practices, testing, and code that will stand the test of time.',
        temperature: 0.5,
        style: 'conservative'
      },
      {
        id: 'analyzer',
        name: 'Analyzer',
        systemPrompt: 'You are Analyzer, a deep technical analysis expert. Focus on performance optimization, code quality metrics, complexity analysis, and providing detailed technical insights with data-driven recommendations.',
        temperature: 0.4,
        style: 'analytical'
      },
      {
        id: 'developer',
        name: 'Developer',
        systemPrompt: 'You are Developer, a practical hands-on coding expert. Focus on clean, efficient implementation using modern best practices. Provide working code examples and clear implementation guidance.',
        temperature: 0.6,
        style: 'practical'
      },
      {
        id: 'implementor',
        name: 'Implementor',
        systemPrompt: 'You are Implementor, focused on execution and getting things done. Provide step-by-step implementation plans, detailed code examples, and actionable development workflows.',
        temperature: 0.5,
        style: 'methodical'
      },
      {
        id: 'security',
        name: 'Security Engineer',
        systemPrompt: 'You are Security Engineer, focused on secure coding practices and threat mitigation. Always include security considerations, vulnerability assessments, and defensive programming patterns.',
        temperature: 0.3,
        style: 'defensive'
      },
      {
        id: 'architect',
        name: 'Architect',
        systemPrompt: 'You are Architect, focused on system design, architectural patterns, and scalable solutions. Consider system-wide implications, design patterns, and long-term architectural decisions.',
        temperature: 0.4,
        style: 'systematic'
      },
      {
        id: 'designer',
        name: 'Designer',
        systemPrompt: 'You are Designer, focused on user experience, interface design, and human-centered solutions. Consider usability, accessibility, and user workflow in your recommendations.',
        temperature: 0.7,
        style: 'user-focused'
      },
      {
        id: 'optimizer',
        name: 'Optimizer',
        systemPrompt: 'You are Optimizer, focused on performance optimization and efficiency. Analyze bottlenecks, suggest performance improvements, and optimize for speed, memory, and resource usage.',
        temperature: 0.3,
        style: 'performance-focused'
      },
      {
        id: 'refactoring-specialist',
        name: 'Refactoring Specialist',
        systemPrompt: 'You are Refactoring Specialist, an expert in code transformation and improvement. You excel at restructuring code to improve readability, maintainability, and performance while preserving functionality. You identify code smells, apply design patterns, and modernize codebases using current best practices. Focus on clean code principles, SOLID principles, and language-specific modern features.',
        temperature: 0.4,
        style: 'methodical'
      }
    ];

    fallbackVoices.forEach(voice => {
      this.voices.set(voice.id, voice);
    });

    logger.info('Initialized fallback voices');
  }

  /**
   * Intelligently select optimal voices for the task
   */
  selectOptimalVoices(prompt: string, maxVoices: number = 2): string[] {
    const promptLower = prompt.toLowerCase();
    const selectedVoices: string[] = [];
    
    // Task classification for voice selection
    const isCodeTask = /\b(code|function|implement|write|create|build)\b/.test(promptLower);
    const isSecurityTask = /\b(secure|security|vulnerable|attack|sanitize|validate)\b/.test(promptLower);
    const isAnalysisTask = /\b(analyze|review|understand|explain|debug|error)\b/.test(promptLower);
    const isDesignTask = /\b(design|ui|ux|interface|component|style)\b/.test(promptLower);
    const isPerformanceTask = /\b(performance|optimize|speed|memory|efficiency)\b/.test(promptLower);
    const isArchitectureTask = /\b(architecture|system|structure|pattern|scalable)\b/.test(promptLower);
    const isRefactoringTask = /\b(refactor|refactoring|restructure|improve|clean|modernize)\b/.test(promptLower);
    
    // Prioritize refactoring specialist for refactoring tasks
    if (isRefactoringTask) {
      selectedVoices.push('refactoring-specialist');
    }
    
    // Always include developer for practical implementation
    if (isCodeTask && selectedVoices.length < maxVoices) {
      selectedVoices.push('developer');
    }
    
    // Add security for security-related tasks
    if (isSecurityTask && selectedVoices.length < maxVoices) {
      selectedVoices.push('security');
    }
    
    // Add analyzer for analysis tasks
    if (isAnalysisTask && selectedVoices.length < maxVoices) {
      selectedVoices.push('analyzer');
    }
    
    // Add explorer for creative/experimental tasks
    if (/\b(creative|innovative|alternative|experimental)\b/.test(promptLower) && selectedVoices.length < maxVoices) {
      selectedVoices.push('explorer');
    }
    
    // Add maintainer for stability/maintenance tasks
    if (/\b(maintain|stable|robust|reliable|production)\b/.test(promptLower) && selectedVoices.length < maxVoices) {
      selectedVoices.push('maintainer');
    }
    
    // Add specific specialists based on task
    if (isDesignTask && selectedVoices.length < maxVoices) {
      selectedVoices.push('designer');
    }
    
    if (isPerformanceTask && selectedVoices.length < maxVoices) {
      selectedVoices.push('optimizer');
    }
    
    if (isArchitectureTask && selectedVoices.length < maxVoices) {
      selectedVoices.push('architect');
    }
    
    // Fallback: if no specific voices selected, use general purpose voices
    if (selectedVoices.length === 0) {
      selectedVoices.push('developer');
      if (maxVoices > 1) {
        selectedVoices.push('analyzer');
      }
    }
    
    // Fill remaining slots with complementary voices
    const remainingSlots = maxVoices - selectedVoices.length;
    const allVoices = ['developer', 'analyzer', 'maintainer', 'explorer', 'security', 'architect', 'designer', 'optimizer', 'refactoring-specialist'];
    const unusedVoices = allVoices.filter(v => !selectedVoices.includes(v));
    
    for (let i = 0; i < remainingSlots && i < unusedVoices.length; i++) {
      selectedVoices.push(unusedVoices[i]);
    }
    
    logger.info(`Intelligent voice selection for "${prompt.slice(0, 50)}...": ${selectedVoices.join(', ')}`);
    return selectedVoices;
  }

  /**
   * Generate solutions from multiple voices with intelligent selection
   */
  async generateMultiVoiceSolutions(
    prompt: string,
    voiceIds: string[] | 'auto',
    context: ProjectContext
  ): Promise<VoiceResponse[]> {
    // Use intelligent selection if 'auto' or if too many voices requested
    let selectedVoiceIds: string[];
    
    if (voiceIds === 'auto') {
      selectedVoiceIds = this.selectOptimalVoices(prompt, 2);
    } else if (Array.isArray(voiceIds) && voiceIds.length > 3) {
      // Limit to 3 voices max for performance, intelligently select best ones
      logger.warn(`Too many voices requested (${voiceIds.length}), intelligently selecting 3 best voices`);
      selectedVoiceIds = this.selectOptimalVoices(prompt, 3);
    } else if (Array.isArray(voiceIds)) {
      selectedVoiceIds = voiceIds;
    } else {
      selectedVoiceIds = this.selectOptimalVoices(prompt, 2);
    }

    logger.info(`Generating solutions with voices: ${selectedVoiceIds.join(', ')}`);

    // Validate and filter available voices
    const availableVoices = selectedVoiceIds
      .map(id => this.voices.get(id.toLowerCase()))
      .filter(voice => voice !== undefined) as VoiceArchetype[];

    if (availableVoices.length === 0) {
      throw new Error('No valid voices found');
    }

    // Generate responses sequentially for better user experience and reliability
    // (Sequential is more stable and provides better feedback to users)
    const responses = await this.generateSequential(availableVoices, prompt, context);

    logger.info(`Generated ${responses.length} voice responses`);
    return responses;
  }

  /**
   * Generate responses in parallel for faster results
   */
  private async generateParallel(
    voices: VoiceArchetype[],
    prompt: string,
    context: ProjectContext
  ): Promise<VoiceResponse[]> {
    const batchSize = Math.min(voices.length, this.config.voices.maxConcurrent);
    const batches = this.chunkArray(voices, batchSize);
    const allResponses: VoiceResponse[] = [];

    for (const batch of batches) {
      const batchPromises = batch.map(voice =>
        this.modelClient.generateVoiceResponse(voice, prompt, context)
          .catch(error => {
            logger.warn(`Voice ${voice.name} failed:`, error);
            return null;
          })
      );

      const batchResults = await Promise.all(batchPromises);
      const successfulResults = batchResults.filter(result => result !== null) as VoiceResponse[];
      allResponses.push(...successfulResults);
    }

    return allResponses;
  }

  /**
   * Generate responses sequentially for more stable results with user feedback
   */
  private async generateSequential(
    voices: VoiceArchetype[],
    prompt: string,
    context: ProjectContext
  ): Promise<VoiceResponse[]> {
    const responses: VoiceResponse[] = [];

    for (let i = 0; i < voices.length; i++) {
      const voice = voices[i];
      try {
        console.log(`🎭 Generating response from ${voice.name} (${i + 1}/${voices.length})...`);
        const response = await this.modelClient.generateVoiceResponse(voice, prompt, context);
        responses.push(response);
        console.log(`✅ ${voice.name} completed (${response.content.length} characters)`);
      } catch (error) {
        logger.warn(`Voice ${voice.name} failed:`, error);
        console.log(`❌ ${voice.name} failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        // Continue with other voices
      }
    }

    return responses;
  }

  /**
   * Generate response from a single voice (no synthesis)
   */
  async generateSingleVoiceResponse(
    prompt: string,
    voiceId: string,
    context: ProjectContext
  ): Promise<VoiceResponse> {
    const voice = this.voices.get(voiceId.toLowerCase());
    if (!voice) {
      throw new Error(`Voice '${voiceId}' not found`);
    }

    logger.info(`Generating single response with voice: ${voice.name}`);
    console.log(`🎭 Generating response from ${voice.name}...`);
    
    try {
      const response = await this.modelClient.generateVoiceResponse(voice, prompt, context);
      console.log(`✅ ${voice.name} completed (${response.content.length} characters)`);
      return response;
    } catch (error) {
      logger.error(`Single voice generation failed for ${voice.name}:`, error);
      throw error;
    }
  }

  /**
   * Iterative Writer/Auditor loop for automated code improvement
   */
  async generateIterativeCodeImprovement(
    prompt: string,
    context: ProjectContext,
    maxIterations: number = 5,
    qualityThreshold: number = 85
  ): Promise<IterativeResult> {
    const iterations: IterationLog[] = [];
    let currentCode = '';
    let currentIteration = 0;
    let qualityScore = 0;
    
    // Get Writer and Auditor voices
    const writerVoice = this.voices.get('developer') || this.voices.get('implementor');
    const auditorVoice = this.voices.get('analyzer') || this.voices.get('maintainer');
    
    if (!writerVoice || !auditorVoice) {
      throw new Error('Writer or Auditor voice not available');
    }

    console.log(`🔄 Starting iterative Writer/Auditor loop (max ${maxIterations} iterations, target quality: ${qualityThreshold})`);
    logger.info(`Starting iterative improvement: ${writerVoice.name} (Writer) + ${auditorVoice.name} (Auditor)`);

    while (currentIteration < maxIterations && qualityScore < qualityThreshold) {
      currentIteration++;
      
      console.log(`\n📝 Iteration ${currentIteration}/${maxIterations}`);
      
      // Writer phase
      const writerPrompt = currentIteration === 1 
        ? prompt 
        : `Improve the following code based on the audit feedback:

Previous Code:
\`\`\`
${currentCode}
\`\`\`

Previous Audit Results:
${iterations[iterations.length - 1]?.auditFeedback || 'Initial generation'}

Task: ${prompt}

Generate improved code that addresses the audit concerns.`;

      console.log(`🖊️  Writer (${writerVoice.name}) generating code...`);
      const writerResponse = await this.modelClient.generateVoiceResponse(
        writerVoice, 
        writerPrompt, 
        context
      );
      
      // Extract code from writer response
      const codeBlocks = this.extractCodeBlocks(writerResponse.content);
      currentCode = codeBlocks.length > 0 ? codeBlocks.join('\n\n') : writerResponse.content;
      
      console.log(`✅ Writer completed (${currentCode.length} characters)`);

      // Auditor phase
      const auditorPrompt = `Review and audit the following code for quality, best practices, security, and performance:

Code to Review:
\`\`\`
${currentCode}
\`\`\`

Original Requirements: ${prompt}

Provide:
1. Quality score (0-100)
2. Specific issues found
3. Improvement suggestions
4. Security concerns
5. Performance considerations
6. Overall assessment

Format your response with a clear QUALITY_SCORE: X at the beginning.`;

      console.log(`🔍 Auditor (${auditorVoice.name}) reviewing code...`);
      const auditorResponse = await this.modelClient.generateVoiceResponse(
        auditorVoice, 
        auditorPrompt, 
        context
      );
      
      // Extract quality score from auditor response
      qualityScore = this.extractQualityScore(auditorResponse.content);
      
      console.log(`✅ Auditor completed - Quality Score: ${qualityScore}/100`);

      // Calculate diff from previous iteration
      const diff = currentIteration > 1 
        ? this.calculateSimpleDiff(iterations[iterations.length - 1].code, currentCode)
        : { added: currentCode.split('\n').length, removed: 0, modified: 0 };

      // Log this iteration
      iterations.push({
        iteration: currentIteration,
        writerResponse: writerResponse.content,
        auditFeedback: auditorResponse.content,
        code: currentCode,
        qualityScore,
        diff,
        timestamp: Date.now()
      });

      // Check if we've reached the quality threshold
      if (qualityScore >= qualityThreshold) {
        console.log(`🎯 Quality threshold reached! (${qualityScore} >= ${qualityThreshold})`);
        break;
      } else if (currentIteration < maxIterations) {
        console.log(`📊 Quality: ${qualityScore}/${qualityThreshold} - Continuing...`);
      }
    }

    const finalResult: IterativeResult = {
      finalCode: currentCode,
      finalQualityScore: qualityScore,
      totalIterations: currentIteration,
      iterations,
      converged: qualityScore >= qualityThreshold,
      writerVoice: writerVoice.name,
      auditorVoice: auditorVoice.name,
      timestamp: Date.now()
    };

    console.log(`\n🏁 Iterative improvement completed:`);
    console.log(`   Final Quality Score: ${qualityScore}/100`);
    console.log(`   Total Iterations: ${currentIteration}`);
    console.log(`   Converged: ${finalResult.converged ? 'Yes' : 'No'}`);

    return finalResult;
  }

  /**
   * Extract code blocks from response content
   */
  private extractCodeBlocks(content: string): string[] {
    const codeBlockRegex = /```[\w]*\n([\s\S]*?)\n```/g;
    const matches = [];
    let match;
    
    while ((match = codeBlockRegex.exec(content)) !== null) {
      matches.push(match[1]);
    }
    
    return matches;
  }

  /**
   * Calculate simple diff between two code strings
   */
  private calculateSimpleDiff(oldCode: string, newCode: string): CodeDiff {
    const oldLines = oldCode.split('\n');
    const newLines = newCode.split('\n');
    
    // Simple line-based diff
    const oldSet = new Set(oldLines);
    const newSet = new Set(newLines);
    
    const added = newLines.filter(line => !oldSet.has(line)).length;
    const removed = oldLines.filter(line => !newSet.has(line)).length;
    const common = oldLines.filter(line => newSet.has(line)).length;
    const modified = Math.min(oldLines.length, newLines.length) - common;
    
    return { added, removed, modified };
  }

  /**
   * Extract quality score from analysis content (reuse from LocalModelClient)
   */
  private extractQualityScore(content: string): number {
    // Look for QUALITY_SCORE: X pattern first
    const qualityScoreMatch = content.match(/QUALITY_SCORE:\s*(\d+)/i);
    if (qualityScoreMatch) {
      const score = parseInt(qualityScoreMatch[1]);
      return isNaN(score) ? 70 : Math.min(Math.max(score, 0), 100);
    }

    // Fallback to standard patterns
    const scoreMatch = content.match(/(\d+)\/100|(\d+)\s*out\s*of\s*100|score.*?(\d+)/i);
    if (scoreMatch) {
      const score = parseInt(scoreMatch[1] || scoreMatch[2] || scoreMatch[3]);
      return isNaN(score) ? 70 : Math.min(Math.max(score, 0), 100);
    }

    // Default score if no explicit score found
    return 70;
  }

  /**
   * Synthesize voice responses into a unified solution
   */
  async synthesizeVoiceResponses(
    responses: VoiceResponse[],
    mode: string = 'competitive'
  ): Promise<SynthesisResult> {
    if (responses.length === 0) {
      throw new Error('No responses to synthesize');
    }

    logger.info(`Synthesizing ${responses.length} responses in ${mode} mode`);

    let synthesisResult: SynthesisResult;

    switch (mode.toLowerCase()) {
      case 'consensus':
        synthesisResult = await this.synthesizeConsensus(responses);
        break;
      case 'collaborative':
        synthesisResult = await this.synthesizeCollaborative(responses);
        break;
      case 'competitive':
      default:
        synthesisResult = await this.synthesizeCompetitive(responses);
        break;
    }

    synthesisResult.synthesisMode = mode;
    synthesisResult.timestamp = Date.now();

    logger.info(`Synthesis complete: ${synthesisResult.qualityScore}/100 quality, ${Math.round(synthesisResult.confidence * 100)}% confidence`);

    return synthesisResult;
  }

  /**
   * Consensus synthesis - find common ground between all voices
   */
  private async synthesizeConsensus(responses: VoiceResponse[]): Promise<SynthesisResult> {
    const synthesisPrompt = `Synthesize these ${responses.length} different coding perspectives into a single, consensus solution that incorporates the best ideas from each while maintaining consistency:

${responses.map((r, i) => `
## ${r.voice} (Confidence: ${Math.round(r.confidence * 100)}%)
${r.content}
`).join('\n')}

Create a unified solution that:
1. Finds common ground between all perspectives
2. Resolves any contradictions diplomatically
3. Provides a balanced, well-rounded approach
4. Includes the strongest ideas from each voice

Respond with:
1. The synthesized code/solution
2. Brief reasoning for your synthesis decisions
3. How each voice contributed to the final result`;

    const synthesizerVoice: VoiceArchetype = {
      id: 'synthesizer',
      name: 'Synthesizer',
      systemPrompt: 'You are a master synthesizer who combines multiple perspectives into coherent solutions. Focus on consensus and balance.',
      temperature: 0.6,
      style: 'balanced'
    };

    const synthesisResponse = await this.modelClient.generateVoiceResponse(
      synthesizerVoice,
      synthesisPrompt,
      { files: [] }
    );

    return this.parseSynthesisResponse(synthesisResponse, responses, 'consensus');
  }

  /**
   * Collaborative synthesis - integrate perspectives into hybrid approach
   */
  private async synthesizeCollaborative(responses: VoiceResponse[]): Promise<SynthesisResult> {
    const synthesisPrompt = `Create a collaborative solution that integrates these ${responses.length} different coding perspectives into a hybrid approach:

${responses.map((r, i) => `
## ${r.voice} (Confidence: ${Math.round(r.confidence * 100)}%)
${r.content}
`).join('\n')}

Build a solution that:
1. Uses complementary strengths from each voice
2. Creates a layered approach where each perspective adds value
3. Maintains cohesion while allowing different aspects to shine
4. Results in a richer, more comprehensive solution

Focus on integration rather than compromise. Show how different perspectives can work together.`;

    const synthesizerVoice: VoiceArchetype = {
      id: 'integrator',
      name: 'Integrator',
      systemPrompt: 'You are an expert at integrating different perspectives into unified solutions. Focus on synergy and complementary strengths.',
      temperature: 0.7,
      style: 'integrative'
    };

    const synthesisResponse = await this.modelClient.generateVoiceResponse(
      synthesizerVoice,
      synthesisPrompt,
      { files: [] }
    );

    return this.parseSynthesisResponse(synthesisResponse, responses, 'collaborative');
  }

  /**
   * Competitive synthesis - select the best aspects from each voice
   */
  private async synthesizeCompetitive(responses: VoiceResponse[]): Promise<SynthesisResult> {
    // Sort responses by confidence
    const sortedResponses = [...responses].sort((a, b) => b.confidence - a.confidence);

    const synthesisPrompt = `Analyze these ${responses.length} different coding solutions and create the best possible result by selecting and combining the strongest elements:

${sortedResponses.map((r, i) => `
## ${r.voice} (Confidence: ${Math.round(r.confidence * 100)}%, Rank: ${i + 1})
${r.content}
`).join('\n')}

Create the optimal solution by:
1. Identifying the best ideas and approaches from each response
2. Combining the strongest technical solutions
3. Using the most confident and well-reasoned elements
4. Creating a superior result that surpasses any individual response

Be selective and merit-based. Choose excellence over consensus.`;

    const synthesizerVoice: VoiceArchetype = {
      id: 'optimizer',
      name: 'Optimizer',
      systemPrompt: 'You are a master optimizer who selects and combines the best elements from multiple solutions to create superior results.',
      temperature: 0.5,
      style: 'selective'
    };

    const synthesisResponse = await this.modelClient.generateVoiceResponse(
      synthesizerVoice,
      synthesisPrompt,
      { files: [] }
    );

    return this.parseSynthesisResponse(synthesisResponse, responses, 'competitive');
  }

  /**
   * Parse synthesis response into structured result
   */
  private parseSynthesisResponse(
    synthesisResponse: VoiceResponse,
    originalResponses: VoiceResponse[],
    mode: string
  ): SynthesisResult {
    const content = synthesisResponse.content;

    // Extract code blocks
    const codeMatches = content.match(/```[\w]*\n([\s\S]*?)\n```/g);
    const combinedCode = codeMatches
      ? codeMatches.map(match => match.replace(/```[\w]*\n|\n```/g, '')).join('\n\n')
      : content;

    // Extract reasoning (text outside code blocks)
    const reasoning = content.replace(/```[\s\S]*?```/g, '').trim();

    // Calculate quality score based on multiple factors
    const qualityScore = this.calculateQualityScore(synthesisResponse, originalResponses);

    // Calculate overall confidence
    const avgConfidence = originalResponses.reduce((sum, r) => sum + r.confidence, 0) / originalResponses.length;
    const confidence = Math.min((avgConfidence + synthesisResponse.confidence) / 2, 1.0);

    return {
      combinedCode,
      reasoning,
      confidence,
      qualityScore,
      voicesUsed: originalResponses.map(r => r.voice),
      synthesisMode: mode,
      timestamp: Date.now()
    };
  }

  /**
   * Calculate quality score for synthesis result
   */
  private calculateQualityScore(
    synthesisResponse: VoiceResponse,
    originalResponses: VoiceResponse[]
  ): number {
    let score = 50; // Base score

    // Synthesis response quality
    score += synthesisResponse.confidence * 30;

    // Average of original responses
    const avgConfidence = originalResponses.reduce((sum, r) => sum + r.confidence, 0) / originalResponses.length;
    score += avgConfidence * 20;

    // Bonus for multiple voices
    if (originalResponses.length >= 3) score += 10;
    if (originalResponses.length >= 5) score += 5;

    // Code complexity bonus
    const codeBlocks = (synthesisResponse.content.match(/```/g) || []).length / 2;
    score += Math.min(codeBlocks * 5, 15);

    return Math.min(Math.max(Math.round(score), 1), 100);
  }

  /**
   * Get available voice archetypes
   */
  getAvailableVoices(): VoiceArchetype[] {
    return Array.from(this.voices.values());
  }

  /**
   * Get specific voice by ID
   */
  getVoice(id: string): VoiceArchetype | undefined {
    return this.voices.get(id.toLowerCase());
  }

  /**
   * Get available presets
   */
  getPresets(): VoicePreset[] {
    return Array.from(this.presets.values());
  }

  /**
   * Get preset by name
   */
  getPreset(name: string): VoicePreset | undefined {
    return this.presets.get(name.toLowerCase());
  }

  /**
   * Apply a preset configuration
   */
  async applyPreset(presetName: string, prompt: string, context: ProjectContext): Promise<SynthesisResult> {
    const preset = this.getPreset(presetName);
    if (!preset) {
      throw new Error(`Preset '${presetName}' not found`);
    }

    logger.info(`Applying preset: ${preset.name}`);

    const responses = await this.generateMultiVoiceSolutions(prompt, preset.voices, context);
    return await this.synthesizeVoiceResponses(responses, preset.mode);
  }

  // Utility methods

  private capitalize(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  private getDefaultVoicesConfig(): any {
    return {
      perspectives: {
        explorer: {
          temperature: 0.9,
          systemPrompt: 'You are Explorer, focused on innovation and creative solutions. Always consider alternative approaches and edge cases.',
          style: 'experimental'
        },
        maintainer: {
          temperature: 0.5,
          systemPrompt: 'You are Maintainer, focused on code stability and long-term maintenance. Prioritize robustness and best practices.',
          style: 'conservative'
        }
      },
      roles: {
        security: {
          temperature: 0.3,
          systemPrompt: 'You are Security Engineer, focused on secure coding practices. Always include security considerations.',
          style: 'defensive'
        }
      },
      presets: {
        full_council: {
          voices: ['explorer', 'maintainer', 'security'],
          synthesis: 'competitive',
          description: 'Complete multi-voice analysis'
        }
      }
    };
  }
}