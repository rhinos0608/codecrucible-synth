# CodeCrucible State Management Architecture

## Overview

This directory implements a comprehensive, production-ready state management solution using **Zustand** with TypeScript, following the requirements from the specification and AI_INSTRUCTIONS.md patterns.

## Architecture

### Core Philosophy
- **Predictability**: All state changes are explicit and traceable
- **Immutability**: Uses Immer for immutable updates
- **Single Source of Truth**: Centralized state with normalized data structures
- **Separation of Concerns**: Clear boundaries between UI, business logic, and state
- **Type Safety**: Full TypeScript interfaces throughout

### Directory Structure

```
/store
├── index.ts                 # Central exports and documentation
├── app-store.ts            # Main store combining all slices
├── types.ts                # TypeScript interfaces for all state shapes
├── /slices
│   ├── voice-slice.ts      # Voice selection and AI consciousness
│   ├── project-slice.ts    # Project and file management
│   ├── team-slice.ts       # Team collaboration and Matrix integration
│   ├── ui-slice.ts         # UI state and modal management
│   ├── auth-slice.ts       # Authentication and subscription
│   └── consciousness-slice.ts # Consciousness evolution tracking
└── /utils
    ├── persistence.ts      # localStorage integration utilities
    ├── logger.ts          # Structured logging for state changes
    └── async-slice.ts     # Async action management helpers
```

## State Slices

### 1. Voice Slice (`voice-slice.ts`)
Manages AI voice selection, custom voices, and voice sessions.

**Key Features:**
- Voice perspective and role selection with validation
- Custom voice creation and management
- AI voice recommendations with confidence scoring
- Session history tracking
- Consciousness evolution integration

**Example Usage:**
```typescript
import { useVoiceSelection } from '@/store';

const { perspectives, roles, recommendations, actions } = useVoiceSelection();

// Select voice perspectives
actions.selectPerspectives(['Explorer', 'Analyzer']);

// Add custom voice
actions.addCustomVoice({
  id: 'custom_1',
  name: 'Security Expert',
  description: 'Specialized in security analysis',
  personality: 'analytical',
  specialization: ['security', 'cryptography'],
  avatar: 'shield'
});
```

### 2. Project Slice (`project-slice.ts`)
Handles project and folder management with normalized data structure.

**Key Features:**
- Normalized project storage for optimal performance
- Folder organization with drag-and-drop support
- Project search and filtering capabilities
- File association and management
- Project complexity tracking

**Example Usage:**
```typescript
import { useProjectManagement } from '@/store';

const { projects, folders, selectedProject, actions } = useProjectManagement();

// Move project to folder
actions.moveProject('project_1', 'folder_1');

// Search projects
const results = searchProjects('react typescript');
```

### 3. Team Slice (`team-slice.ts`)
Manages team collaboration, Matrix chat, and consciousness tracking.

**Key Features:**
- Team member management with roles
- Real-time Matrix chat integration
- Collaborative session tracking
- Team consciousness metrics
- Voice assignment for team sessions

**Example Usage:**
```typescript
import { useTeamCollaboration } from '@/store';

const { activeTeam, activeSessions, matrixMessages, actions } = useTeamCollaboration();

// Add chat message
actions.addChatMessage('room_1', {
  id: 'msg_1',
  sender: 'AI Explorer',
  senderType: 'ai_voice',
  content: 'Analyzing the code structure...',
  voiceArchetype: 'Explorer',
  consciousnessLevel: 8.2
});
```

### 4. UI Slice (`ui-slice.ts`)
Controls interface state, modals, themes, and loading states.

**Key Features:**
- Panel visibility management
- Modal state coordination
- Theme switching with system preference detection
- Loading state tracking for operations
- Error state management

**Example Usage:**
```typescript
import { useUIState } from '@/store';

const { panels, modals, theme, actions } = useUIState();

// Toggle panel
actions.togglePanel('projects');

// Set theme
actions.setTheme('dark');

// Manage loading states
actions.setLoading('generating_code', true);
```

### 5. Auth Slice (`auth-slice.ts`)
Handles authentication, user data, and subscription management.

**Key Features:**
- User authentication state
- Subscription tier and quota tracking
- Session management with refresh capability
- User preferences persistence
- Permission checking utilities

**Example Usage:**
```typescript
import { useAuthState, canPerformAction } from '@/store';

const { user, subscription, actions } = useAuthState();

// Check permissions
const canCreateCustomVoice = canPerformAction('pro');

// Update subscription
actions.updateSubscription({
  tier: 'pro',
  quotaUsed: 5,
  quotaLimit: 100
});
```

### 6. Consciousness Slice (`consciousness-slice.ts`)
Tracks consciousness evolution following Jung's descent protocol.

**Key Features:**
- Consciousness level tracking with evolution history
- Voice usage pattern analysis
- Council session recording
- Synthesis result tracking
- Shadow integration progress
- Archetype balance monitoring

**Example Usage:**
```typescript
import { useConsciousnessTracking, getConsciousnessPhase } from '@/store';

const { level, evolution, patterns, actions } = useConsciousnessTracking();

// Record consciousness evolution
actions.addEvolution({
  timestamp: new Date(),
  previousLevel: 6.5,
  newLevel: 7.2,
  trigger: 'successful_synthesis',
  context: 'Multi-voice collaboration breakthrough'
});

// Check current phase
const phase = getConsciousnessPhase(); // 'integration'
```

## Persistence Strategy

### Selective Persistence
Only user preferences and non-sensitive data are persisted to localStorage:

- **Voice Slice**: Selected perspectives, roles, custom voices, recent session history
- **UI Slice**: Theme preference, sidebar state, active tab
- **Auth Slice**: User preferences only (no tokens or sensitive data)

### Persistence Configuration
```typescript
export const useVoiceStore = createPersistentSlice<VoiceState>({
  name: 'voice-store',
  version: 1,
  partialize: (state) => ({
    selectedPerspectives: state.selectedPerspectives,
    selectedRoles: state.selectedRoles,
    customVoices: state.customVoices,
    sessionHistory: state.sessionHistory.slice(0, 10)
  })
});
```

## Performance Optimizations

### 1. Normalized Data Structure
Projects, folders, and files are stored in lookup tables for O(1) access:

```typescript
interface ProjectState {
  projects: Record<string, Project>;    // Normalized by ID
  folders: Record<string, ProjectFolder>; // Normalized by ID
  files: Record<string, ProjectFile>;   // Normalized by ID
}
```

### 2. Selective Subscriptions
Store selectors prevent unnecessary re-renders:

```typescript
// Only re-renders when voice selection changes
const { perspectives, roles } = useAppStore(state => ({
  perspectives: state.voice.selectedPerspectives,
  roles: state.voice.selectedRoles
}));
```

### 3. Immutable Updates
Uses Immer for efficient immutable updates:

```typescript
set(produce((state: AppState) => {
  state.voice.selectedPerspectives = newPerspectives;
  // Immer handles immutability
}));
```

## Error Handling and Logging

### Structured Logging
All state changes are logged with structured metadata:

```typescript
storeLogger.info('Voice perspectives selected', {
  perspectives: validPerspectives,
  count: validPerspectives.length,
  consciousnessLevel: state.consciousness.level
});
```

### Error Boundaries
Comprehensive error handling with fallback states:

```typescript
try {
  // State update logic
} catch (error) {
  storeLogger.error('State update failed', error as Error, { context });
  // Graceful fallback
}
```

## Integration with React Query

The store complements React Query for server state:

- **Zustand**: Client state, UI state, user preferences
- **React Query**: Server state, API data, caching

```typescript
// Server state (React Query)
const { data: projects } = useProjects();

// Client state (Zustand)
const { selectedProject, actions } = useProjectManagement();

// Sync server data to client state
useEffect(() => {
  if (projects) {
    actions.setProjects(projects);
  }
}, [projects]);
```

## Testing Strategy

### Store Testing
Each slice includes test utilities:

```typescript
// Reset store for testing
export const resetStore = () => {
  useAppStore.setState(initialState);
};

// Mock store state
export const mockStoreState = (overrides: Partial<AppState>) => {
  useAppStore.setState({ ...initialState, ...overrides });
};
```

### Integration Testing
Test state interactions across slices:

```typescript
describe('Voice and Consciousness Integration', () => {
  it('should update consciousness when voice selection changes', () => {
    const { voice, consciousness } = useAppStore.getState();
    
    voice.actions.selectPerspectives(['Explorer', 'Analyzer', 'Developer']);
    
    expect(consciousness.level).toBeGreaterThan(5.0);
  });
});
```

## Migration and Versioning

### Version Management
Store versions are tracked for safe migrations:

```typescript
const persistConfig: PersistConfig = {
  name: 'voice-store',
  version: 2,
  migrate: (persistedState: any, version: number) => {
    if (version < 2) {
      // Migrate from v1 to v2
      return {
        ...persistedState,
        customVoices: persistedState.customVoices || []
      };
    }
    return persistedState;
  }
};
```

## Debugging and DevTools

### Redux DevTools
Full Redux DevTools integration for state inspection:

```typescript
export const useAppStore = create<AppState>()(
  devtools(
    (set, get, api) => ({ /* store implementation */ }),
    {
      name: 'codecrucible-store',
      enabled: process.env.NODE_ENV === 'development'
    }
  )
);
```

### Store Health Monitoring
Built-in health checks and integrity validation:

```typescript
export const validateStoreIntegrity = (): boolean => {
  const state = useAppStore.getState();
  
  // Validate required state properties
  const checks = [
    typeof state.voice === 'object',
    typeof state.project === 'object',
    // ... other validations
  ];
  
  return checks.every(check => check);
};
```

## Best Practices

### 1. State Shape Design
- Keep state normalized for performance
- Use lookup tables for collections
- Separate concerns between slices
- Minimize state duplication

### 2. Action Design
- Make actions pure and predictable
- Validate inputs before state updates
- Log all state changes for debugging
- Handle errors gracefully

### 3. Performance
- Use selective subscriptions to prevent re-renders
- Implement memoization for expensive computations
- Keep slice interfaces focused and minimal
- Avoid deep nesting in state structure

### 4. Type Safety
- Define comprehensive TypeScript interfaces
- Use strict typing for all actions and state
- Leverage discriminated unions where appropriate
- Provide utility functions for type checking

## Future Enhancements

### Planned Features
1. **Real-time Synchronization**: WebSocket integration for team state sync
2. **Offline Support**: Conflict resolution for offline state changes
3. **State Analytics**: Performance monitoring and usage analytics
4. **Advanced Caching**: Intelligent cache invalidation strategies
5. **State Compression**: Optimize persistence storage size

### Extensibility
The modular architecture supports easy extension:

```typescript
// Add new slice
export const createNewFeatureSlice: StateCreator<AppState, [], [], NewFeatureState> = 
  (set, get) => ({
    // New feature implementation
  });

// Integrate into main store
export const useAppStore = create<AppState>()(
  devtools((set, get, api) => ({
    voice: createVoiceSlice(set, get, api),
    project: createProjectSlice(set, get, api),
    newFeature: createNewFeatureSlice(set, get, api), // Add here
    // ... other slices
  }))
);
```

This state management architecture provides a solid foundation for CodeCrucible's complex requirements while maintaining scalability, type safety, and developer experience excellence.