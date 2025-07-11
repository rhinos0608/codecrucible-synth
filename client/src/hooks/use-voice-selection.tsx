import { useState, useCallback, useMemo } from "react";
import type { PerspectiveState, AnalysisDepth, MergeStrategy } from "@/types/voices";

// Validation patterns following AI_INSTRUCTIONS.md security standards
const validateVoiceSelection = (perspectives: string[], roles: string[]): boolean => {
  return perspectives.length > 0 || roles.length > 0;
};

const validatePrompt = (prompt: string): boolean => {
  return prompt.trim().length > 0 && prompt.trim().length <= 2000;
};

export function usePerspectiveSelection() {
  const [state, setState] = useState<PerspectiveState>({
    selectedPerspectives: [],
    selectedRoles: [],
    prompt: "",
    analysisDepth: 2,
    mergeStrategy: "competitive",
    qualityFiltering: true,
  });

  const togglePerspective = useCallback((perspectiveId: string) => {
    setState(prev => ({
      ...prev,
      selectedPerspectives: prev.selectedPerspectives.includes(perspectiveId)
        ? prev.selectedPerspectives.filter(id => id !== perspectiveId)
        : [...prev.selectedPerspectives, perspectiveId]
    }));
  }, []);

  const toggleRole = useCallback((roleId: string) => {
    setState(prev => ({
      ...prev,
      selectedRoles: prev.selectedRoles.includes(roleId)
        ? prev.selectedRoles.filter(id => id !== roleId)
        : [...prev.selectedRoles, roleId]
    }));
  }, []);

  const setPrompt = useCallback((prompt: string) => {
    setState(prev => ({ ...prev, prompt }));
  }, []);

  const setAnalysisDepth = useCallback((depth: AnalysisDepth) => {
    setState(prev => ({ ...prev, analysisDepth: depth }));
  }, []);

  const setMergeStrategy = useCallback((strategy: MergeStrategy) => {
    setState(prev => ({ ...prev, mergeStrategy: strategy }));
  }, []);

  const toggleQualityFiltering = useCallback(() => {
    setState(prev => ({ ...prev, qualityFiltering: !prev.qualityFiltering }));
  }, []);

  const getActiveCount = useCallback(() => {
    return state.selectedPerspectives.length + state.selectedRoles.length;
  }, [state.selectedPerspectives.length, state.selectedRoles.length]);

  const getSelectedItems = useCallback(() => {
    return [...state.selectedPerspectives, ...state.selectedRoles];
  }, [state.selectedPerspectives, state.selectedRoles]);

  const isValidState = useMemo(() => {
    return validateVoiceSelection(state.selectedPerspectives, state.selectedRoles) && 
           validatePrompt(state.prompt);
  }, [state.selectedPerspectives, state.selectedRoles, state.prompt]);

  const getValidationErrors = useCallback(() => {
    const errors: string[] = [];
    if (!validatePrompt(state.prompt)) {
      if (state.prompt.trim().length === 0) {
        errors.push("Prompt is required");
      } else if (state.prompt.trim().length > 2000) {
        errors.push("Prompt must be under 2000 characters");
      }
    }
    if (!validateVoiceSelection(state.selectedPerspectives, state.selectedRoles)) {
      errors.push("At least one voice must be selected");
    }
    return errors;
  }, [state.prompt, state.selectedPerspectives, state.selectedRoles]);

  return {
    state,
    togglePerspective,
    toggleRole,
    setPrompt,
    setAnalysisDepth,
    setMergeStrategy,
    toggleQualityFiltering,
    getActiveCount,
    getSelectedItems,
    isValidState,
    getValidationErrors,
  };
}
