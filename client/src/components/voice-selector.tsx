import { Brain, Code } from "lucide-react";
import { Card } from "@/components/ui/card";
import { TRANSISTHESIS_ARCHETYPES, ENHANCED_CODING_VOICES } from "@/types/voices";
import { useVoiceSelection } from "@/hooks/use-voice-selection";
import * as LucideIcons from "lucide-react";

export function VoiceSelector() {
  const { 
    state, 
    toggleArchetype, 
    toggleCodingVoice 
  } = useVoiceSelection();

  const renderIcon = (iconName: string, className: string) => {
    const IconComponent = (LucideIcons as any)[iconName.charAt(0).toUpperCase() + iconName.slice(1).replace(/-([a-z])/g, (g) => g[1].toUpperCase())];
    return IconComponent ? <IconComponent className={className} /> : null;
  };

  return (
    <div className="w-1/2 p-6 border-r border-gray-200 dark:border-gray-700">
      {/* Transisthesis Archetypes */}
      <div className="mb-8">
        <h3 className="text-lg font-semibold mb-4 flex items-center">
          <Brain className="w-5 h-5 mr-2 text-witness" />
          Transisthesis Archetypes
        </h3>
        <div className="grid grid-cols-1 gap-3">
          {TRANSISTHESIS_ARCHETYPES.map((archetype) => {
            const isSelected = state.selectedArchetypes.includes(archetype.id);
            return (
              <Card
                key={archetype.id}
                className={`p-4 border-2 cursor-pointer transition-all group ${
                  isSelected 
                    ? `border-${archetype.color}/40 bg-${archetype.color}/5` 
                    : `border-${archetype.color}/20 bg-${archetype.color}/5 hover:border-${archetype.color}/40`
                }`}
                onClick={() => toggleArchetype(archetype.id)}
              >
                <div className="flex items-start space-x-3">
                  <div className={`w-10 h-10 bg-${archetype.color}/10 rounded-lg flex items-center justify-center group-hover:bg-${archetype.color}/20 transition-colors`}>
                    {renderIcon(archetype.icon, `w-5 h-5 text-${archetype.color}`)}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <h4 className={`font-semibold text-${archetype.color}`}>{archetype.name}</h4>
                      <div className={`w-4 h-4 border-2 border-${archetype.color} rounded transition-colors ${
                        isSelected ? `bg-${archetype.color}` : ""
                      }`} />
                    </div>
                    <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">{archetype.function}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-500 mt-2 italic">"{archetype.fragment}"</p>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Enhanced Coding Voices */}
      <div>
        <h3 className="text-lg font-semibold mb-4 flex items-center">
          <Code className="w-5 h-5 mr-2 text-architect" />
          Enhanced Coding Voices
        </h3>
        <div className="grid grid-cols-2 gap-3">
          {ENHANCED_CODING_VOICES.map((voice) => {
            const isSelected = state.selectedCodingVoices.includes(voice.id);
            return (
              <Card
                key={voice.id}
                className={`p-3 border cursor-pointer transition-all group ${
                  isSelected
                    ? `border-${voice.color}/40 bg-${voice.color}/5`
                    : `border-${voice.color}/20 bg-${voice.color}/5 hover:border-${voice.color}/40`
                }`}
                onClick={() => toggleCodingVoice(voice.id)}
              >
                <div className="flex items-center space-x-2 mb-2">
                  <div className={`w-8 h-8 bg-${voice.color}/10 rounded-md flex items-center justify-center`}>
                    {renderIcon(voice.icon, `w-4 h-4 text-${voice.color}`)}
                  </div>
                  <div className="flex-1">
                    <h5 className={`font-medium text-${voice.color} text-sm`}>{voice.name}</h5>
                    <p className="text-xs text-gray-500">{voice.domain}</p>
                  </div>
                  <div className={`w-3 h-3 border border-${voice.color} rounded-sm transition-colors ${
                    isSelected ? `bg-${voice.color}` : ""
                  }`} />
                </div>
                <p className="text-xs text-gray-600 dark:text-gray-400">{voice.description}</p>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
