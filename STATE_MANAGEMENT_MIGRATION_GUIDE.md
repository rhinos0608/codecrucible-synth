# State Management Migration Guide

## Overview

This guide provides step-by-step instructions for migrating existing components from fragmented state management to the new centralized Zustand store architecture.

## Migration Strategy

### Phase 1: Install Dependencies (✅ Complete)
```bash
npm install zustand immer
```

### Phase 2: Update Component Imports

#### Before: Fragmented State Management
```typescript
// Old pattern - scattered across multiple files
import { useState, useEffect } from 'react';
import { useVoiceSelection } from '@/contexts/voice-selection-context';
import { useProjects } from '@/hooks/use-projects';
import { useAuth } from '@/hooks/useAuth';
```

#### After: Centralized Store Access
```typescript
// New pattern - unified store access
import { 
  useVoiceSelection,
  useProjectManagement,
  useAuthState,
  useUIState
} from '@/store';
```

### Phase 3: Component Migration Examples

#### 1. Voice Selection Components

**Before (voice-selector.tsx):**
```typescript
// Old fragmented approach
export function VoiceSelector() {
  const { 
    selectedPerspectives, 
    selectedRoles, 
    setSelectedPerspectives,
    setSelectedRoles 
  } = useVoiceSelection(); // Context API
  
  const [localLoading, setLocalLoading] = useState(false);
  
  // Local state management
  const handlePerspectiveChange = (perspectives: string[]) => {
    setSelectedPerspectives(perspectives);
  };
}
```

**After (voice-selector.tsx):**
```typescript
// New centralized approach
export function VoiceSelector() {
  const { 
    perspectives, 
    roles, 
    actions 
  } = useVoiceSelection(); // Zustand store
  
  const { setLoading } = useUIState();
  
  // Centralized state management
  const handlePerspectiveChange = (perspectives: string[]) => {
    actions.selectPerspectives(perspectives);
    // Consciousness evolution automatically triggered
  };
}
```

#### 2. Project Management Components

**Before (enhanced-projects-panel.tsx):**
```typescript
// Old pattern with React Query + local state
export function EnhancedProjectsPanel() {
  const { data: projects = [], isLoading } = useProjects();
  const { data: folders = [] } = useProjectFolders();
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  
  // Manual state synchronization
  useEffect(() => {
    // Sync logic...
  }, [projects]);
}
```

**After (enhanced-projects-panel.tsx):**
```typescript
// New pattern with store integration
export function EnhancedProjectsPanel() {
  const { 
    projects, 
    folders, 
    selectedProject, 
    expandedFolders,
    actions 
  } = useProjectManagement();
  
  const { setLoading } = useUIState();
  
  // Automatic state synchronization through store actions
  // No manual useEffect needed
}
```

#### 3. Authentication Integration

**Before (dashboard.tsx):**
```typescript
// Old pattern with multiple hooks
export function Dashboard() {
  const { user, isAuthenticated } = useAuth();
  const [subscription, setSubscription] = useState(null);
  const [panels, setPanels] = useState({ projects: false, analytics: false });
  
  // Manual subscription management
  useEffect(() => {
    fetchSubscription().then(setSubscription);
  }, [user]);
}
```

**After (dashboard.tsx):**
```typescript
// New pattern with unified state
export function Dashboard() {
  const { user, isAuthenticated, subscription } = useAuthState();
  const { panels, actions: uiActions } = useUIState();
  
  // Automatic subscription synchronization
  // No manual fetching needed
}
```

### Phase 4: Context API Removal

#### Remove Old Context Providers

**Delete or migrate these files:**
- `client/src/contexts/voice-selection-context.tsx` ← Can be removed
- Any other custom context providers for state management

**Update App.tsx:**
```typescript
// Before
function App() {
  return (
    <VoiceSelectionProvider>
      <OtherProvider>
        <Router>
          {/* app content */}
        </Router>
      </OtherProvider>
    </VoiceSelectionProvider>
  );
}

// After
function App() {
  return (
    <Router>
      {/* app content - store automatically available */}
    </Router>
  );
}
```

### Phase 5: Store Initialization

Add store initialization to main.tsx:

```typescript
// client/src/main.tsx
import { initializeStore } from '@/store';

// Initialize store before rendering
initializeStore().then(() => {
  createRoot(document.getElementById('root')!).render(<App />);
});
```

## Component-Specific Migration Instructions

### 1. Teams Panel Migration

**Matrix Chat Integration:**
```typescript
// Before: Manual message state
const [messages, setMessages] = useState<MatrixMessage[]>([]);

// After: Store-managed messages
const { chatMessages, actions } = useTeamCollaboration();
const roomMessages = chatMessages['room_id'] || [];

// Add message through store
actions.addChatMessage('room_id', newMessage);
```

### 2. Consciousness Tracking Migration

**Before: Scattered consciousness state
```typescript
const [consciousnessLevel, setConsciousnessLevel] = useState(5.0);
const [evolution, setEvolution] = useState([]);

// After: Centralized consciousness management
const { level, evolution, actions } = useConsciousnessTracking();

// Record evolution automatically
actions.addEvolution({
  timestamp: new Date(),
  previousLevel: 6.5,
  newLevel: 7.2,
  trigger: 'successful_synthesis',
  context: 'Multi-voice collaboration'
});
```

### 3. Modal and Panel Management

**Before: Individual modal states
```typescript
const [showUpgradeModal, setShowUpgradeModal] = useState(false);
const [showProjectsPanel, setShowProjectsPanel] = useState(false);

// After: Centralized UI state
const { modals, panels, actions } = useUIState();

// Open modal
actions.openModal('upgrade');

// Toggle panel
actions.togglePanel('projects');
```

## Performance Optimization During Migration

### 1. Selective Subscriptions

**Optimize re-renders with targeted selectors:**
```typescript
// Instead of subscribing to entire slice
const voiceState = useVoiceStore();

// Use selective subscription
const { perspectives, roles } = useAppStore(state => ({
  perspectives: state.voice.selectedPerspectives,
  roles: state.voice.selectedRoles
}));
```

### 2. Memoization for Expensive Calculations

```typescript
import { useMemo } from 'react';

const ProjectStats = () => {
  const { projects } = useProjectManagement();
  
  const stats = useMemo(() => {
    return calculateProjectStats(projects);
  }, [projects]);
  
  return <div>{/* render stats */}</div>;
};
```

## Testing Migration

### 1. Component Testing

```typescript
// test-utils.ts
import { resetStore, mockStoreState } from '@/store';

export const renderWithStore = (component: ReactElement, initialState?: Partial<AppState>) => {
  if (initialState) {
    mockStoreState(initialState);
  }
  
  return render(component);
};

// Cleanup after tests
afterEach(() => {
  resetStore();
});
```

### 2. Integration Testing

```typescript
describe('Voice Selection Integration', () => {
  it('should update consciousness when voices are selected', () => {
    const { voice, consciousness } = useAppStore.getState();
    
    voice.actions.selectPerspectives(['Explorer', 'Analyzer']);
    
    expect(consciousness.level).toBeGreaterThan(5.0);
  });
});
```

## Rollback Strategy

If migration issues occur, here's the rollback plan:

### 1. Preserve Old Files
Keep backup copies of:
- `voice-selection-context.tsx.backup`
- `use-projects.tsx.backup`
- Other critical state management files

### 2. Feature Flags
Use feature flags to gradually roll out store usage:

```typescript
const USE_NEW_STORE = process.env.VITE_USE_NEW_STORE === 'true';

export function VoiceSelector() {
  if (USE_NEW_STORE) {
    return <NewVoiceSelector />;
  }
  return <OldVoiceSelector />;
}
```

### 3. Gradual Migration
Migrate components one at a time:
1. Start with UI state management (modals, panels)
2. Move to voice selection
3. Migrate project management
4. Complete with team collaboration features

## Validation Checklist

After migration, verify:

- [ ] All voice selection functionality works
- [ ] Project management operations complete successfully
- [ ] Team collaboration features operate correctly
- [ ] Modal and panel states persist properly
- [ ] Authentication state synchronizes correctly
- [ ] Consciousness evolution tracks properly
- [ ] No console errors related to state management
- [ ] Performance remains optimal (no unnecessary re-renders)
- [ ] All tests pass
- [ ] localStorage persistence works as expected

## Post-Migration Cleanup

1. **Remove unused files:**
   - Old context providers
   - Redundant custom hooks
   - Unused state management utilities

2. **Update documentation:**
   - Component documentation
   - API documentation
   - Development guides

3. **Performance monitoring:**
   - Monitor re-render frequency
   - Check bundle size impact
   - Validate memory usage

## Support and Troubleshooting

### Common Issues

1. **"Cannot read properties of undefined"**
   - Ensure store is initialized before component render
   - Check import paths for store selectors

2. **State not persisting**
   - Verify persistence configuration in slice definitions
   - Check localStorage permissions

3. **Unexpected re-renders**
   - Use React DevTools Profiler
   - Implement selective subscriptions
   - Add memoization where needed

### Debug Tools

1. **Redux DevTools**: Inspect state changes and time-travel
2. **Store Logger**: Check console for structured state logs
3. **Store Health Check**: Run `validateStoreIntegrity()`

This migration guide ensures a smooth transition to the new state management architecture while maintaining application stability and performance.