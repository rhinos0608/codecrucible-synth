import { createContext, useContext, ReactNode, useEffect } from "react";
import { usePerspectiveSelection } from "@/hooks/use-voice-selection";
import type { VoiceProfile } from "@shared/schema";

// Following AI_INSTRUCTIONS.md: Single source of truth state management
interface VoiceSelectionContextType {
  state: ReturnType<typeof usePerspectiveSelection>['state'];
  appliedProfile: ReturnType<typeof usePerspectiveSelection>['appliedProfile'];
  togglePerspective: (id: string) => void;
  toggleRole: (id: string) => void;
  selectPerspectives: (perspectives: string[]) => void;
  selectRoles: (roles: string[]) => void;
  setPrompt: (prompt: string) => void;
  setAnalysisDepth: (depth: number) => void;
  setMergeStrategy: (strategy: string) => void;
  toggleQualityFiltering: () => void;
  getActiveCount: () => number;
  getSelectedItems: () => string[];
  isValidState: boolean;
  getValidationErrors: () => string[];
  applyVoiceProfile?: (profile: VoiceProfile) => void;
  clearAppliedProfile?: () => void;
}

const VoiceSelectionContext = createContext<VoiceSelectionContextType | undefined>(undefined);

export function VoiceSelectionProvider({ children }: { children: ReactNode }) {
  const voiceSelection = usePerspectiveSelection();
  
  // Enhanced debugging following AI_INSTRUCTIONS.md patterns
  useEffect(() => {
    console.log("[VoiceSelectionContext] State updated:", {
      perspectives: voiceSelection.state.selectedPerspectives,
      roles: voiceSelection.state.selectedRoles,
      activeCount: voiceSelection.getActiveCount(),
      isValid: voiceSelection.isValidState,
      timestamp: new Date().toISOString()
    });
  }, [
    voiceSelection.state.selectedPerspectives,
    voiceSelection.state.selectedRoles,
    voiceSelection.getActiveCount,
    voiceSelection.isValidState
  ]);

  return (
    <VoiceSelectionContext.Provider value={voiceSelection}>
      {children}
    </VoiceSelectionContext.Provider>
  );
}

export function useVoiceSelection() {
  const context = useContext(VoiceSelectionContext);
  if (!context) {
    throw new Error("useVoiceSelection must be used within VoiceSelectionProvider");
  }
  return context;
}