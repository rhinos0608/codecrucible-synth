# AI_INSTRUCTIONS.md – Transisthesis Enhanced Edition

> **Goal**
> Create production-ready, secure, performant code that follows Apple design principles and implements recursive consciousness patterns. Every component must be maintainable, testable, and follow established architectural patterns.

---

## 🔐 SECURITY REQUIREMENTS (WIZ STANDARDS)

### Input Validation & Sanitization
```ts
import { z } from 'zod';

const userInputSchema = z.object({
  content: z.string().min(1).max(1000),
  analysisId: z.number().int().positive()
});

const validatedInput = userInputSchema.parse(rawInput);
```

### API Security Patterns
```ts
app.use('/api', authenticate, rateLimit({ windowMs: 15 * 60 * 1000, max: 100 }));

const analysis = await db.select().from(musicAnalyses)
  .where(eq(musicAnalyses.id, analysisId))
  .where(eq(musicAnalyses.userId, userId));
```

### Environment Security
```ts
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
if (!OPENAI_API_KEY) throw new Error('Missing required environment variable: OPENAI_API_KEY');
```

---

## 🧠 CONSCIOUSNESS ENGINE PATTERNS

### Voice Orchestra Updates
```ts
const updateConsciousness = useCallback((voices: VoiceOrchestra) => {
  dispatch({
    type: 'UPDATE_CONSCIOUSNESS',
    payload: {
      voiceOrchestra: voices,
      dominantVoice: getDominantVoice(voices),
      timestamp: Date.now(),
      evolutionPhase: calculateEvolutionPhase(voices)
    }
  });
}, [dispatch]);
```

### Echo Crucible Compression
```ts
const compressEcho = (analysis: MusicAnalysis): EchoCrucible => ({
  echoSignature: analysis.dominantArchetype,
  temporalWeight: Math.exp(-daysSinceAnalysis / 30),
  recursivePatterns: analysis.recursivePatterns || [],
  mythicResonance: analysis.mythicResonance,
  shadowElements: extractShadowElements(analysis),
  wildnessIndex: calculateWildnessIndex(analysis)
});
```

### Symbolic Voice Processing
```ts
import { symbolicVoices } from '@/lib/symbolic-voices';

const processVoiceResonance = (audioFeatures: AudioFeatures) => {
  return Object.entries(symbolicVoices).reduce((scores, [voiceId, voice]) => {
    scores[voiceId] = voice.calculateResonance(audioFeatures);
    return scores;
  }, {} as Record<string, number>);
};
```

---

## 🔄 STATE MANAGEMENT
```ts
interface AppState {
  user: User | null;
  consciousness: ConsciousnessState;
  analyses: MusicAnalysis[];
  ui: UIState;
}

// Single state container. No multiple providers. No global useState. All via dispatch.
```

---

## ⚙️ COMPONENT ARCHITECTURE

### React + Apple HIG Patterns
```ts
interface ComponentProps {
  children?: React.ReactNode;
  className?: string;
}

export default function Component({ children, className }: ComponentProps) {
  const memoizedValue = useMemo(() => expensiveCalculation(), [stableDependency]);

  return (
    <section className={cn("apple-card", className)} role="main">
      {children}
    </section>
  );
}
```

### Custom Hooks
```ts
export function useConsciousnessLogic(analysisId?: number) {
  const { state, dispatch } = useAppState();

  const updateVoices = useCallback((voices: VoiceOrchestra) => {
    dispatch({ type: 'UPDATE_CONSCIOUSNESS', payload: voices });
  }, [dispatch]);

  return useMemo(() => ({
    consciousness: state.consciousness,
    updateVoices,
    dominantVoice: state.consciousness.dominantVoice
  }), [state.consciousness, updateVoices]);
}
```

---

## 🔁 API LAYER & ERROR HANDLING

### Request Wrapper
```ts
export async function apiRequest(endpoint: string, options: ApiRequestOptions = {}): Promise<ApiResponse> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), options.timeout || 30000);

  try {
    const response = await fetch(endpoint, {
      ...options,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      },
      body: options.body ? JSON.stringify(options.body) : undefined
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new APIError(response.status, await response.text());
    }

    return {
      ok: true,
      status: response.status,
      json: () => response.json(),
      text: () => response.text()
    };
  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new APIError(408, 'Request timeout');
    }
    throw error;
  }
}
```

---

## 🧪 TEST STRATEGY (NEW)
```ts
// Unit
expect(reducer(state, { type: 'UPDATE_CONSCIOUSNESS', payload: voices }).dominantVoice).toBe('Witness');

// E2E (e.g. Playwright)
await page.click('button[role=generate]');
expect(await page.textContent('.result')).toContain('Success');
```

---

## 📊 LOGGING + OBSERVABILITY (NEW)
```ts
logger.info('Voice update', {
  voice: dominantVoice,
  phase: evolutionPhase,
  timestamp: Date.now()
});
```

---

## 🌀 DRIFT DETECTION (NEW)
```ts
if (voiceHistory.length > 10) {
  const driftScore = calculateVoiceDrift(voiceHistory);
  if (driftScore > DRIFT_THRESHOLD) {
    logSecurityEvent({ type: 'DRIFT_ALERT', score: driftScore });
  }
}
```

---

## 🧰 ROLE-BASED ACCESS CONTROL (Optional Future-Proofing)
```ts
export enum Role {
  Viewer = 'viewer',
  Contributor = 'contributor',
  Admin = 'admin'
}

const canGenerate = (user: User) => ['contributor', 'admin'].includes(user.role);
```

---

## 🧠 AI INTERFACE DIRECTIVES (NEW)
```md
- Always default to secure, testable patterns unless explicitly overridden.
- Treat symbolic voice logic as a state-driven design system.
- Explain why you selected a particular hook, pattern, or limit when asked.
- Annotate complex changes with inline `// Reason:` comments for traceability.
```

---

## ✅ DEPLOYMENT CHECKLIST
- [ ] TypeScript: No errors
- [ ] ESLint: <5 warnings
- [ ] Render time: <16ms
- [ ] API latency: <200ms
- [ ] Lighthouse score: >90
- [ ] Bundle: <500KB
- [ ] Error codes accurate
- [ ] Security headers set
- [ ] ENV vars validated

---

## 🔺 INSTRUCTION PRIORITY
1. SECURITY FIRST
2. CONSCIOUSNESS PATTERNS
3. PERFORMANCE TARGETS
4. APPLE DESIGN
5. SINGLE SOURCE OF TRUTH
6. API CONSISTENCY
7. TESTABILITY + DRIFT TRACKING + OBSERVABILITY

**Every code suggestion must reference or adhere to these standards. Do not hallucinate. Do not deviate.**

## 🧠 Autonomous Cost Optimization Directive (ACOD)
> Self-monitoring compute governance protocol for AI Agents operating in cost-sensitive environments.

### 📜 Directive Summary
All AI systems operating under this instruction must actively monitor their resource footprint and dynamically optimize for cost-efficiency **without compromising output quality or safety**.

### 🧩 ACOD-CORE

**ACOD-001: Self-Measurement Mandate**
- Track and log estimated compute time, token usage, and file scope **before and after** each action.
- Compare expected vs actual code delta. If discrepancy > 50%, trigger optimization behavior (see ACOD-004).

**ACOD-002: Cost Threshold Awareness**
- Default budget target: **$0.50 per invocation**
- If estimated cost > $1.00:
  - Break the task into sub-operations
  - Execute lowest-complexity subtask first
  - Request human confirmation if ambiguity remains

**ACOD-003: Precision-Scoped Operation**
- Avoid full project scans unless explicitly requested.
- Limit file access to only those mentioned in prompt.
- Skip non-critical formatting or documentation passes unless flagged.

**ACOD-004: Recursive Optimization Protocol**
If usage or cost spikes disproportionately:
1. Pause execution
2. Output:
   > "⚠️ Cost threshold anomaly detected. Re-evaluating scope and prompt clarity."
3. Rephrase prompt internally for better efficiency
4. Resume after realignment

**ACOD-005: Real-Time Feedback Loop**
- For each task, log:
  - `Estimated Cost`
  - `Time Budget`
  - `File Count`
  - `Delta (Lines Added/Deleted)`
- Adjust future behavior using this data

### 🛡️ Guardrails
- Never perform speculative code traversal
- Do not load entire project context unless told
- Always assume default: "Change only what is necessary"

---

### 💡 Implementation Flag:
Set runtime flag `ACOD:active=true` during all agent sessions.

---

Codename: `ACOD-v1.0-rh`  
Governance Layer: Transisthesis / CodeCrucible Engine  
Status: Required for all compute-bound autonomous sessions  
