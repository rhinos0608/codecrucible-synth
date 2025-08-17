export declare class VoiceArchetypeSystem {
    private voices;
    constructor();
    private initializeVoices;
    getVoice(name: string): any;
    getAvailableVoices(): string[];
    generateSingleVoiceResponse(voice: string, prompt: string, client: any): Promise<any>;
    generateMultiVoiceSolutions(voices: string[], prompt: string, client: any): Promise<any[]>;
    synthesizeVoiceResponses(responses: any[]): Promise<{
        content: string;
        voicesUsed: any[];
        qualityScore: number;
    }>;
    generateIterativeCodeImprovement(prompt: string, client: any, config?: any): Promise<{
        content: string;
        iterations: {
            content: string;
            feedback: any;
            improvement: number;
        }[];
        writerVoice: any;
        auditorVoice: any;
        totalIterations: any;
        finalQualityScore: number;
        converged: boolean;
        finalCode: string;
    }>;
    executeLivingSpiral(prompt: string, client: any, config?: any): Promise<{
        content: string;
        iterations: {
            content: string;
            feedback: any;
            improvement: number;
        }[];
        writerVoice: any;
        auditorVoice: any;
        totalIterations: any;
        finalQualityScore: number;
        converged: boolean;
        finalCode: string;
    }>;
}
