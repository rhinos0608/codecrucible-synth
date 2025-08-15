import { logger } from '../core/logger.js';
import YAML from 'yaml';
import { readFile } from 'fs/promises';
import { join } from 'path';
/**
 * Enhanced Voice Archetype System
 *
 * Manages multiple AI voice personalities and synthesizes their responses
 * into cohesive solutions. Each voice brings different perspectives and expertise.
 */
export class VoiceArchetypeSystem {
    modelClient;
    config;
    voices;
    presets;
    constructor(modelClient, config) {
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
    async initializeVoices() {
        try {
            // Load voice configurations
            const voicesConfig = await this.loadVoicesConfig();
            // Initialize perspective voices (analysis engines)
            if (voicesConfig.perspectives) {
                for (const [id, config] of Object.entries(voicesConfig.perspectives)) {
                    this.voices.set(id, {
                        id,
                        name: this.capitalize(id),
                        systemPrompt: config.systemPrompt,
                        temperature: config.temperature,
                        style: config.style
                    });
                }
            }
            // Initialize role voices (specialization engines)
            if (voicesConfig.roles) {
                for (const [id, config] of Object.entries(voicesConfig.roles)) {
                    this.voices.set(id, {
                        id,
                        name: this.capitalize(id),
                        systemPrompt: config.systemPrompt,
                        temperature: config.temperature,
                        style: config.style
                    });
                }
            }
            // Initialize presets
            if (voicesConfig.presets) {
                for (const [name, preset] of Object.entries(voicesConfig.presets)) {
                    this.presets.set(name, {
                        name,
                        voices: preset.voices,
                        mode: preset.synthesis,
                        description: preset.description
                    });
                }
            }
            logger.info(`Initialized ${this.voices.size} voice archetypes and ${this.presets.size} presets`);
        }
        catch (error) {
            logger.error('Failed to initialize voices:', error);
            this.initializeFallbackVoices();
        }
    }
    /**
     * Load voices configuration from YAML file
     */
    async loadVoicesConfig() {
        try {
            const configPath = join(process.cwd(), 'config', 'voices.yaml');
            const content = await readFile(configPath, 'utf8');
            return YAML.parse(content);
        }
        catch (error) {
            logger.warn('Could not load voices config, using defaults');
            return this.getDefaultVoicesConfig();
        }
    }
    /**
     * Initialize fallback voices if configuration loading fails
     */
    initializeFallbackVoices() {
        const fallbackVoices = [
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
            }
        ];
        fallbackVoices.forEach(voice => {
            this.voices.set(voice.id, voice);
        });
        logger.info('Initialized fallback voices');
    }
    /**
     * Generate solutions from multiple voices
     */
    async generateMultiVoiceSolutions(prompt, voiceIds, context) {
        logger.info(`Generating solutions with voices: ${voiceIds.join(', ')}`);
        // Validate and filter available voices
        const availableVoices = voiceIds
            .map(id => this.voices.get(id.toLowerCase()))
            .filter(voice => voice !== undefined);
        if (availableVoices.length === 0) {
            throw new Error('No valid voices found');
        }
        // Generate responses in parallel or sequential based on config
        const responses = this.config.voices.parallel
            ? await this.generateParallel(availableVoices, prompt, context)
            : await this.generateSequential(availableVoices, prompt, context);
        logger.info(`Generated ${responses.length} voice responses`);
        return responses;
    }
    /**
     * Generate responses in parallel for faster results
     */
    async generateParallel(voices, prompt, context) {
        const batchSize = Math.min(voices.length, this.config.voices.maxConcurrent);
        const batches = this.chunkArray(voices, batchSize);
        const allResponses = [];
        for (const batch of batches) {
            const batchPromises = batch.map(voice => this.modelClient.generateVoiceResponse(voice, prompt, context)
                .catch(error => {
                logger.warn(`Voice ${voice.name} failed:`, error);
                return null;
            }));
            const batchResults = await Promise.all(batchPromises);
            const successfulResults = batchResults.filter(result => result !== null);
            allResponses.push(...successfulResults);
        }
        return allResponses;
    }
    /**
     * Generate responses sequentially for more stable results
     */
    async generateSequential(voices, prompt, context) {
        const responses = [];
        for (const voice of voices) {
            try {
                const response = await this.modelClient.generateVoiceResponse(voice, prompt, context);
                responses.push(response);
            }
            catch (error) {
                logger.warn(`Voice ${voice.name} failed:`, error);
                // Continue with other voices
            }
        }
        return responses;
    }
    /**
     * Synthesize voice responses into a unified solution
     */
    async synthesizeVoiceResponses(responses, mode = 'competitive') {
        if (responses.length === 0) {
            throw new Error('No responses to synthesize');
        }
        logger.info(`Synthesizing ${responses.length} responses in ${mode} mode`);
        let synthesisResult;
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
    async synthesizeConsensus(responses) {
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
        const synthesizerVoice = {
            id: 'synthesizer',
            name: 'Synthesizer',
            systemPrompt: 'You are a master synthesizer who combines multiple perspectives into coherent solutions. Focus on consensus and balance.',
            temperature: 0.6,
            style: 'balanced'
        };
        const synthesisResponse = await this.modelClient.generateVoiceResponse(synthesizerVoice, synthesisPrompt, { files: [] });
        return this.parseSynthesisResponse(synthesisResponse, responses, 'consensus');
    }
    /**
     * Collaborative synthesis - integrate perspectives into hybrid approach
     */
    async synthesizeCollaborative(responses) {
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
        const synthesizerVoice = {
            id: 'integrator',
            name: 'Integrator',
            systemPrompt: 'You are an expert at integrating different perspectives into unified solutions. Focus on synergy and complementary strengths.',
            temperature: 0.7,
            style: 'integrative'
        };
        const synthesisResponse = await this.modelClient.generateVoiceResponse(synthesizerVoice, synthesisPrompt, { files: [] });
        return this.parseSynthesisResponse(synthesisResponse, responses, 'collaborative');
    }
    /**
     * Competitive synthesis - select the best aspects from each voice
     */
    async synthesizeCompetitive(responses) {
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
        const synthesizerVoice = {
            id: 'optimizer',
            name: 'Optimizer',
            systemPrompt: 'You are a master optimizer who selects and combines the best elements from multiple solutions to create superior results.',
            temperature: 0.5,
            style: 'selective'
        };
        const synthesisResponse = await this.modelClient.generateVoiceResponse(synthesizerVoice, synthesisPrompt, { files: [] });
        return this.parseSynthesisResponse(synthesisResponse, responses, 'competitive');
    }
    /**
     * Parse synthesis response into structured result
     */
    parseSynthesisResponse(synthesisResponse, originalResponses, mode) {
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
    calculateQualityScore(synthesisResponse, originalResponses) {
        let score = 50; // Base score
        // Synthesis response quality
        score += synthesisResponse.confidence * 30;
        // Average of original responses
        const avgConfidence = originalResponses.reduce((sum, r) => sum + r.confidence, 0) / originalResponses.length;
        score += avgConfidence * 20;
        // Bonus for multiple voices
        if (originalResponses.length >= 3)
            score += 10;
        if (originalResponses.length >= 5)
            score += 5;
        // Code complexity bonus
        const codeBlocks = (synthesisResponse.content.match(/```/g) || []).length / 2;
        score += Math.min(codeBlocks * 5, 15);
        return Math.min(Math.max(Math.round(score), 1), 100);
    }
    /**
     * Get available voice archetypes
     */
    getAvailableVoices() {
        return Array.from(this.voices.values());
    }
    /**
     * Get specific voice by ID
     */
    getVoice(id) {
        return this.voices.get(id.toLowerCase());
    }
    /**
     * Get available presets
     */
    getPresets() {
        return Array.from(this.presets.values());
    }
    /**
     * Get preset by name
     */
    getPreset(name) {
        return this.presets.get(name.toLowerCase());
    }
    /**
     * Apply a preset configuration
     */
    async applyPreset(presetName, prompt, context) {
        const preset = this.getPreset(presetName);
        if (!preset) {
            throw new Error(`Preset '${presetName}' not found`);
        }
        logger.info(`Applying preset: ${preset.name}`);
        const responses = await this.generateMultiVoiceSolutions(prompt, preset.voices, context);
        return await this.synthesizeVoiceResponses(responses, preset.mode);
    }
    // Utility methods
    capitalize(str) {
        return str.charAt(0).toUpperCase() + str.slice(1);
    }
    chunkArray(array, size) {
        const chunks = [];
        for (let i = 0; i < array.length; i += size) {
            chunks.push(array.slice(i, i + size));
        }
        return chunks;
    }
    getDefaultVoicesConfig() {
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
//# sourceMappingURL=voice-archetype-system.js.map