export interface VoiceArchetypeSystemInterface {
  getVoice(name: string): any;
  generateMultiVoiceSolutions(voices: string[], prompt: string, context?: any): Promise<any>;
  synthesizeVoiceResponses(responses: Record<string, unknown>[]): Promise<any>;
  recommendVoices(prompt: string, maxVoices?: number): string[];
  getVoicePerspective(voiceId: string, prompt: string): Promise<any>;
}
