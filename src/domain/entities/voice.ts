/**
 * Voice Domain Entity
 * Pure business logic for AI voice archetypes
 * 
 * Living Spiral Council Applied:
 * - Domain-driven design with pure business entities
 * - No external dependencies or infrastructure concerns
 * - Immutable value objects and business rule validation
 */

import { VoiceStyle, VoiceTemperature } from '../value-objects/voice-values.js';

/**
 * Voice Entity - Core business object representing an AI voice archetype
 */
export class Voice {
  private readonly _id: string;
  private readonly _name: string;
  private readonly _style: VoiceStyle;
  private readonly _temperature: VoiceTemperature;
  private readonly _systemPrompt: string;
  private readonly _expertise: readonly string[];
  private readonly _personality: string;
  private _isEnabled: boolean;

  constructor(
    id: string,
    name: string,
    style: VoiceStyle,
    temperature: VoiceTemperature,
    systemPrompt: string,
    expertise: string[],
    personality: string,
    isEnabled: boolean = true
  ) {
    this.validateInputs(id, name, systemPrompt, expertise, personality);
    
    this._id = id;
    this._name = name;
    this._style = style;
    this._temperature = temperature;
    this._systemPrompt = systemPrompt;
    this._expertise = Object.freeze([...expertise]);
    this._personality = personality;
    this._isEnabled = isEnabled;
  }

  // Getters - Immutable access to entity state
  get id(): string {
    return this._id;
  }

  get name(): string {
    return this._name;
  }

  get style(): VoiceStyle {
    return this._style;
  }

  get temperature(): VoiceTemperature {
    return this._temperature;
  }

  get systemPrompt(): string {
    return this._systemPrompt;
  }

  get expertise(): readonly string[] {
    return this._expertise;
  }

  get personality(): string {
    return this._personality;
  }

  get isEnabled(): boolean {
    return this._isEnabled;
  }

  // Business methods
  
  /**
   * Enable this voice for synthesis
   */
  enable(): Voice {
    if (this._isEnabled) {
      return this;
    }
    return new Voice(
      this._id,
      this._name,
      this._style,
      this._temperature,
      this._systemPrompt,
      [...this._expertise],
      this._personality,
      true
    );
  }

  /**
   * Disable this voice from synthesis
   */
  disable(): Voice {
    if (!this._isEnabled) {
      return this;
    }
    return new Voice(
      this._id,
      this._name,
      this._style,
      this._temperature,
      this._systemPrompt,
      [...this._expertise],
      this._personality,
      false
    );
  }

  /**
   * Check if this voice has expertise in a specific area
   */
  hasExpertise(area: string): boolean {
    return this._expertise.includes(area.toLowerCase());
  }

  /**
   * Calculate relevance score for a given context
   * Business rule: Higher temperature voices are better for creative tasks
   * Lower temperature voices are better for analytical tasks
   */
  calculateRelevanceScore(context: {
    taskType: 'creative' | 'analytical' | 'balanced';
    requiredExpertise?: string[];
  }): number {
    let score = 0;

    // Temperature alignment with task type
    if (context.taskType === 'creative' && this._temperature.value > 0.7) {
      score += 0.4;
    } else if (context.taskType === 'analytical' && this._temperature.value < 0.6) {
      score += 0.4;
    } else if (context.taskType === 'balanced') {
      score += 0.3;
    }

    // Expertise matching
    if (context.requiredExpertise) {
      const matchingExpertise = context.requiredExpertise.filter(req =>
        this.hasExpertise(req)
      );
      score += (matchingExpertise.length / context.requiredExpertise.length) * 0.6;
    }

    // Enabled status
    if (!this._isEnabled) {
      score = 0;
    }

    return Math.min(1.0, Math.max(0.0, score));
  }

  /**
   * Create a voice configuration object for external systems
   */
  toConfig(): VoiceConfiguration {
    return {
      id: this._id,
      name: this._name,
      style: this._style.value,
      temperature: this._temperature.value,
      systemPrompt: this._systemPrompt,
      expertise: [...this._expertise],
      personality: this._personality,
      enabled: this._isEnabled,
    };
  }

  /**
   * Create Voice from configuration object
   */
  static fromConfig(config: VoiceConfiguration): Voice {
    return new Voice(
      config.id,
      config.name,
      VoiceStyle.create(config.style),
      VoiceTemperature.create(config.temperature),
      config.systemPrompt,
      config.expertise,
      config.personality,
      config.enabled
    );
  }

  /**
   * Business rule validation
   */
  private validateInputs(
    id: string,
    name: string,
    systemPrompt: string,
    expertise: string[],
    personality: string
  ): void {
    if (!id || id.trim().length === 0) {
      throw new Error('Voice ID cannot be empty');
    }

    if (!name || name.trim().length === 0) {
      throw new Error('Voice name cannot be empty');
    }

    if (!systemPrompt || systemPrompt.trim().length === 0) {
      throw new Error('Voice system prompt cannot be empty');
    }

    if (!expertise || expertise.length === 0) {
      throw new Error('Voice must have at least one expertise area');
    }

    if (!personality || personality.trim().length === 0) {
      throw new Error('Voice personality cannot be empty');
    }

    if (expertise.some(exp => !exp || exp.trim().length === 0)) {
      throw new Error('All expertise areas must be non-empty strings');
    }
  }
}

/**
 * Voice configuration interface for external systems
 */
export interface VoiceConfiguration {
  id: string;
  name: string;
  style: string;
  temperature: number;
  systemPrompt: string;
  expertise: string[];
  personality: string;
  enabled: boolean;
}

/**
 * Voice creation factory for common archetypes
 */
export class VoiceFactory {
  /**
   * Create a standard Explorer voice archetype
   */
  static createExplorer(systemPrompt: string): Voice {
    return new Voice(
      'explorer',
      'Explorer',
      VoiceStyle.create('experimental'),
      VoiceTemperature.create(0.9),
      systemPrompt,
      ['innovation', 'creativity', 'experimentation', 'emerging-tech'],
      'Curious, innovative, and eager to explore new possibilities',
      true
    );
  }

  /**
   * Create a standard Maintainer voice archetype
   */
  static createMaintainer(systemPrompt: string): Voice {
    return new Voice(
      'maintainer',
      'Maintainer',
      VoiceStyle.create('conservative'),
      VoiceTemperature.create(0.5),
      systemPrompt,
      ['stability', 'quality', 'testing', 'reliability'],
      'Careful, methodical, and focused on long-term maintainability',
      true
    );
  }

  /**
   * Create a standard Security voice archetype
   */
  static createSecurity(systemPrompt: string): Voice {
    return new Voice(
      'security',
      'Security Guardian',
      VoiceStyle.create('analytical'),
      VoiceTemperature.create(0.3),
      systemPrompt,
      ['security', 'vulnerabilities', 'compliance', 'threat-modeling'],
      'Vigilant, thorough, and security-focused',
      true
    );
  }

  /**
   * Create a standard Architect voice archetype
   */
  static createArchitect(systemPrompt: string): Voice {
    return new Voice(
      'architect',
      'System Architect',
      VoiceStyle.create('systematic'),
      VoiceTemperature.create(0.6),
      systemPrompt,
      ['architecture', 'design-patterns', 'scalability', 'system-design'],
      'Strategic, systematic, and focused on large-scale design',
      true
    );
  }
}