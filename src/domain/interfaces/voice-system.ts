/**
 * Voice System Interfaces - Domain Layer
 *
 * Interfaces for voice archetype systems and voice-based interactions.
 */

export interface VoiceArchetypeSystemInterface {
  /**
   * Process a prompt with multiple voices
   */
  processPrompt: (prompt: string, options?: Record<string, unknown>) => Promise<unknown>;

  /**
   * Get available voice archetypes
   */
  getAvailableVoices: () => string[];

  /**
   * Generate multi-voice solutions
   */
  generateMultiVoiceSolutions: (voices: readonly string[], prompt: string) => Promise<unknown>;

  /**
   * Get perspective from a specific voice
   */
  getVoicePerspective: (voiceId: string, prompt: string) => Promise<unknown>;

  /**
   * Get the Living Spiral Coordinator
   */
  getLivingSpiralCoordinator: () => unknown;
}
