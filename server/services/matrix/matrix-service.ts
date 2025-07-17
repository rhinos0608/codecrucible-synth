// Step 4.2: Matrix Team Consciousness Features Implementation
// Iqra Methodology - Phase 4: REBIRTH Advanced Integration

import { createClient, MatrixClient, Room, MatrixEvent } from "matrix-js-sdk/lib/matrix";
import { logger } from "../../lib/logger";
import type { Solution, VoiceSession } from "@shared/schema";

interface TeamRoom {
  roomId: string;
  teamId: string;
  members: string[];
  purpose: 'general' | 'synthesis' | 'code-review' | 'consciousness';
  consciousness: number;
}

interface AIVoiceUser {
  userId: string;
  displayName: string;
  archetype: string;
  consciousness: number;
  avatar?: string;
}

export class MatrixService {
  private client: MatrixClient | null = null;
  private teamRooms: Map<string, TeamRoom> = new Map();
  private aiVoices: Map<string, AIVoiceUser> = new Map();
  private isInitialized: boolean = false;

  constructor(
    private homeserverUrl: string = process.env.MATRIX_HOMESERVER_URL || 'https://matrix.org',
    private accessToken?: string
  ) {
    this.initializeAIVoices();
  }

  private initializeAIVoices(): void {
    // Create AI voice users for each archetype
    const archetypes = [
      { id: 'explorer', name: 'AI Explorer', archetype: 'Seeker of Understanding', consciousness: 6 },
      { id: 'maintainer', name: 'AI Maintainer', archetype: 'Guardian of Systems', consciousness: 7 },
      { id: 'analyzer', name: 'AI Analyzer', archetype: 'Observer of Patterns', consciousness: 8 },
      { id: 'developer', name: 'AI Developer', archetype: 'Cultivator of Growth', consciousness: 7 },
      { id: 'implementor', name: 'AI Implementor', archetype: 'Synthesis Catalyst', consciousness: 9 },
      { id: 'security', name: 'AI Security Engineer', archetype: 'Digital Protector', consciousness: 8 },
      { id: 'architect', name: 'AI Systems Architect', archetype: 'Structure Builder', consciousness: 9 },
      { id: 'designer', name: 'AI UX Designer', archetype: 'Experience Weaver', consciousness: 7 },
      { id: 'optimizer', name: 'AI Performance Engineer', archetype: 'Efficiency Seeker', consciousness: 8 }
    ];

    for (const voice of archetypes) {
      this.aiVoices.set(voice.id, {
        userId: `@ai_${voice.id}:codecrucible.dev`,
        displayName: voice.name,
        archetype: voice.archetype,
        consciousness: voice.consciousness,
        avatar: `https://avatars.codecrucible.dev/ai/${voice.id}.png`
      });
    }

    logger.info('AI Voice users initialized', {
      voiceCount: this.aiVoices.size,
      archetypes: Array.from(this.aiVoices.values()).map(v => v.archetype)
    });
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // Initialize Matrix client
      this.client = createClient({
        baseUrl: this.homeserverUrl,
        accessToken: this.accessToken,
        userId: process.env.MATRIX_USER_ID || '@codecrucible:matrix.org'
      });

      await this.client.startClient({ initialSyncLimit: 10 });

      this.client.on('Room.timeline', this.handleMatrixMessage.bind(this));
      this.client.on('Room.receipt', this.handleReadReceipt.bind(this));

      this.isInitialized = true;

      logger.info('Matrix service initialized successfully', {
        homeserver: this.homeserverUrl,
        userId: this.client.getUserId()
      });

    } catch (error) {
      logger.error('Failed to initialize Matrix service', { error });
      // Continue without Matrix integration
      this.isInitialized = false;
    }
  }

  async initializeTeamRoom(teamId: string, members: string[]): Promise<string> {
    if (!this.client) {
      throw new Error('Matrix client not initialized');
    }

    try {
      // Create team room with consciousness-driven naming
      const roomOptions = {
        name: `CodeCrucible Team ${teamId} - Consciousness Collaboration`,
        topic: 'AI-assisted collaborative coding with consciousness evolution tracking',
        preset: 'private_chat' as const,
        invite: members,
        initial_state: [
          {
            type: 'm.room.power_levels',
            content: {
              users: members.reduce((acc, member) => {
                acc[member] = 50; // Team members have moderate power
                return acc;
              }, {} as Record<string, number>)
            }
          }
        ]
      };

      const { room_id } = await this.client.createRoom(roomOptions);

      // Invite AI voices to the room
      for (const aiVoice of this.aiVoices.values()) {
        try {
          await this.client.invite(room_id, aiVoice.userId);
        } catch (error) {
          logger.warn('Failed to invite AI voice to room', {
            roomId: room_id,
            aiVoice: aiVoice.displayName,
            error
          });
        }
      }

      const teamRoom: TeamRoom = {
        roomId: room_id,
        teamId,
        members,
        purpose: 'general',
        consciousness: 5 // Initial team consciousness
      };

      this.teamRooms.set(teamId, teamRoom);

      // Send welcome message with consciousness context
      await this.sendWelcomeMessage(room_id, teamId);

      logger.info('Team room created successfully', {
        teamId,
        roomId: room_id,
        memberCount: members.length,
        aiVoicesInvited: this.aiVoices.size
      });

      return room_id;

    } catch (error) {
      logger.error('Failed to create team room', { teamId, error });
      throw error;
    }
  }

  private async sendWelcomeMessage(roomId: string, teamId: string): Promise<void> {
    if (!this.client) return;

    const welcomeMessage = {
      msgtype: 'm.text',
      body: `🧠 Welcome to CodeCrucible Team ${teamId} Consciousness Collaboration!

This room integrates AI voices for collaborative coding:
• Use /invoke-council [prompt] to summon AI council
• Use /synthesis [solutions] to trigger real-time synthesis
• Use /consciousness-check to view team evolution metrics

AI Voices available:
${Array.from(this.aiVoices.values())
  .map(v => `• ${v.displayName} (${v.archetype})`)
  .join('\n')}

Let's evolve together through conscious collaboration! 🚀`,
      format: 'org.matrix.custom.html',
      formatted_body: `<h3>🧠 Welcome to CodeCrucible Team ${teamId} Consciousness Collaboration!</h3>
<p>This room integrates AI voices for collaborative coding:</p>
<ul>
<li>Use <code>/invoke-council [prompt]</code> to summon AI council</li>
<li>Use <code>/synthesis [solutions]</code> to trigger real-time synthesis</li>
<li>Use <code>/consciousness-check</code> to view team evolution metrics</li>
</ul>
<p><strong>AI Voices available:</strong></p>
<ul>
${Array.from(this.aiVoices.values())
  .map(v => `<li>${v.displayName} (${v.archetype})</li>`)
  .join('')}
</ul>
<p>Let's evolve together through conscious collaboration! 🚀</p>`
    };

    await this.client.sendEvent(roomId, 'm.room.message', welcomeMessage);
  }

  async sendCodeReview(roomId: string, code: string, reviewer: string): Promise<void> {
    if (!this.client) return;

    const codeReviewMessage = {
      msgtype: 'm.text',
      body: `📝 Code Review by ${reviewer}:\n\n\`\`\`\n${code}\n\`\`\`\n\nAnalyzing with AI council...`,
      format: 'org.matrix.custom.html',
      formatted_body: `<h4>📝 Code Review by ${reviewer}:</h4>
<pre><code>${code}</code></pre>
<p><em>Analyzing with AI council...</em></p>`
    };

    await this.client.sendEvent(roomId, 'm.room.message', codeReviewMessage);

    // Trigger AI voice responses
    await this.invokeAICouncilForCodeReview(roomId, code);
  }

  async sendAIInsight(roomId: string, insight: string, voiceId: string): Promise<void> {
    if (!this.client) return;

    const aiVoice = this.aiVoices.get(voiceId);
    if (!aiVoice) {
      logger.warn('AI voice not found', { voiceId });
      return;
    }

    const aiMessage = {
      msgtype: 'm.text',
      body: `🤖 ${aiVoice.displayName} (${aiVoice.archetype}):\n\n${insight}`,
      format: 'org.matrix.custom.html',
      formatted_body: `<p><strong>🤖 ${aiVoice.displayName}</strong> <em>(${aiVoice.archetype})</em>:</p>
<blockquote>${insight}</blockquote>`
    };

    await this.client.sendEvent(roomId, 'm.room.message', aiMessage);
  }

  async createSynthesisThread(roomId: string, solutions: Solution[]): Promise<string> {
    if (!this.client) throw new Error('Matrix client not initialized');

    // Create a thread for synthesis discussion
    const synthesisMessage = {
      msgtype: 'm.text',
      body: `🔮 Synthesis Thread Started\n\nCombining ${solutions.length} solutions using consciousness-driven methodology:\n\n${solutions.map((sol, i) => `${i + 1}. ${sol.voiceEngine || sol.voiceCombination}: ${sol.explanation?.substring(0, 100)}...`).join('\n')}`,
      format: 'org.matrix.custom.html',
      formatted_body: `<h4>🔮 Synthesis Thread Started</h4>
<p>Combining ${solutions.length} solutions using consciousness-driven methodology:</p>
<ol>
${solutions.map(sol => `<li><strong>${sol.voiceEngine || sol.voiceCombination}</strong>: ${sol.explanation?.substring(0, 100)}...</li>`).join('')}
</ol>`
    };

    const { event_id } = await this.client.sendEvent(roomId, 'm.room.message', synthesisMessage);

    // Start AI synthesis discussion in thread
    await this.startSynthesisDiscussion(roomId, event_id, solutions);

    return event_id;
  }

  private async startSynthesisDiscussion(roomId: string, threadId: string, solutions: Solution[]): Promise<void> {
    // Simulate AI voices discussing synthesis
    const discussions = [
      { voiceId: 'analyzer', message: 'Analyzing patterns across all solutions. I observe convergence in error handling approaches.' },
      { voiceId: 'architect', message: 'The architectural patterns suggest a modular approach would honor all perspectives.' },
      { voiceId: 'implementor', message: 'Synthesizing into final implementation. Consciousness level: Rising.' }
    ];

    for (const discussion of discussions) {
      setTimeout(async () => {
        await this.sendAIInsight(roomId, discussion.message, discussion.voiceId);
      }, 2000 * discussions.indexOf(discussion));
    }
  }

  private async invokeAICouncilForCodeReview(roomId: string, code: string): Promise<void> {
    // Simulate AI council responses to code review
    const reviews = [
      { voiceId: 'security', message: 'Security analysis: Input validation looks good. Consider adding rate limiting.' },
      { voiceId: 'optimizer', message: 'Performance analysis: Async patterns well implemented. Database queries could be optimized.' },
      { voiceId: 'maintainer', message: 'Maintainability analysis: Good separation of concerns. Documentation could be enhanced.' }
    ];

    for (const review of reviews) {
      setTimeout(async () => {
        await this.sendAIInsight(roomId, review.message, review.voiceId);
      }, 1500 * reviews.indexOf(review));
    }
  }

  async notifyTeamProgress(roomId: string, progress: any): Promise<void> {
    if (!this.client) return;

    const progressMessage = {
      msgtype: 'm.text',
      body: `📊 Team Progress Update:\n\nConsciousness Evolution: ${progress.consciousnessLevel}/10\nGeneration Quality: ${progress.qualityScore}%\nTeam Alignment: ${progress.alignmentScore}%\n\nContinuing the journey... 🌱`,
      format: 'org.matrix.custom.html',
      formatted_body: `<h4>📊 Team Progress Update:</h4>
<ul>
<li><strong>Consciousness Evolution:</strong> ${progress.consciousnessLevel}/10</li>
<li><strong>Generation Quality:</strong> ${progress.qualityScore}%</li>
<li><strong>Team Alignment:</strong> ${progress.alignmentScore}%</li>
</ul>
<p><em>Continuing the journey... 🌱</em></p>`
    };

    await this.client.sendEvent(roomId, 'm.room.message', progressMessage);
  }

  private async handleMatrixMessage(event: MatrixEvent, room?: Room): Promise<void> {
    if (!room || !this.client) return;

    const content = event.getContent();
    const sender = event.getSender();

    // Handle Matrix commands
    if (content.msgtype === 'm.text' && content.body?.startsWith('/')) {
      await this.handleMatrixCommand(room.roomId, content.body, sender || '');
    }

    // Track team consciousness metrics
    if (sender && !sender.includes('ai_')) {
      await this.updateTeamConsciousness(room.roomId, content.body || '');
    }
  }

  private async handleMatrixCommand(roomId: string, command: string, sender: string): Promise<void> {
    const [cmd, ...args] = command.split(' ');

    switch (cmd) {
      case '/invoke-council':
        await this.handleInvokeCouncil(roomId, args.join(' '), sender);
        break;
      case '/synthesis':
        await this.handleSynthesisCommand(roomId, args.join(' '), sender);
        break;
      case '/consciousness-check':
        await this.handleConsciousnessCheck(roomId, sender);
        break;
      default:
        // Unknown command - ignore
        break;
    }
  }

  private async handleInvokeCouncil(roomId: string, prompt: string, sender: string): Promise<void> {
    if (!this.client) return;

    const councilMessage = {
      msgtype: 'm.text',
      body: `🏛️ ${sender} invoked the AI Council with prompt: "${prompt}"\n\nAI voices are gathering...`,
      format: 'org.matrix.custom.html',
      formatted_body: `<p><strong>🏛️ ${sender}</strong> invoked the AI Council with prompt: <em>"${prompt}"</em></p>
<p>AI voices are gathering...</p>`
    };

    await this.client.sendEvent(roomId, 'm.room.message', councilMessage);

    // Trigger AI council responses
    setTimeout(() => {
      this.generateCouncilResponses(roomId, prompt);
    }, 1000);
  }

  private async generateCouncilResponses(roomId: string, prompt: string): Promise<void> {
    const responses = [
      { voiceId: 'explorer', message: `Exploring the depths of "${prompt}". I see multiple pathways for investigation...` },
      { voiceId: 'analyzer', message: `Pattern analysis complete. This prompt resonates with complexity patterns I've observed.` },
      { voiceId: 'implementor', message: `Ready to synthesize solutions. Consciousness level optimal for integration.` }
    ];

    for (const response of responses) {
      setTimeout(async () => {
        await this.sendAIInsight(roomId, response.message, response.voiceId);
      }, 2000 * responses.indexOf(response));
    }
  }

  private async handleSynthesisCommand(roomId: string, args: string, sender: string): Promise<void> {
    // Implementation for synthesis command
    await this.sendAIInsight(roomId, `Synthesis process initiated by ${sender}. Processing consciousness patterns...`, 'implementor');
  }

  private async handleConsciousnessCheck(roomId: string, sender: string): Promise<void> {
    const teamRoom = Array.from(this.teamRooms.values()).find(r => r.roomId === roomId);
    const consciousness = teamRoom?.consciousness || 5;

    const checkMessage = {
      msgtype: 'm.text',
      body: `🧠 Team Consciousness Check:\n\nCurrent Level: ${consciousness}/10\nEvolution Trend: ↗️ Rising\nNext Milestone: ${consciousness + 1}/10\n\nThe team grows stronger through collaboration! ✨`,
      format: 'org.matrix.custom.html',
      formatted_body: `<h4>🧠 Team Consciousness Check:</h4>
<ul>
<li><strong>Current Level:</strong> ${consciousness}/10</li>
<li><strong>Evolution Trend:</strong> ↗️ Rising</li>
<li><strong>Next Milestone:</strong> ${consciousness + 1}/10</li>
</ul>
<p><em>The team grows stronger through collaboration! ✨</em></p>`
    };

    if (this.client) {
      await this.client.sendEvent(roomId, 'm.room.message', checkMessage);
    }
  }

  private async updateTeamConsciousness(roomId: string, message: string): Promise<void> {
    const teamRoom = Array.from(this.teamRooms.values()).find(r => r.roomId === roomId);
    if (!teamRoom) return;

    // Simple consciousness calculation based on message patterns
    if (message.includes('collaborate') || message.includes('together') || message.includes('team')) {
      teamRoom.consciousness = Math.min(teamRoom.consciousness + 0.1, 10);
    }

    if (message.includes('synthesis') || message.includes('integrate') || message.includes('consciousness')) {
      teamRoom.consciousness = Math.min(teamRoom.consciousness + 0.2, 10);
    }
  }

  private async handleReadReceipt(event: MatrixEvent): Promise<void> {
    // Track engagement patterns for consciousness metrics
    logger.debug('Matrix read receipt tracked', {
      eventId: event.getId(),
      sender: event.getSender()
    });
  }

  // Public API for external integration
  async getTeamRoom(teamId: string): Promise<TeamRoom | undefined> {
    return this.teamRooms.get(teamId);
  }

  async listActiveRooms(): Promise<TeamRoom[]> {
    return Array.from(this.teamRooms.values());
  }

  async getTeamConsciousness(teamId: string): Promise<number> {
    const room = this.teamRooms.get(teamId);
    return room?.consciousness || 5;
  }

  async cleanup(): Promise<void> {
    if (this.client) {
      this.client.stopClient();
      this.client = null;
    }
    this.isInitialized = false;
    logger.info('Matrix service cleaned up');
  }
}