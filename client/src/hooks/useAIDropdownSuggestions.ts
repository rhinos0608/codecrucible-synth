import { useState, useEffect } from 'react';
import { apiRequest } from '@/lib/queryClient';

// AI-powered dropdown suggestions following AI_INSTRUCTIONS.md and CodingPhilosophy.md
export interface AIDropdownSuggestion {
  id: string;
  text: string;
  description: string;
  category: string;
  consciousness_level: number; // Jung's depth principle
  pattern_quality: number; // Alexander's QWAN metric
}

export interface AIDropdownSuggestionsHook {
  suggestions: AIDropdownSuggestion[];
  isLoading: boolean;
  error: string | null;
  generateSuggestions: (field: string, context: string) => Promise<void>;
}

export function useAIDropdownSuggestions(): AIDropdownSuggestionsHook {
  const [suggestions, setSuggestions] = useState<AIDropdownSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generateSuggestions = async (field: string, context: string = '') => {
    if (!field) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      console.log('🤖 Generating AI dropdown suggestions for:', { field, context });
      
      const response = await apiRequest('/api/ai/dropdown-suggestions', {
        method: 'POST',
        body: {
          field,
          context,
          consciousness_framework: 'jung_descent_protocol',
          pattern_language: 'alexander_timeless_patterns',
          learning_mode: 'bateson_recursive_enhancement'
        }
      });
      
      if (response.suggestions) {
        setSuggestions(response.suggestions);
        console.log('✅ AI suggestions generated:', response.suggestions.length, 'items');
      } else {
        throw new Error('No suggestions returned from AI service');
      }
    } catch (err: any) {
      console.error('❌ AI suggestion generation failed:', err);
      setError(err.message || 'Failed to generate AI suggestions');
      setSuggestions([]);
    } finally {
      setIsLoading(false);
    }
  };

  return {
    suggestions,
    isLoading,
    error,
    generateSuggestions
  };
}

// Specialized hooks for different dropdown types following consciousness principles
export function useSpecializationSuggestions() {
  const base = useAIDropdownSuggestions();
  
  const generateSpecializationSuggestions = (role: string, perspective: string) => {
    const context = `Role: ${role}, Perspective: ${perspective}`;
    return base.generateSuggestions('specialization', context);
  };
  
  return {
    ...base,
    generateSpecializationSuggestions
  };
}

export function usePersonalitySuggestions() {
  const base = useAIDropdownSuggestions();
  
  const generatePersonalitySuggestions = (specialization: string[], role: string) => {
    const context = `Specializations: ${specialization.join(', ')}, Role: ${role}`;
    return base.generateSuggestions('personality', context);
  };
  
  return {
    ...base,
    generatePersonalitySuggestions
  };
}

export function useProfileNameSuggestions() {
  const base = useAIDropdownSuggestions();
  
  const generateNameSuggestions = (specialization: string[], role: string, personality: string) => {
    const context = `Specializations: ${specialization.join(', ')}, Role: ${role}, Personality: ${personality}`;
    return base.generateSuggestions('profile_name', context);
  };
  
  return {
    ...base,
    generateNameSuggestions
  };
}