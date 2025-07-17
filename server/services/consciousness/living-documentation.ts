// Living Documentation System
// Following AI_INSTRUCTIONS.md security patterns and CodingPhilosophy.md consciousness principles

import { logger } from "../../lib/logger";
import type { DatabaseStorage } from "../storage";
import type { MatrixEvent } from "matrix-js-sdk/lib/matrix";

interface DocumentationEntry {
  id: string;
  teamId: string;
  type: 'decision' | 'pattern' | 'evolution' | 'insight';
  title: string;
  content: string;
  context: any;
  timestamp: Date;
  contributors: string[];
  consciousnessLevel: number;
}

interface CodeEvolutionNarrative {
  projectId: string;
  evolutionSteps: EvolutionStep[];
  currentPhase: string;
  consciousnessProgression: number[];
  keyDecisions: DecisionPoint[];
}

interface EvolutionStep {
  timestamp: Date;
  description: string;
  codeChanges: string;
  consciousness: number;
  contributors: string[];
  rationale: string;
}

interface DecisionPoint {
  timestamp: Date;
  decision: string;
  alternatives: string[];
  rationale: string;
  context: string;
  outcomes: string[];
}

interface PatternRecognition {
  patternType: string;
  occurrences: number;
  effectiveness: number;
  evolution: 'emerging' | 'stable' | 'declining';
  examples: string[];
  recommendations: string[];
}

export class LivingDocumentationService {
  private documentationEntries: Map<string, DocumentationEntry[]> = new Map();
  private evolutionNarratives: Map<string, CodeEvolutionNarrative> = new Map();
  private recognizedPatterns: Map<string, PatternRecognition[]> = new Map();

  constructor(private storage: DatabaseStorage) {
    logger.info('Living Documentation Service initialized', {
      features: ['auto-docs', 'evolution-tracking', 'pattern-recognition', 'decision-archive'],
      consciousness: 'Jung + Alexander + Bateson + Campbell integration'
    });
  }

  async processMatrixConversation(
    teamId: string,
    roomId: string,
    messages: MatrixEvent[]
  ): Promise<DocumentationEntry[]> {
    const entries: DocumentationEntry[] = [];

    try {
      // Analyze conversation for documentation-worthy content
      const insights = await this.extractInsights(messages);
      const decisions = await this.extractDecisions(messages);
      const patterns = await this.extractPatterns(messages);

      // Create documentation entries
      for (const insight of insights) {
        entries.push(await this.createDocumentationEntry(teamId, 'insight', insight));
      }

      for (const decision of decisions) {
        entries.push(await this.createDocumentationEntry(teamId, 'decision', decision));
      }

      for (const pattern of patterns) {
        entries.push(await this.createDocumentationEntry(teamId, 'pattern', pattern));
      }

      // Store entries
      const existingEntries = this.documentationEntries.get(teamId) || [];
      existingEntries.push(...entries);
      this.documentationEntries.set(teamId, existingEntries);

      // Update database
      await this.storage.storeLivingDocumentation(teamId, entries);

      logger.info('Matrix conversation processed for documentation', {
        teamId,
        roomId,
        messageCount: messages.length,
        entriesCreated: entries.length
      });

      return entries;

    } catch (error) {
      logger.error('Failed to process Matrix conversation', { teamId, roomId, error });
      return [];
    }
  }

  private async extractInsights(messages: MatrixEvent[]): Promise<any[]> {
    const insights: any[] = [];

    for (const message of messages) {
      const content = message.getContent();
      const body = content.body || '';
      const sender = message.getSender() || '';

      // Look for insight indicators
      if (this.isInsightMessage(body)) {
        insights.push({
          content: body,
          author: sender,
          timestamp: new Date(message.getTs()),
          context: this.extractContext(messages, message),
          consciousness: this.calculateMessageConsciousness(body)
        });
      }
    }

    return insights;
  }

  private async extractDecisions(messages: MatrixEvent[]): Promise<any[]> {
    const decisions: any[] = [];

    for (let i = 0; i < messages.length; i++) {
      const message = messages[i];
      const content = message.getContent();
      const body = content.body || '';

      // Look for decision indicators
      if (this.isDecisionMessage(body)) {
        const context = this.extractDecisionContext(messages, i);
        decisions.push({
          decision: body,
          author: message.getSender(),
          timestamp: new Date(message.getTs()),
          context,
          rationale: this.extractRationale(context),
          consciousness: this.calculateMessageConsciousness(body)
        });
      }
    }

    return decisions;
  }

  private async extractPatterns(messages: MatrixEvent[]): Promise<any[]> {
    const patterns: any[] = [];
    const conversationText = messages.map(m => m.getContent().body || '').join(' ');

    // Identify recurring patterns
    const codePatterns = this.identifyCodePatterns(conversationText);
    const communicationPatterns = this.identifyCommunicationPatterns(messages);
    const consciousnessPatterns = this.identifyConsciousnessPatterns(messages);

    patterns.push(...codePatterns, ...communicationPatterns, ...consciousnessPatterns);

    return patterns;
  }

  private isInsightMessage(body: string): boolean {
    const insightIndicators = [
      'i realize', 'i understand', 'aha', 'insight', 'pattern',
      'connection', 'synthesis', 'integration', 'emergence',
      'consciousness', 'awareness', 'breakthrough'
    ];

    return insightIndicators.some(indicator => 
      body.toLowerCase().includes(indicator)
    );
  }

  private isDecisionMessage(body: string): boolean {
    const decisionIndicators = [
      'we decide', 'decision', 'we choose', 'agreed',
      'consensus', 'resolved', 'final approach',
      'implementation plan', 'next steps'
    ];

    return decisionIndicators.some(indicator => 
      body.toLowerCase().includes(indicator)
    );
  }

  private extractContext(messages: MatrixEvent[], targetMessage: MatrixEvent): any {
    const index = messages.indexOf(targetMessage);
    const contextWindow = 5; // 5 messages before and after

    const contextMessages = messages.slice(
      Math.max(0, index - contextWindow),
      Math.min(messages.length, index + contextWindow + 1)
    );

    return {
      precedingMessages: contextMessages.slice(0, contextWindow).map(m => ({
        author: m.getSender(),
        content: m.getContent().body,
        timestamp: m.getTs()
      })),
      followingMessages: contextMessages.slice(contextWindow + 1).map(m => ({
        author: m.getSender(),
        content: m.getContent().body,
        timestamp: m.getTs()
      }))
    };
  }

  private extractDecisionContext(messages: MatrixEvent[], decisionIndex: number): any {
    const contextWindow = 10;
    const contextMessages = messages.slice(
      Math.max(0, decisionIndex - contextWindow),
      decisionIndex
    );

    // Look for discussion threads leading to decision
    const discussion = contextMessages.map(m => ({
      author: m.getSender(),
      content: m.getContent().body,
      timestamp: m.getTs()
    }));

    // Identify alternatives mentioned
    const alternatives = this.extractAlternatives(contextMessages);

    return { discussion, alternatives };
  }

  private extractAlternatives(messages: MatrixEvent[]): string[] {
    const alternatives: string[] = [];
    const alternativeIndicators = ['alternative', 'option', 'approach', 'way', 'method'];

    for (const message of messages) {
      const body = message.getContent().body || '';
      if (alternativeIndicators.some(indicator => body.toLowerCase().includes(indicator))) {
        alternatives.push(body);
      }
    }

    return alternatives.slice(0, 5); // Top 5 alternatives
  }

  private extractRationale(context: any): string {
    const discussion = context.discussion || [];
    const rationaleMessages = discussion.filter((msg: any) => 
      msg.content.includes('because') || 
      msg.content.includes('reason') ||
      msg.content.includes('rationale')
    );

    return rationaleMessages.map((msg: any) => msg.content).join(' ');
  }

  private calculateMessageConsciousness(body: string): number {
    let consciousness = 5; // Base consciousness

    // Factor in consciousness-related terms
    const consciousnessTerms = [
      'synthesis', 'integration', 'holistic', 'emergence',
      'consciousness', 'awareness', 'evolution', 'transformation'
    ];

    consciousnessTerms.forEach(term => {
      if (body.toLowerCase().includes(term)) consciousness += 0.5;
    });

    // Factor in complexity and depth
    if (body.length > 200) consciousness += 0.5;
    if (body.includes('because') || body.includes('rationale')) consciousness += 0.5;
    if (body.includes('however') || body.includes('although')) consciousness += 0.5;

    return Math.min(consciousness, 10);
  }

  private identifyCodePatterns(conversationText: string): any[] {
    const patterns: any[] = [];

    // Common code patterns mentioned
    if (conversationText.includes('async') && conversationText.includes('await')) {
      patterns.push({
        type: 'async_pattern',
        description: 'Asynchronous programming pattern usage',
        frequency: (conversationText.match(/async|await/g) || []).length,
        context: 'Code discussion'
      });
    }

    if (conversationText.includes('component') && conversationText.includes('react')) {
      patterns.push({
        type: 'react_component_pattern',
        description: 'React component architecture discussion',
        frequency: (conversationText.match(/component/g) || []).length,
        context: 'Frontend architecture'
      });
    }

    return patterns;
  }

  private identifyCommunicationPatterns(messages: MatrixEvent[]): any[] {
    const patterns: any[] = [];
    
    // Analyze communication frequency
    const hourlyDistribution = this.analyzeMessageDistribution(messages);
    if (hourlyDistribution.peakHours.length > 0) {
      patterns.push({
        type: 'communication_rhythm',
        description: `Team communicates most actively during ${hourlyDistribution.peakHours.join(', ')}`,
        frequency: hourlyDistribution.totalMessages,
        context: 'Team collaboration timing'
      });
    }

    // Analyze question-answer patterns
    const qaPatterns = this.analyzeQuestionAnswerPatterns(messages);
    if (qaPatterns.questionCount > 0) {
      patterns.push({
        type: 'knowledge_sharing',
        description: `Active Q&A pattern: ${qaPatterns.questionCount} questions, ${qaPatterns.answerRate}% answered`,
        frequency: qaPatterns.questionCount,
        context: 'Knowledge transfer'
      });
    }

    return patterns;
  }

  private identifyConsciousnessPatterns(messages: MatrixEvent[]): any[] {
    const patterns: any[] = [];
    
    // Track consciousness evolution in conversation
    const consciousnessLevels = messages.map(m => 
      this.calculateMessageConsciousness(m.getContent().body || '')
    );

    const avgConsciousness = consciousnessLevels.reduce((sum, level) => sum + level, 0) / consciousnessLevels.length;
    
    if (avgConsciousness > 7) {
      patterns.push({
        type: 'high_consciousness_dialogue',
        description: `Conversation demonstrates high consciousness level (${avgConsciousness.toFixed(1)}/10)`,
        frequency: consciousnessLevels.length,
        context: 'Consciousness evolution'
      });
    }

    // Track synthesis occurrences
    const synthesisCount = messages.filter(m => 
      (m.getContent().body || '').toLowerCase().includes('synthesis')
    ).length;

    if (synthesisCount > 0) {
      patterns.push({
        type: 'synthesis_focus',
        description: `Strong focus on synthesis and integration (${synthesisCount} mentions)`,
        frequency: synthesisCount,
        context: 'Consciousness integration'
      });
    }

    return patterns;
  }

  private analyzeMessageDistribution(messages: MatrixEvent[]): any {
    const hourlyCount: Record<number, number> = {};
    
    for (const message of messages) {
      const hour = new Date(message.getTs()).getHours();
      hourlyCount[hour] = (hourlyCount[hour] || 0) + 1;
    }

    const sortedHours = Object.entries(hourlyCount)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 3)
      .map(([hour]) => `${hour}:00`);

    return {
      totalMessages: messages.length,
      peakHours: sortedHours,
      distribution: hourlyCount
    };
  }

  private analyzeQuestionAnswerPatterns(messages: MatrixEvent[]): any {
    let questionCount = 0;
    let answeredQuestions = 0;

    for (let i = 0; i < messages.length; i++) {
      const message = messages[i];
      const body = message.getContent().body || '';

      if (body.includes('?')) {
        questionCount++;
        
        // Check if answered in next few messages
        const nextMessages = messages.slice(i + 1, i + 4);
        const hasAnswer = nextMessages.some(nextMsg => {
          const nextBody = nextMsg.getContent().body || '';
          return nextMsg.getSender() !== message.getSender() && nextBody.length > 10;
        });

        if (hasAnswer) answeredQuestions++;
      }
    }

    return {
      questionCount,
      answeredQuestions,
      answerRate: questionCount > 0 ? Math.round((answeredQuestions / questionCount) * 100) : 0
    };
  }

  private async createDocumentationEntry(
    teamId: string,
    type: DocumentationEntry['type'],
    data: any
  ): Promise<DocumentationEntry> {
    return {
      id: `doc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      teamId,
      type,
      title: this.generateTitle(type, data),
      content: this.generateContent(type, data),
      context: data.context || {},
      timestamp: data.timestamp || new Date(),
      contributors: [data.author || 'system'],
      consciousnessLevel: data.consciousness || 5
    };
  }

  private generateTitle(type: string, data: any): string {
    switch (type) {
      case 'insight':
        return `Insight: ${data.content.substring(0, 50)}...`;
      case 'decision':
        return `Decision: ${data.decision.substring(0, 50)}...`;
      case 'pattern':
        return `Pattern: ${data.description || data.type}`;
      case 'evolution':
        return `Evolution: ${data.description}`;
      default:
        return `Documentation: ${type}`;
    }
  }

  private generateContent(type: string, data: any): string {
    switch (type) {
      case 'insight':
        return `**Insight Discovery**\n\n${data.content}\n\n**Context**: ${JSON.stringify(data.context, null, 2)}\n\n**Consciousness Level**: ${data.consciousness}/10`;
      case 'decision':
        return `**Decision Made**\n\n${data.decision}\n\n**Rationale**: ${data.rationale}\n\n**Alternatives Considered**: ${JSON.stringify(data.context.alternatives, null, 2)}`;
      case 'pattern':
        return `**Pattern Identified**\n\n**Type**: ${data.type}\n**Description**: ${data.description}\n**Frequency**: ${data.frequency}\n**Context**: ${data.context}`;
      default:
        return JSON.stringify(data, null, 2);
    }
  }

  // Public API for external integration
  async generateTeamDocumentation(teamId: string): Promise<string> {
    const entries = this.documentationEntries.get(teamId) || [];
    
    let documentation = `# Team ${teamId} Living Documentation\n\n`;
    documentation += `Generated: ${new Date().toISOString()}\n\n`;

    // Group by type
    const byType = entries.reduce((acc, entry) => {
      if (!acc[entry.type]) acc[entry.type] = [];
      acc[entry.type].push(entry);
      return acc;
    }, {} as Record<string, DocumentationEntry[]>);

    // Generate sections
    for (const [type, typeEntries] of Object.entries(byType)) {
      documentation += `## ${type.charAt(0).toUpperCase() + type.slice(1)}s\n\n`;
      
      for (const entry of typeEntries.slice(-10)) { // Last 10 entries per type
        documentation += `### ${entry.title}\n\n`;
        documentation += `${entry.content}\n\n`;
        documentation += `*Contributors: ${entry.contributors.join(', ')} | Consciousness: ${entry.consciousnessLevel}/10*\n\n`;
        documentation += `---\n\n`;
      }
    }

    return documentation;
  }

  async getDocumentationEntries(teamId: string, type?: string): Promise<DocumentationEntry[]> {
    const entries = this.documentationEntries.get(teamId) || [];
    return type ? entries.filter(entry => entry.type === type) : entries;
  }

  async searchDocumentation(teamId: string, query: string): Promise<DocumentationEntry[]> {
    const entries = this.documentationEntries.get(teamId) || [];
    const queryLower = query.toLowerCase();
    
    return entries.filter(entry => 
      entry.title.toLowerCase().includes(queryLower) ||
      entry.content.toLowerCase().includes(queryLower)
    );
  }
}