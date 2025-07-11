import { useState, useCallback } from "react";
import type { VoiceSelectionState, RecursionDepth, SynthesisMode } from "@/types/voices";

export function useVoiceSelection() {
  const [state, setState] = useState<VoiceSelectionState>({
    selectedArchetypes: ["steward", "witness", "nurturer"],
    selectedCodingVoices: ["guardian", "architect", "designer"],
    prompt: "",
    recursionDepth: 2,
    synthesisMode: "competitive",
    ethicalFiltering: true,
  });

  const toggleArchetype = useCallback((archetypeId: string) => {
    setState(prev => ({
      ...prev,
      selectedArchetypes: prev.selectedArchetypes.includes(archetypeId)
        ? prev.selectedArchetypes.filter(id => id !== archetypeId)
        : [...prev.selectedArchetypes, archetypeId]
    }));
  }, []);

  const toggleCodingVoice = useCallback((voiceId: string) => {
    setState(prev => ({
      ...prev,
      selectedCodingVoices: prev.selectedCodingVoices.includes(voiceId)
        ? prev.selectedCodingVoices.filter(id => id !== voiceId)
        : [...prev.selectedCodingVoices, voiceId]
    }));
  }, []);

  const setPrompt = useCallback((prompt: string) => {
    setState(prev => ({ ...prev, prompt }));
  }, []);

  const setRecursionDepth = useCallback((depth: RecursionDepth) => {
    setState(prev => ({ ...prev, recursionDepth: depth }));
  }, []);

  const setSynthesisMode = useCallback((mode: SynthesisMode) => {
    setState(prev => ({ ...prev, synthesisMode: mode }));
  }, []);

  const toggleEthicalFiltering = useCallback(() => {
    setState(prev => ({ ...prev, ethicalFiltering: !prev.ethicalFiltering }));
  }, []);

  const getActiveVoiceCount = useCallback(() => {
    return state.selectedArchetypes.length + state.selectedCodingVoices.length;
  }, [state.selectedArchetypes.length, state.selectedCodingVoices.length]);

  const getSelectedVoices = useCallback(() => {
    return [...state.selectedArchetypes, ...state.selectedCodingVoices];
  }, [state.selectedArchetypes, state.selectedCodingVoices]);

  return {
    state,
    toggleArchetype,
    toggleCodingVoice,
    setPrompt,
    setRecursionDepth,
    setSynthesisMode,
    toggleEthicalFiltering,
    getActiveVoiceCount,
    getSelectedVoices,
  };
}
