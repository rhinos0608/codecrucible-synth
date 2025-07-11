# RHYTHM CHAMBER - PRODUCTION AI INSTRUCTIONS

## PROJECT CONTEXT
<context>
Rhythm Chamber is a sophisticated music consciousness analysis platform combining Spotify integration with AI-powered archetypal insights. Built with React 18, TypeScript, Express.js, and PostgreSQL. Uses OpenAI for consciousness analysis and Framer Motion for interactions.
</context>

<goal>
Create production-ready, secure, performant code that follows Apple design principles and implements recursive consciousness patterns. Every component must be maintainable, testable, and follow established architectural patterns.
</goal>

<constraints>
- React 18 with TypeScript strict mode
- Single source of truth state management
- Apple design system compliance
- Performance targets: <16ms renders, <200ms API, >90 Lighthouse
- Security-first development practices
- Consciousness engine pattern consistency
</constraints>

---

## SECURITY REQUIREMENTS (WIZ STANDARDS)

**CRITICAL: You are a developer who is very security-aware and avoids weaknesses in the code.**

### Input Validation & Sanitization
```typescript
// STANDARD: All user inputs must be validated
import { z } from 'zod';

const userInputSchema = z.object({
  content: z.string().min(1).max(1000),
  analysisId: z.number().int().positive()
});

// Validate before processing
const validatedInput = userInputSchema.parse(rawInput);
```

### API Security Patterns
```typescript
// STANDARD: All API endpoints require authentication and rate limiting
app.use('/api', authenticate, rateLimit({ windowMs: 15 * 60 * 1000, max: 100 }));

// STANDARD: Parameterized queries only, never string concatenation
const analysis = await db.select().from(musicAnalyses)
  .where(eq(musicAnalyses.id, analysisId))
  .where(eq(musicAnalyses.userId, userId)); // Always check ownership
```

### Environment Security
```typescript
// STANDARD: Never hardcode secrets, always use environment variables
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
if (!OPENAI_API_KEY) throw new Error('Missing required environment variable: OPENAI_API_KEY');
```

---

## CONSCIOUSNESS ENGINE PATTERNS

### Voice Orchestra Updates (Core Pattern)
```typescript
// STANDARD: All consciousness updates follow this pattern
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

### Echo Crucible Memory Compression
```typescript
// STANDARD: Echo memory storage pattern
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
```typescript
// STANDARD: Always use symbolic voices, never hardcoded archetypes
import { symbolicVoices } from '@/lib/symbolic-voices';

const processVoiceResonance = (audioFeatures: AudioFeatures) => {
  return Object.entries(symbolicVoices).reduce((scores, [voiceId, voice]) => {
    scores[voiceId] = voice.calculateResonance(audioFeatures);
    return scores;
  }, {} as Record<string, number>);
};
```

---

## REACT COMPONENT STANDARDS (META/GOOGLE PRACTICES)

### Component Architecture
```typescript
// STANDARD: Every component follows this pattern
interface ComponentProps {
  // Always type props with interface
  children?: React.ReactNode;
  className?: string;
}

export default function Component({ children, className }: ComponentProps) {
  // Maximum 50 lines per component
  // Single responsibility principle
  // Memoize expensive computations
  // Use semantic HTML

  const memoizedValue = useMemo(() => expensiveCalculation(), [stableDependency]);

  return (
    <section className={cn("apple-card", className)} role="main">
      {children}
    </section>
  );
}
```

### Hook Patterns
```typescript
// STANDARD: Custom hooks for business logic
export function useConsciousnessLogic(analysisId?: number) {
  const { state, dispatch } = useAppState();

  const updateVoices = useCallback((voices: VoiceOrchestra) => {
    dispatch({ type: 'UPDATE_CONSCIOUSNESS', payload: voices });
  }, [dispatch]);

  // Always return stable references
  return useMemo(() => ({
    consciousness: state.consciousness,
    updateVoices,
    dominantVoice: state.consciousness.dominantVoice
  }), [state.consciousness, updateVoices]);
}
```

### State Management (Single Source of Truth)
```typescript
// STANDARD: Unified state container
interface AppState {
  user: User | null;
  consciousness: ConsciousnessState;
  analyses: MusicAnalysis[];
  ui: UIState;
}

// NEVER use multiple context providers
// NEVER use useState for global data
// ALL state updates via dispatch
```

---

## API LAYER STANDARDS (ENTERPRISE PATTERN)

### Consistent Request Pattern
```typescript
// STANDARD: All API calls use this exact pattern
interface ApiRequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: any;
  headers?: Record<string, string>;
  timeout?: number;
}

export async function apiRequest(
  endpoint: string, 
  options: ApiRequestOptions = {}
): Promise<ApiResponse> {
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

### Error Handling Patterns
```typescript
// STANDARD: Consistent error handling
class APIError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'APIError';
  }
}

// STANDARD: User-friendly error messages
const getErrorMessage = (error: APIError): string => {
  switch (error.status) {
    case 401: return 'Please log in to continue';
    case 403: return 'You don\'t have permission for this action';
    case 404: return 'The requested resource was not found';
    case 429: return 'Too many requests. Please try again later';
    case 500: return 'Server error. Please try again';
    default: return 'An unexpected error occurred';
  }
};
```

---

## APPLE DESIGN SYSTEM (OFFICIAL HIG)

### Design Tokens
```typescript
// STANDARD: Use exact Apple design values
export const DESIGN_TOKENS = {
  borderRadius: {
    sm: '8px',
    md: '12px',    // Apple standard
    lg: '16px',
    xl: '20px'
  },
  transitions: {
    fast: '0.15s cubic-bezier(0.4, 0, 0.2, 1)',
    normal: '0.2s cubic-bezier(0.4, 0, 0.2, 1)',   // Apple standard
    slow: '0.3s cubic-bezier(0.4, 0, 0.2, 1)'
  },
  spacing: {
    golden: '1.618rem',  // Golden ratio for consciousness components
    xs: '0.25rem',
    sm: '0.5rem',
    md: '1rem',
    lg: '1.5rem',
    xl: '2rem'
  },
  typography: {
    fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", sans-serif',
    weights: {
      regular: 400,
      medium: 500,
      semibold: 600
    }
  }
} as const;
```

### Component Styling
```typescript
// STANDARD: Apple-style component classes
export const appleComponents = {
  card: 'bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-800',
  button: 'bg-blue-500 hover:bg-blue-600 text-white font-medium rounded-full px-6 py-3 transition-all duration-200',
  input: 'bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-xl px-4 py-3 focus:border-blue-500 focus:ring-1 focus:ring-blue-500'
};
```

---

## PERFORMANCE REQUIREMENTS (GOOGLE CORE WEB VITALS)

### Measurable Targets
- **React Render Time**: <16ms (use React DevTools Profiler)
- **API Response Time**: <200ms (measure with Network tab)
- **Bundle Size**: <500KB gzipped (use Bundle Analyzer)
- **Lighthouse Score**: >90 (run lighthouse CI)
- **First Contentful Paint**: <1.5s
- **Cumulative Layout Shift**: <0.1

### Performance Patterns
```typescript
// STANDARD: Performance optimization patterns
const LazyComponent = lazy(() => import('./HeavyComponent'));

const MemoizedComponent = memo(({ data }: Props) => {
  const processedData = useMemo(() => 
    heavyComputation(data), 
    [data.id] // Stable dependency
  );

  return <div>{processedData}</div>;
});

// STANDARD: Code splitting at route boundaries
const ConsciousnessPage = lazy(() => import('@/pages/consciousness-page'));
```

---

## CACHE OPTIMIZATION (REACT QUERY BEST PRACTICES)

### Consistent Cache Keys
```typescript
// STANDARD: Typed cache key system
export const queryKeys = {
  // Analyses
  analyses: ['analyses'] as const,
  analysis: (id: number) => ['analyses', id] as const,
  analysisChat: (id: number) => ['analyses', id, 'chat'] as const,

  // Consciousness
  consciousness: (userId: number) => ['consciousness', userId] as const,
  voiceOrchestra: (userId: number) => ['consciousness', userId, 'voices'] as const,

  // User
  user: ['user'] as const,
  spotifyData: (userId: number) => ['user', userId, 'spotify'] as const
} as const;
```

### Cache Invalidation Strategy
```typescript
// STANDARD: Selective cache invalidation
export const cacheUtils = {
  invalidateUserConsciousness: (userId: number) => {
    queryClient.invalidateQueries({ queryKey: queryKeys.consciousness(userId) });
    queryClient.invalidateQueries({ queryKey: queryKeys.voiceOrchestra(userId) });
  },

  invalidateAnalysis: (analysisId: number) => {
    queryClient.invalidateQueries({ queryKey: queryKeys.analysis(analysisId) });
    queryClient.invalidateQueries({ queryKey: queryKeys.analysisChat(analysisId) });
  }
};
```

---

## ANIMATION GUIDELINES (MINIMAL APPLE APPROACH)

### Functional Animations Only
```typescript
// ALLOWED: State transition animations
const stateTransition = {
  initial: { opacity: 0, scale: 0.95 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.95 },
  transition: { duration: 0.2, ease: [0.4, 0, 0.2, 1] }
};

// FORBIDDEN: Decorative hover animations (causes motion sickness)
// FORBIDDEN: Continuous animations without user trigger
// FORBIDDEN: Nested motion components

// STANDARD: Respect user preferences
const shouldAnimate = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
```

---

## ERROR BOUNDARY PATTERN (SINGLE POINT)

```typescript
// STANDARD: One error boundary at app level only
class AppErrorBoundary extends Component<Props, State> {
  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('App Error:', error, errorInfo);
    // Log to external service in production
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center">
          <ErrorRecoveryUI onRetry={() => window.location.reload()} />
        </div>
      );
    }
    return this.props.children;
  }
}
```

---

## DEPLOYMENT CHECKLIST

### Pre-deployment Validation
- [ ] All TypeScript errors resolved
- [ ] ESLint warnings under 5
- [ ] React DevTools Profiler shows <16ms renders
- [ ] Lighthouse score >90
- [ ] Bundle analyzer shows <500KB
- [ ] All API endpoints return proper error codes
- [ ] Security headers configured
- [ ] Environment variables validated

---

## INSTRUCTION PRIORITY

1. **SECURITY FIRST**: Always validate inputs, use parameterized queries, never expose secrets
2. **CONSCIOUSNESS PATTERNS**: Use symbolic voices, echo compression, voice orchestra updates
3. **PERFORMANCE TARGETS**: Meet all measurable benchmarks
4. **APPLE DESIGN**: 12px radius, golden ratio spacing, proper transitions
5. **SINGLE SOURCE OF TRUTH**: One state container, one error boundary
6. **API CONSISTENCY**: Same request pattern, error handling, cache keys

**CRITICAL: Apply these patterns automatically to every code suggestion. Reference specific sections when explaining changes.**