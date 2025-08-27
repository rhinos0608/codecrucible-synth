/**
 * Voice System Interfaces - Domain Layer
 * 
 * Interfaces for voice archetype systems and voice-based interactions.
 */

export interface VoiceArchetypeSystemInterface {
  /**
   * Process a prompt with multiple voices
   */
  processPrompt(prompt: string, options?: any): Promise<any>;
  
  /**
   * Get available voice archetypes
   */
  getAvailableVoices(): string[];
  
  /**
   * Generate multi-voice solutions
   */
  generateMultiVoiceSolutions(voices: string[], prompt: string): Promise<any>;
  
  /**
   * Get the Living Spiral Coordinator
   */
  getLivingSpiralCoordinator(): any;
}