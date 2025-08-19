export declare class VoiceArchetypeSystem {
    private voices;
    constructor();
    private initializeVoices;
    getVoice(name: string): any;
    getAvailableVoices(): string[];
    private calculateImprovementScore;
    generateSingleVoiceResponse(voice: string, prompt: string, client: any): Promise<any>;
    generateMultiVoiceSolutions(voices: string[], prompt: string, client: any): Promise<any[]>;
    synthesize(prompt: string, voices: string[], mode?: 'competitive' | 'collaborative' | 'consensus', client?: any): Promise<{
        content: string;
        voicesUsed: string[];
        qualityScore: number;
        mode: "collaborative" | "consensus" | "competitive";
        responses?: undefined;
    } | {
        content: string;
        voicesUsed: string[];
        qualityScore: number;
        mode: "collaborative" | "consensus" | "competitive";
        responses: any[];
    }>;
    synthesizeVoiceResponses(responses: any[]): Promise<{
        content: string;
        voicesUsed: any[];
        qualityScore: number;
    }>;
    generateIterativeCodeImprovement(prompt: string, client: any, config?: any): Promise<{
        content: string;
        iterations: any[];
        writerVoice: any;
        auditorVoice: any;
        totalIterations: any;
        finalQualityScore: number;
        converged: boolean;
        finalCode: string;
    }>;
    executeLivingSpiral(prompt: string, client: any, config?: any): Promise<{
        content: string;
        iterations: any[];
        writerVoice: any;
        auditorVoice: any;
        totalIterations: any;
        finalQualityScore: number;
        converged: boolean;
        finalCode: string;
    }>;
}
