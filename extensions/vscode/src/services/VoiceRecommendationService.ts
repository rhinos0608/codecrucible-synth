// VS Code Extension - Voice Recommendation Service
// Following AI_INSTRUCTIONS.md security patterns and CodingPhilosophy.md consciousness principles

import * as vscode from 'vscode';
import { CodeCrucibleApi } from './CodeCrucibleApi';
import { CodeContext } from '../utils/ContextExtractor';

export interface VoiceRecommendation {
  voices: {
    perspectives: string[];
    roles: string[];
  };
  confidence: number;
  reasoning: string;
  contextMatch: number;
}

export class VoiceRecommendationService {
  private api: CodeCrucibleApi;

  constructor(api: CodeCrucibleApi) {
    this.api = api;
  }

  async getRecommendations(prompt: string, context?: CodeContext): Promise<VoiceRecommendation[]> {
    try {
      // Analyze prompt for technical domains
      const domains = this.analyzePromptDomains(prompt, context);
      
      // Get AI-powered recommendations from API
      let apiRecommendations: VoiceRecommendation[] = [];
      try {
        const response = await this.api.getRecommendations(prompt, {
          language: context?.language,
          projectType: context?.projectType,
          dependencies: context?.dependencies,
          domains
        });

        apiRecommendations = response.recommendations.map(rec => ({
          voices: this.parseVoiceType(rec.voiceType),
          confidence: rec.confidence,
          reasoning: rec.reasoning,
          contextMatch: 85
        }));
      } catch (error) {
        console.warn('API recommendations failed, using local analysis:', error);
      }

      // Generate local recommendations as fallback
      const localRecommendations = this.generateLocalRecommendations(prompt, context, domains);

      // Combine and deduplicate recommendations
      const allRecommendations = [...apiRecommendations, ...localRecommendations];
      const uniqueRecommendations = this.deduplicateRecommendations(allRecommendations);

      return uniqueRecommendations.slice(0, 5); // Top 5 recommendations
    } catch (error) {
      console.error('Voice recommendations failed:', error);
      // Return default recommendations for any prompt
      return this.getDefaultRecommendations();
    }
  }

  private analyzePromptDomains(prompt: string, context?: CodeContext): string[] {
    const domains: string[] = [];
    const lowerPrompt = prompt.toLowerCase();

    // Technical domain detection
    const domainPatterns = {
      'react': ['react', 'jsx', 'component', 'hooks', 'state'],
      'typescript': ['typescript', 'types', 'interface', 'generic'],
      'api': ['api', 'endpoint', 'rest', 'http', 'fetch'],
      'security': ['security', 'auth', 'login', 'encrypt', 'validate'],
      'performance': ['performance', 'optimize', 'speed', 'memory', 'cache'],
      'ui': ['ui', 'interface', 'design', 'layout', 'responsive'],
      'database': ['database', 'sql', 'query', 'model', 'migration'],
      'testing': ['test', 'unit', 'integration', 'mock', 'spec'],
      'architecture': ['architecture', 'pattern', 'design', 'structure'],
      'deployment': ['deploy', 'production', 'build', 'ci/cd', 'docker']
    };

    for (const [domain, keywords] of Object.entries(domainPatterns)) {
      if (keywords.some(keyword => lowerPrompt.includes(keyword))) {
        domains.push(domain);
      }
    }

    // Add context-based domains
    if (context) {
      if (context.language === 'typescript' || context.language === 'javascript') {
        domains.push('frontend');
      }
      if (context.projectType === 'nodejs') {
        domains.push('backend');
      }
      if (context.dependencies?.some(dep => dep.includes('react'))) {
        domains.push('react');
      }
    }

    return domains;
  }

  private generateLocalRecommendations(prompt: string, context?: CodeContext, domains: string[] = []): VoiceRecommendation[] {
    const recommendations: VoiceRecommendation[] = [];

    // Domain-specific voice mappings
    const voiceMappings = {
      'react': {
        perspectives: ['Developer', 'Explorer'],
        roles: ['UI/UX Engineer', 'Systems Architect'],
        reasoning: 'React development benefits from component design expertise and user experience focus'
      },
      'security': {
        perspectives: ['Analyzer', 'Maintainer'],
        roles: ['Security Engineer', 'Systems Architect'],
        reasoning: 'Security implementation requires thorough analysis and architectural considerations'
      },
      'performance': {
        perspectives: ['Implementor', 'Analyzer'],
        roles: ['Performance Engineer', 'Systems Architect'],
        reasoning: 'Performance optimization needs implementation expertise and system analysis'
      },
      'api': {
        perspectives: ['Developer', 'Maintainer'],
        roles: ['Systems Architect', 'Performance Engineer'],
        reasoning: 'API development requires solid architecture and maintainable code patterns'
      },
      'ui': {
        perspectives: ['Developer', 'Explorer'],
        roles: ['UI/UX Engineer', 'Performance Engineer'],
        reasoning: 'UI development combines creative exploration with technical implementation'
      },
      'testing': {
        perspectives: ['Analyzer', 'Maintainer'],
        roles: ['Security Engineer', 'Systems Architect'],
        reasoning: 'Testing requires analytical thinking and systematic quality assurance'
      }
    };

    // Generate recommendations based on detected domains
    for (const domain of domains) {
      if (voiceMappings[domain]) {
        const mapping = voiceMappings[domain];
        recommendations.push({
          voices: {
            perspectives: mapping.perspectives,
            roles: mapping.roles
          },
          confidence: 80,
          reasoning: mapping.reasoning,
          contextMatch: 75
        });
      }
    }

    // Add general recommendations if no specific domains detected
    if (recommendations.length === 0) {
      recommendations.push(
        {
          voices: {
            perspectives: ['Explorer', 'Developer'],
            roles: ['Systems Architect', 'Performance Engineer']
          },
          confidence: 70,
          reasoning: 'Balanced approach combining exploration and implementation',
          contextMatch: 60
        },
        {
          voices: {
            perspectives: ['Analyzer', 'Maintainer'],
            roles: ['Security Engineer', 'UI/UX Engineer']
          },
          confidence: 65,
          reasoning: 'Quality-focused approach with user experience considerations',
          contextMatch: 55
        }
      );
    }

    return recommendations;
  }

  private parseVoiceType(voiceType: string): { perspectives: string[]; roles: string[] } {
    // Parse voice type string like "Explorer + Systems Architect" or "Developer, Analyzer + Security Engineer"
    const [perspectivePart, rolePart] = voiceType.split(' + ');
    
    const perspectives = perspectivePart ? perspectivePart.split(', ').map(s => s.trim()) : [];
    const roles = rolePart ? rolePart.split(', ').map(s => s.trim()) : [];
    
    return { perspectives, roles };
  }

  private deduplicateRecommendations(recommendations: VoiceRecommendation[]): VoiceRecommendation[] {
    const seen = new Set<string>();
    const unique: VoiceRecommendation[] = [];

    for (const rec of recommendations) {
      const key = JSON.stringify({
        perspectives: rec.voices.perspectives.sort(),
        roles: rec.voices.roles.sort()
      });

      if (!seen.has(key)) {
        seen.add(key);
        unique.push(rec);
      }
    }

    return unique.sort((a, b) => b.confidence - a.confidence);
  }

  private getDefaultRecommendations(): VoiceRecommendation[] {
    return [
      {
        voices: {
          perspectives: ['Explorer', 'Developer'],
          roles: ['Systems Architect', 'Performance Engineer']
        },
        confidence: 75,
        reasoning: 'Balanced development approach with architectural focus',
        contextMatch: 70
      },
      {
        voices: {
          perspectives: ['Analyzer', 'Maintainer'],
          roles: ['Security Engineer', 'UI/UX Engineer']
        },
        confidence: 70,
        reasoning: 'Quality and security-focused development',
        contextMatch: 65
      }
    ];
  }

  // Quick recommendations for common scenarios
  getQuickRecommendations(): Array<{ label: string; voices: any; description: string }> {
    return [
      {
        label: '🚀 Full Stack Development',
        voices: { perspectives: ['Developer', 'Explorer'], roles: ['Systems Architect', 'Performance Engineer'] },
        description: 'Balanced approach for complete feature development'
      },
      {
        label: '🔒 Security & Quality',
        voices: { perspectives: ['Analyzer', 'Maintainer'], roles: ['Security Engineer', 'Systems Architect'] },
        description: 'Security-first development with quality assurance'
      },
      {
        label: '🎨 Frontend & UX',
        voices: { perspectives: ['Developer', 'Explorer'], roles: ['UI/UX Engineer', 'Performance Engineer'] },
        description: 'User experience focused with performance optimization'
      },
      {
        label: '⚡ Performance & Scale',
        voices: { perspectives: ['Implementor', 'Analyzer'], roles: ['Performance Engineer', 'Systems Architect'] },
        description: 'High-performance, scalable system development'
      },
      {
        label: '🔧 Refactoring & Maintenance',
        voices: { perspectives: ['Maintainer', 'Analyzer'], roles: ['Systems Architect', 'Security Engineer'] },
        description: 'Code improvement and technical debt reduction'
      }
    ];
  }
}