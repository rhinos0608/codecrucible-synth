// Voice utility functions for display names and formatting
// Following AI_INSTRUCTIONS.md security patterns and CodingPhilosophy.md consciousness principles

// Import voice types from voice types file
import { CODE_PERSPECTIVES, DEVELOPMENT_ROLES } from '@/types/voices';

/**
 * Map voice combination to display name following AI_INSTRUCTIONS.md patterns
 * Handles multiple voice formats: colon-separated, prefixed, and direct ID mapping
 */
export const getVoiceDisplayName = (voiceCombination: string | undefined): string => {
  if (!voiceCombination) return 'Unknown Voice Engine';
  
  // Handle colon-separated format (e.g., "perspective:seeker" -> "Explorer")
  if (voiceCombination.includes(':')) {
    const [type, voiceId] = voiceCombination.split(':');
    if (type === 'perspective') {
      const perspective = CODE_PERSPECTIVES.find(p => p.id === voiceId);
      if (perspective) return perspective.name;
    }
    if (type === 'role') {
      const role = DEVELOPMENT_ROLES.find(r => r.id === voiceId);
      if (role) return role.name;
    }
  }
  
  // Handle perspective-prefixed voices (e.g., "perspective-seeker" -> "Explorer")
  if (voiceCombination.startsWith('perspective-')) {
    const perspectiveId = voiceCombination.replace('perspective-', '');
    const perspective = CODE_PERSPECTIVES.find(p => p.id === perspectiveId);
    if (perspective) return perspective.name;
  }
  
  // Handle role-prefixed voices (e.g., "role-architect" -> "Systems Architect")
  if (voiceCombination.startsWith('role-')) {
    const roleId = voiceCombination.replace('role-', '');
    const role = DEVELOPMENT_ROLES.find(r => r.id === roleId);
    if (role) return role.name;
  }
  
  // Direct ID mapping
  const perspective = CODE_PERSPECTIVES.find(p => p.id === voiceCombination);
  if (perspective) return perspective.name;
  
  const role = DEVELOPMENT_ROLES.find(r => r.id === voiceCombination);
  if (role) return role.name;
  
  return voiceCombination;
};

/**
 * Get voice archetype color for UI styling
 */
export const getVoiceColor = (voiceCombination: string | undefined): string => {
  if (!voiceCombination) return 'gray';
  
  // Map voices to color themes
  const voiceName = getVoiceDisplayName(voiceCombination).toLowerCase();
  
  if (voiceName.includes('explorer')) return 'blue';
  if (voiceName.includes('maintainer')) return 'green';
  if (voiceName.includes('analyzer')) return 'purple';
  if (voiceName.includes('developer')) return 'orange';
  if (voiceName.includes('implementor')) return 'red';
  
  // Role-based colors
  if (voiceName.includes('security')) return 'red';
  if (voiceName.includes('architect')) return 'indigo';
  if (voiceName.includes('designer') || voiceName.includes('ui/ux')) return 'pink';
  if (voiceName.includes('performance')) return 'yellow';
  
  return 'gray';
};

/**
 * Format voice combination for API requests
 */
export const formatVoiceForAPI = (perspectives: string[], roles: string[]): string[] => {
  const formattedVoices: string[] = [];
  
  perspectives.forEach(p => formattedVoices.push(`perspective:${p}`));
  roles.forEach(r => formattedVoices.push(`role:${r}`));
  
  return formattedVoices;
};

/**
 * Get voice description for tooltips and help text
 */
export const getVoiceDescription = (voiceCombination: string | undefined): string => {
  if (!voiceCombination) return 'Unknown voice engine';
  
  const voiceName = getVoiceDisplayName(voiceCombination).toLowerCase();
  
  // Perspective descriptions
  if (voiceName.includes('explorer')) return 'Experimental approach with innovative solutions';
  if (voiceName.includes('maintainer')) return 'Long-term stability and code maintenance focus';
  if (voiceName.includes('analyzer')) return 'Pattern recognition and systematic analysis';
  if (voiceName.includes('developer')) return 'User experience and development workflow optimization';
  if (voiceName.includes('implementor')) return 'Production-ready implementation and deployment';
  
  // Role descriptions
  if (voiceName.includes('security')) return 'Security-first approach with threat analysis';
  if (voiceName.includes('architect')) return 'System architecture and design patterns';
  if (voiceName.includes('designer')) return 'User interface and experience design';
  if (voiceName.includes('performance')) return 'Performance optimization and scalability';
  
  return 'AI voice specialization';
};