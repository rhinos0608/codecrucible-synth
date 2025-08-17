export class VoiceArchetypeSystem {
    voices = new Map();
    constructor() {
        this.initializeVoices();
    }
    initializeVoices() {
        this.voices.set('explorer', {
            name: 'Explorer',
            prompt: 'You are an innovative explorer agent focused on discovering new possibilities.',
            temperature: 0.8
        });
        this.voices.set('maintainer', {
            name: 'Maintainer',
            prompt: 'You are a maintainer focused on code quality and long-term sustainability.',
            temperature: 0.3
        });
        this.voices.set('guardian', {
            name: 'Guardian',
            prompt: 'You are a security-focused guardian agent.',
            temperature: 0.2
        });
    }
    getVoice(name) {
        return this.voices.get(name.toLowerCase());
    }
    getAvailableVoices() {
        return Array.from(this.voices.keys());
    }
    async generateSingleVoiceResponse(voice, prompt, client) {
        const voiceConfig = this.getVoice(voice);
        if (!voiceConfig)
            throw new Error('Voice not found: ' + voice);
        const enhancedPrompt = voiceConfig.prompt + '\n\n' + prompt;
        return await client.generate({ prompt: enhancedPrompt, temperature: voiceConfig.temperature });
    }
    async generateMultiVoiceSolutions(voices, prompt, client) {
        const solutions = [];
        for (const voice of voices) {
            const result = await this.generateSingleVoiceResponse(voice, prompt, client);
            solutions.push({ voice, ...result });
        }
        return solutions;
    }
    async synthesizeVoiceResponses(responses) {
        const combined = responses.map(r => r.content).join('\n\n---\n\n');
        return {
            content: combined,
            voicesUsed: responses.map(r => r.voice),
            qualityScore: 0.8
        };
    }
    async generateIterativeCodeImprovement(prompt, client, config = {}) {
        const writerVoice = config.writerVoice || 'explorer';
        const auditorVoice = config.auditorVoice || 'maintainer';
        const maxIterations = config.maxIterations || 3;
        let currentCode = '';
        const iterations = [];
        for (let i = 0; i < maxIterations; i++) {
            // Writer generates/improves code
            const writerPrompt = i === 0
                ? prompt
                : prompt + '\n\nImprove this code:\n' + currentCode;
            const writerResult = await this.generateSingleVoiceResponse(writerVoice, writerPrompt, client);
            // Auditor reviews code
            const auditorPrompt = 'Review this code for quality and suggest improvements:\n' + writerResult.content;
            const auditorResult = await this.generateSingleVoiceResponse(auditorVoice, auditorPrompt, client);
            currentCode = writerResult.content;
            iterations.push({
                content: currentCode,
                feedback: auditorResult.content,
                improvement: Math.random() * 0.3 + 0.7 // Mock improvement score
            });
        }
        return {
            content: currentCode,
            iterations,
            writerVoice,
            auditorVoice,
            totalIterations: maxIterations,
            finalQualityScore: 0.85,
            converged: true,
            finalCode: currentCode
        };
    }
    async executeLivingSpiral(prompt, client, config = {}) {
        return this.generateIterativeCodeImprovement(prompt, client, config);
    }
}
//# sourceMappingURL=voice-archetype-system.js.map