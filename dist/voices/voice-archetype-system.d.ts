export interface SynthesisResult {
    content: string;
    archetype: string;
    confidence: number;
}
export interface IterativeResult {
    iterations: Array<{
        content: string;
        feedback: string;
        improvement: number;
    }>;
    final: string;
    convergence: boolean;
}
export declare class VoiceArchetypeSystem {
    private archetypes;
    constructor(config?: any);
    synthesize(prompt: string, archetype?: string): Promise<SynthesisResult>;
    iterativeSynthesis(prompt: string, iterations?: number): Promise<IterativeResult>;
    getAvailableArchetypes(): string[];
}
export default VoiceArchetypeSystem;
