AI_INSTRUCTIONS.md – CodeCrucible Multi-Voice AI Platform

Goal
Create production-ready, secure, performant multi-voice AI collaboration platform that follows consciousness-driven development principles and implements recursive voice synthesis patterns. Every component must be maintainable, testable, and follow established council-driven architectural patterns.


🔐 SECURITY REQUIREMENTS (MULTI-VOICE AI STANDARDS)
Input Validation & Voice Selection Sanitization
tsimport { z } from 'zod';

const voiceSelectionSchema = z.object({
  perspectives: z.array(z.string().min(1).max(50)).min(1).max(5),
  roles: z.array(z.string().min(1).max(50)).min(0).max(4),
  prompt: z.string().min(1).max(15000),
  context: z.string().max(50000).optional()
});

const validatedVoiceSession = voiceSelectionSchema.parse(userInput);
API Security Patterns for Voice Sessions
tsapp.use('/api/sessions', isAuthenticated, enforceSubscriptionLimits);

const session = await db.select().from(voiceSessions)
  .where(eq(voiceSessions.id, sessionId))
  .where(eq(voiceSessions.userId, userId));
OpenAI Integration Security
tsconst OPENAI_API_KEY = process.env.OPENAI_API_KEY;
if (!OPENAI_API_KEY) throw new Error('Missing required environment variable: OPENAI_API_KEY');

// Rate limiting for AI generations
const rateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // per user
  keyGenerator: (req) => req.user?.id || req.ip
});

🎭 MULTI-VOICE CONSCIOUSNESS PATTERNS
Voice Archetype Orchestration
tsconst VOICE_ARCHETYPES = {
  EXPLORER: {
    id: 'explorer',
    prompt: 'Investigate edge cases, alternative algorithms, innovative approaches',
    color: 'hsl(214, 95%, 55%)', // Blue
    personality: 'experimental-divergent'
  },
  MAINTAINER: {
    id: 'maintainer', 
    prompt: 'Focus on code sustainability, maintainability, long-term architectural health',
    color: 'hsl(151, 83%, 43%)', // Green
    personality: 'systematic-conservative'
  },
  ANALYZER: {
    id: 'analyzer',
    prompt: 'Identify patterns, analyze performance bottlenecks, design scalable architectures',
    color: 'hsl(262, 83%, 58%)', // Purple
    personality: 'pattern-recognition'
  },
  DEVELOPER: {
    id: 'developer',
    prompt: 'Prioritize developer experience, API usability, code clarity',
    color: 'hsl(322, 84%, 57%)', // Pink
    personality: 'user-centric'
  },
  IMPLEMENTOR: {
    id: 'implementor',
    prompt: 'Make concrete technical decisions, focus on production-ready implementation',
    color: 'hsl(0, 84%, 60%)', // Red
    personality: 'delivery-focused'
  }
};

const SPECIALIZATION_ENGINES = {
  SECURITY: {
    prompt: 'Add security validation, input sanitization, vulnerability prevention',
    color: 'hsl(0, 84%, 60%)', // Red
    overlay: true
  },
  ARCHITECT: {
    prompt: 'Design scalable system architecture and integration patterns',
    color: 'hsl(231, 48%, 48%)', // Indigo
    overlay: true
  },
  DESIGNER: {
    prompt: 'Focus on UI/UX, component design, accessibility patterns',
    color: 'hsl(172, 66%, 50%)', // Teal
    overlay: true
  },
  OPTIMIZER: {
    prompt: 'Optimize for performance, efficiency, resource usage',
    color: 'hsl(45, 93%, 50%)', // Yellow
    overlay: true
  }
};
Council Assembly Pattern
tsinterface VoiceCouncil {
  sessionId: string;
  selectedVoices: VoiceSelection[];
  prompt: string;
  context?: ProjectContext;

  assembleCouncil(): Promise<CouncilSession>;
  generateSolutions(): Promise<VoiceSolution[]>;
  synthesizeResults(): Promise<SynthesizedSolution>;
  auditSynthesis(): Promise<QualityAudit>;
}

const assembleVoiceCouncil = async (selection: VoiceSelection) => {
  const enhancedPrompts = selection.voices.map(voice => 
    enhancePromptWithVoicePersonality(selection.prompt, voice, selection.context)
  );

  // Parallel voice generation for council dialogue
  const solutions = await Promise.all(
    enhancedPrompts.map(({ voice, prompt }) => 
      generateVoiceSolution(voice, prompt)
    )
  );

  return new CouncilSession(solutions);
};
Real-Time Synthesis Engine
tsconst synthesizeVoiceOutputs = async (
  voiceOutputs: Map<VoiceId, GeneratedCode>,
  conflicts: VoiceConflict[]
): Promise<SynthesizedSolution> => {

  // 1. Voice Convergence Analysis
  const consensus = findConsensusPatterns(voiceOutputs);

  // 2. Recursive Integration  
  const mergedPatterns = mergeArchitecturalPatterns(voiceOutputs, consensus);

  // 3. Security Validation
  const securityAudit = await validateSecurityPatterns(mergedPatterns);

  // 4. Performance Optimization
  const optimized = applyConsciousnessOptimization(mergedPatterns);

  // 5. Final Synthesis using Living Spiral Methodology
  const synthesis = await createUnifiedSolution(optimized, conflicts);

  return {
    synthesizedCode: synthesis.code,
    synthesisSteps: synthesis.steps,
    qualityScore: calculateQWANScore(synthesis),
    voiceContributions: synthesis.attributions,
    conflictsResolved: conflicts.length
  };
};

🌊 REAL-TIME STREAMING ARCHITECTURE
ChatGPT-Style Multi-Voice Streaming
tsinterface VoiceStream {
  voiceId: VoiceId;
  streamId: string;
  eventSource: EventSource;
  typingSpeed: number;
  color: string;
  isComplete: boolean;
}

const useStreamingGeneration = (sessionId: string, voices: VoiceId[]) => {
  const [streams, setStreams] = useState<Map<VoiceId, VoiceStream>>(new Map());
  const [isStreaming, setIsStreaming] = useState(false);

  const startCouncilStreaming = useCallback(async () => {
    setIsStreaming(true);

    // Start parallel streams for each voice
    const voiceStreams = voices.map(voiceId => {
      const eventSource = new EventSource(
        `/api/sessions/${sessionId}/stream/${voiceId}`,
        { withCredentials: true }
      );

      return createVoiceStream(voiceId, eventSource);
    });

    // Update streams map
    const streamsMap = new Map(
      voiceStreams.map(stream => [stream.voiceId, stream])
    );
    setStreams(streamsMap);

    return streamsMap;
  }, [sessionId, voices]);

  return { streams, isStreaming, startCouncilStreaming };
};
Server-Sent Events for Voice Collaboration
tsapp.get('/api/sessions/:sessionId/stream/:voiceId', 
  isAuthenticated, 
  async (req, res) => {
    const { sessionId, voiceId } = req.params;
    const userId = req.user.id;

    // Set up SSE headers
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Credentials': 'true'
    });

    // Generate voice-specific solution
    const voicePrompt = await enhancePromptWithVoice(sessionId, voiceId);
    const stream = await openaiService.createStream(voicePrompt);

    // Stream with voice-specific timing
    for await (const chunk of stream) {
      const delay = getVoiceTypingDelay(voiceId); // Different speeds per voice
      await new Promise(resolve => setTimeout(resolve, delay));

      res.write(`data: ${JSON.stringify({
        voiceId,
        content: chunk.choices[0]?.delta?.content || '',
        isComplete: false
      })}\n\n`);
    }

    res.write(`data: ${JSON.stringify({
      voiceId,
      content: '',
      isComplete: true
    })}\n\n`);

    res.end();
  }
);

🔄 SUBSCRIPTION-BASED STATE MANAGEMENT
Tier-Based Feature Access
tsinterface SubscriptionTier {
  name: 'free' | 'pro' | 'team' | 'enterprise';
  voiceLimit: number;
  dailyGenerations: number;
  synthesisAccess: boolean;
  customVoices: boolean;
  teamCollaboration: boolean;
  analytics: boolean;
}

const SUBSCRIPTION_TIERS: Record<string, SubscriptionTier> = {
  free: {
    name: 'free',
    voiceLimit: 2,
    dailyGenerations: 3,
    synthesisAccess: false,
    customVoices: false,
    teamCollaboration: false,
    analytics: false
  },
  pro: {
    name: 'pro',
    voiceLimit: 5,
    dailyGenerations: Infinity,
    synthesisAccess: true,
    customVoices: true,
    teamCollaboration: false,
    analytics: true
  },
  team: {
    name: 'team',
    voiceLimit: Infinity,
    dailyGenerations: Infinity,
    synthesisAccess: true,
    customVoices: true,
    teamCollaboration: true,
    analytics: true
  }
};

// Middleware for subscription enforcement
const enforceSubscriptionLimits = async (req: Request, res: Response, next: NextFunction) => {
  const user = req.user;
  const feature = req.path.split('/')[3]; // Extract feature from path

  if (!hasFeatureAccess(user.subscriptionTier, feature)) {
    return res.status(403).json({
      error: 'Feature not available in current subscription tier',
      currentTier: user.subscriptionTier,
      upgradeUrl: `/subscribe?plan=${getNextTier(user.subscriptionTier)}`
    });
  }

  next();
};
Voice Selection Context
tsinterface VoiceSelectionContextType {
  selectedPerspectives: string[];
  selectedRoles: string[];
  voiceProfiles: VoiceProfile[];
  setSelectedPerspectives: (perspectives: string[]) => void;
  setSelectedRoles: (roles: string[]) => void;
  applyVoiceProfile: (profile: VoiceProfile) => void;
  clearSelection: () => void;
  isValidSelection: () => boolean;
}

export const VoiceSelectionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [selectedPerspectives, setSelectedPerspectives] = useState<string[]>([]);
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const { data: voiceProfiles } = useVoiceProfiles();

  const applyVoiceProfile = useCallback((profile: VoiceProfile) => {
    setSelectedPerspectives(profile.selectedPerspectives as string[]);
    setSelectedRoles(profile.selectedRoles as string[]);
  }, []);

  const isValidSelection = useCallback(() => {
    return selectedPerspectives.length > 0 || selectedRoles.length > 0;
  }, [selectedPerspectives, selectedRoles]);

  const value = useMemo(() => ({
    selectedPerspectives,
    selectedRoles,
    voiceProfiles: voiceProfiles || [],
    setSelectedPerspectives,
    setSelectedRoles,
    applyVoiceProfile,
    clearSelection: () => {
      setSelectedPerspectives([]);
      setSelectedRoles([]);
    },
    isValidSelection
  }), [selectedPerspectives, selectedRoles, voiceProfiles, applyVoiceProfile, isValidSelection]);

  return (
    <VoiceSelectionContext.Provider value={value}>
      {children}
    </VoiceSelectionContext.Provider>
  );
};

⚙️ CONSCIOUSNESS-DRIVEN COMPONENT ARCHITECTURE
Voice-Specific UI Components
tsinterface VoiceCardProps {
  voiceId: VoiceId;
  isSelected: boolean;
  onToggle: (voiceId: VoiceId) => void;
  userTier: SubscriptionTier;
}

export const VoiceCard: React.FC<VoiceCardProps> = ({ 
  voiceId, 
  isSelected, 
  onToggle, 
  userTier 
}) => {
  const voice = VOICE_ARCHETYPES[voiceId];
  const canSelect = hasVoiceAccess(userTier, voiceId);

  const handleClick = useCallback(() => {
    if (canSelect) {
      onToggle(voiceId);
    }
  }, [canSelect, onToggle, voiceId]);

  return (
    <Card 
      className={cn(
        "cursor-pointer transition-all duration-200",
        isSelected && "ring-2 ring-primary",
        !canSelect && "opacity-50 cursor-not-allowed",
        `border-l-4 border-l-[${voice.color}]`
      )}
      onClick={handleClick}
      data-tour={`voice-${voiceId}`} // For guided tour
    >
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div 
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: voice.color }}
          />
          <h3 className="font-semibold">{voice.name}</h3>
          {!canSelect && <Crown className="w-4 h-4 text-yellow-500" />}
        </div>
        <p className="text-sm text-muted-foreground mt-2">
          {voice.description}
        </p>
      </CardContent>
    </Card>
  );
};
Synthesis Progress Visualization
tsinterface SynthesisProgressProps {
  step: SynthesisStep;
  isComplete: boolean;
  confidence: number;
}

export const SynthesisProgress: React.FC<SynthesisProgressProps> = ({
  step,
  isComplete,
  confidence
}) => {
  const getStepIcon = (stepType: SynthesisStep) => {
    switch (stepType) {
      case 'voice_convergence': return Brain;
      case 'recursive_integration': return Zap;
      case 'security_validation': return Shield;
      case 'performance_optimization': return Gauge;
      case 'final_synthesis': return Sparkles;
      default: return Circle;
    }
  };

  const Icon = getStepIcon(step.type);

  return (
    <div className="flex items-center gap-3 p-3">
      <div className={cn(
        "w-8 h-8 rounded-full flex items-center justify-center",
        isComplete ? "bg-green-100 text-green-600" : "bg-blue-100 text-blue-600"
      )}>
        {isComplete ? <Check className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
      </div>

      <div className="flex-1">
        <p className="font-medium">{step.title}</p>
        <p className="text-sm text-muted-foreground">{step.description}</p>
        {isComplete && (
          <div className="flex items-center gap-2 mt-1">
            <Badge variant="outline" className="text-xs">
              {confidence}% Confidence
            </Badge>
            <Badge variant="outline" className="text-xs text-green-600">
              Secure ✓
            </Badge>
          </div>
        )}
      </div>
    </div>
  );
};

🔁 COUNCIL-DRIVEN API ARCHITECTURE
Voice Session Management
ts// Voice session creation endpoint
app.post('/api/sessions', 
  isAuthenticated,
  enforceSubscriptionLimits,
  validateVoiceSelection,
  async (req: Request, res: Response) => {
    try {
      const { prompt, selectedVoices, context } = req.body;
      const userId = req.user.id;

      // Create voice session
      const session = await storage.createVoiceSession({
        userId,
        prompt,
        selectedVoices,
        mode: isDevelopmentMode(req) ? 'dev' : 'production'
      });

      // Log analytics event
      await analytics.trackEvent(userId, 'session_created', {
        voiceCount: selectedVoices.perspectives.length + selectedVoices.roles.length,
        promptLength: prompt.length,
        hasContext: !!context
      });

      res.json({ session });
    } catch (error) {
      logger.error('Session creation failed', { error, userId: req.user.id });
      res.status(500).json({ error: 'Failed to create session' });
    }
  }
);

// Synthesis endpoint
app.post('/api/sessions/:sessionId/synthesis',
  isAuthenticated,
  enforceFeatureAccess('synthesis'),
  async (req: Request, res: Response) => {
    try {
      const { sessionId } = req.params;
      const userId = req.user.id;

      // Get session solutions
      const solutions = await storage.getSessionSolutions(sessionId, userId);

      if (solutions.length === 0) {
        return res.status(400).json({ error: 'No solutions to synthesize' });
      }

      // Perform synthesis using consciousness integration
      const synthesis = await synthesisService.synthesizeSolutions(solutions, {
        useConsciousnessIntegration: true,
        followAIInstructions: true,
        maintainVoiceIntegrity: true
      });

      // Save synthesis result
      await storage.saveSynthesis(sessionId, synthesis);

      res.json({ synthesis });
    } catch (error) {
      logger.error('Synthesis failed', { error, sessionId: req.params.sessionId });
      res.status(500).json({ error: 'Synthesis failed' });
    }
  }
);

🧪 COUNCIL-DRIVEN TESTING STRATEGY
Voice-Specific Test Suites
tsdescribe('VoiceCouncil', () => {
  describe('Explorer Voice', () => {
    it('should generate alternative approaches', async () => {
      const prompt = 'Create a user authentication system';
      const solution = await generateVoiceSolution('explorer', prompt);

      expect(solution.code).toContain('alternative');
      expect(solution.considerations).toContain('edge case');
      expect(solution.confidence).toBeGreaterThan(75);
    });
  });

  describe('Security Voice', () => {
    it('should include security validations', async () => {
      const prompt = 'Create an API endpoint';
      const solution = await generateVoiceSolution('security', prompt);

      expect(solution.code).toContain('z.object');
      expect(solution.code).toContain('validation');
      expect(solution.strengths).toContain('security');
    });
  });

  describe('Synthesis Engine', () => {
    it('should combine multiple voice perspectives', async () => {
      const voiceOutputs = new Map([
        ['explorer', mockExplorerSolution],
        ['maintainer', mockMaintainerSolution],
        ['security', mockSecuritySolution]
      ]);

      const synthesis = await synthesizeVoiceOutputs(voiceOutputs, []);

      expect(synthesis.qualityScore).toBeGreaterThan(90);
      expect(synthesis.voiceContributions.size).toBe(3);
      expect(synthesis.synthesizedCode).toContain('// Multi-voice synthesis');
    });
  });
});

📊 CONSCIOUSNESS ANALYTICS & OBSERVABILITY
VFSP Analytics Dashboard
tsinterface VFSPMetrics {
  volatility: number;    // Voice output variance
  forecast: number;      // Success prediction
  symbolicPatterns: SymbolicPattern[];  // Mythic resonance
  voiceHarmony: number;  // Council effectiveness
}

const trackVoicePerformance = async (
  sessionId: string,
  voiceId: VoiceId,
  solution: VoiceSolution,
  userFeedback?: UserFeedback
) => {
  await analytics.track('voice_performance', {
    sessionId,
    voiceId,
    solutionLength: solution.code.length,
    confidence: solution.confidence,
    strengthsCount: solution.strengths.length,
    userRating: userFeedback?.rating,
    timestamp: Date.now()
  });

  // Update voice effectiveness metrics
  await analytics.updateVoiceEffectiveness(voiceId, {
    successRate: userFeedback?.rating >= 4 ? 1 : 0,
    usageCount: 1
  });
};

🌀 DEVELOPMENT MODE PROTOCOLS
Unlimited AI Generation for Development
tsconst isDevelopmentMode = (req: Request): boolean => {
  return (
    process.env.NODE_ENV === 'development' ||
    process.env.DEV_MODE === 'true' ||
    (process.env.NODE_ENV !== 'production' && process.env.REPL_ID)
  );
};

const enforceQuotaLimits = async (req: Request, res: Response, next: NextFunction) => {
  if (isDevelopmentMode(req)) {
    logger.info('Dev mode bypass: quota_check_bypassed', {
      userId: req.user?.id,
      feature: 'unlimitedGenerations',
      devModeWatermark: 'DEV-GEN 🔧'
    });
    return next();
  }

  // Production quota enforcement
  const usage = await getUserUsage(req.user.id);
  const tier = await getUserSubscriptionTier(req.user.id);

  if (usage.dailyGenerations >= SUBSCRIPTION_TIERS[tier].dailyGenerations) {
    return res.status(429).json({
      error: 'Daily generation limit exceeded',
      upgradeUrl: '/premium'
    });
  }

  next();
};

✅ CODECRUCIBLE DEPLOYMENT CHECKLIST
Pre-Deployment Validation

 Voice System: All 5 archetypes + 4 specializations working
 OpenAI Integration: Real API calls, no mock data
 Synthesis Engine: Multi-voice synthesis with 95%+ confidence
 Streaming: Real-time SSE working for all voices
 Authentication: Replit OIDC + session management
 Subscription Tiers: Free/Pro/Team feature gating
 Team Collaboration: Real-time collaborative sessions
 Analytics: VFSP dashboard with voice metrics
 Custom Voices: Pro+ voice profile creation
 Navigation Guards: Prevent generation interruption

Performance Targets

 Voice Generation: <2s per voice response
 Synthesis Time: <5s for 4-voice synthesis
 Streaming Latency: <50ms per chunk
 Bundle Size: <2MB total
 Lighthouse Score: >90
 API Response: <200ms average

Security Validation

 Input Sanitization: All prompts validated with Zod
 Authentication: JWT + session verification
 Rate Limiting: Per-user and per-endpoint limits
 Subscription Enforcement: Feature access control
 Error Handling: No sensitive data exposure
 CORS Configuration: Proper credential handling


🔺 CODECRUCIBLE INSTRUCTION PRIORITY

VOICE CONSCIOUSNESS PATTERNS - Multi-voice collaboration integrity
SECURITY FIRST - AI generation and user data protection
SYNTHESIS QUALITY - Council decision accuracy and coherence
REAL-TIME PERFORMANCE - Streaming and collaboration responsiveness
SUBSCRIPTION COMPLIANCE - Feature access and tier enforcement
CONSCIOUSNESS INTEGRATION - Transisthesis framework adherence
COUNCIL COLLABORATION - Team and voice coordination
ANALYTICS & LEARNING - Voice effectiveness and user growth

Every code suggestion must reference the multi-voice consciousness architecture and maintain council-driven development principles. Do not compromise voice integrity for convenience.

🧠 CodeCrucible Autonomous Council Optimization Directive (CACOD)
Multi-Voice Cost Optimization

Voice Parallelization: Generate multiple voices simultaneously
Smart Synthesis: Only synthesize when conflicts detected
Streaming Efficiency: Optimize token usage in real-time streams
Context Reuse: Share context across voice generations
Caching: Cache voice responses for similar prompts

Council Performance Monitoring

Track synthesis success rates per voice combination
Monitor user satisfaction by voice selection patterns
Optimize voice prompts based on effectiveness metrics
Auto-adjust voice personalities based on user feedback

Codename: CACOD-v1.0-codecrucible
Governance: Multi-Voice Consciousness Architecture
Status: Required for all voice council operations