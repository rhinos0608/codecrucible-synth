export interface VoiceArchetypeSystemInterface {
  getVoice(name: string): any;
  generateMultiVoiceSolutions(voices: string[], prompt: string, context?: any): Promise<any>;
  synthesizeVoiceResponses(responses: Record<string, unknown>[]): Promise<any>;
  recommendVoices(prompt: string, maxVoices?: number): string[];
  getVoicePerspective(voiceId: string, prompt: string): Promise<any>;
  
  // Support both Voice[] and string[] returns for compatibility
  getAvailableVoices(): any[] | string[];
  
  // Added for 2025 optimization system compatibility
  generateSingleVoiceResponse?(voiceId: string, prompt: string, context?: any): Promise<any>;
  getDefaultVoices?(): string[];
  validateVoices?(voices: string[]): boolean | { valid: string[]; invalid: string[]; };
  synthesize?(prompt: string, voices: string[], mode?: string, client?: any): Promise<any>;
  costOptimization?: any;
}
