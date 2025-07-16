import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { useVoiceSelection } from "@/contexts/voice-selection-context";

const perspectiveVoices = [
  {
    id: 'explorer',
    name: 'Explorer',
    description: 'Discovers alternative approaches and innovative solutions',
    icon: '🔍',
    color: 'bg-blue-500',
    category: 'Analysis Engine'
  },
  {
    id: 'maintainer',
    name: 'Maintainer', 
    description: 'Focuses on long-term stability and maintainability',
    icon: '🛡️',
    color: 'bg-green-500',
    category: 'Analysis Engine'
  },
  {
    id: 'analyzer',
    name: 'Analyzer',
    description: 'Identifies patterns and potential issues',
    icon: '👁️',
    color: 'bg-purple-500',
    category: 'Analysis Engine'
  },
  {
    id: 'developer',
    name: 'Developer',
    description: 'Emphasizes user experience and developer ergonomics',
    icon: '🌱',
    color: 'bg-emerald-500',
    category: 'Analysis Engine'
  },
  {
    id: 'implementor',
    name: 'Implementor',
    description: 'Focuses on practical implementation and delivery',
    icon: '⚡',
    color: 'bg-yellow-500',
    category: 'Analysis Engine'
  }
];

const roleVoices = [
  {
    id: 'security',
    name: 'Security Engineer',
    description: 'Ensures secure coding practices and vulnerability prevention',
    icon: '🔒',
    color: 'bg-red-500',
    category: 'Specialization Engine'
  },
  {
    id: 'architect',
    name: 'Systems Architect',
    description: 'Designs scalable and maintainable system architecture',
    icon: '🏗️',
    color: 'bg-indigo-500',
    category: 'Specialization Engine'
  },
  {
    id: 'designer',
    name: 'UI/UX Engineer',
    description: 'Creates intuitive and beautiful user interfaces',
    icon: '🎨',
    color: 'bg-pink-500',
    category: 'Specialization Engine'
  },
  {
    id: 'optimizer',
    name: 'Performance Engineer',
    description: 'Optimizes for speed, efficiency, and resource usage',
    icon: '⚡',
    color: 'bg-orange-500',
    category: 'Specialization Engine'
  }
];

export function ModernVoiceSelector() {
  // Integrated with voice selection context following AI_INSTRUCTIONS.md patterns
  const { 
    state, 
    togglePerspective, 
    toggleRole
  } = useVoiceSelection();
  
  const handleTogglePerspective = (id: string) => {
    console.log('🎯 Toggling perspective:', id);
    togglePerspective(id);
  };
  
  const handleToggleRole = (id: string) => {
    console.log('🎯 Toggling role:', id);
    toggleRole(id);
  };

  const VoiceCard = ({ voice, isSelected, onToggle, type }: { 
    voice: any, 
    isSelected: boolean, 
    onToggle: () => void,
    type: 'perspective' | 'role'
  }) => (
    <Card 
      className={cn(
        "cursor-pointer transition-all duration-200 hover:shadow-md",
        isSelected ? "ring-2 ring-purple-500 bg-purple-50 dark:bg-purple-900/20" : "hover:bg-gray-50 dark:hover:bg-gray-800"
      )}
      onClick={onToggle}
    >
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center text-white", voice.color)}>
            <span className="text-lg">{voice.icon}</span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h4 className="font-medium text-white">{voice.name}</h4>
              {isSelected && (
                <Badge variant="secondary" className="text-xs bg-purple-900 text-purple-300">
                  Selected
                </Badge>
              )}
            </div>
            <p className="text-sm text-gray-400 mb-2">
              {voice.description}
            </p>
            <Badge variant="outline" className="text-xs text-gray-400 border-gray-600">
              {voice.category}
            </Badge>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-white">
            Voice Council Configuration
          </h3>
          <p className="text-sm text-gray-400">
            Select AI voices to collaborate on your coding challenge
          </p>
        </div>
        <Badge variant="outline" className="text-white border-gray-600">
          {state.selectedPerspectives.length + state.selectedRoles.length} selected
        </Badge>
      </div>

      <Tabs defaultValue="perspectives" className="space-y-4">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="perspectives">Analysis Engines</TabsTrigger>
          <TabsTrigger value="roles">Specialization Engines</TabsTrigger>
        </TabsList>

        <TabsContent value="perspectives" className="space-y-3">
          <div className="grid gap-3">
            {perspectiveVoices.map((voice) => (
              <VoiceCard
                key={voice.id}
                voice={voice}
                isSelected={state.selectedPerspectives.includes(voice.id)}
                onToggle={() => handleTogglePerspective(voice.id)}
                type="perspective"
              />
            ))}
          </div>
        </TabsContent>

        <TabsContent value="roles" className="space-y-3">
          <div className="grid gap-3">
            {roleVoices.map((voice) => (
              <VoiceCard
                key={voice.id}
                voice={voice}
                isSelected={state.selectedRoles.includes(voice.id)}
                onToggle={() => handleToggleRole(voice.id)}
                type="role"
              />
            ))}
          </div>
        </TabsContent>
      </Tabs>

      {/* Quick Actions */}
      <div className="flex gap-2 pt-4 border-t border-gray-200 dark:border-gray-800">
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            // Select recommended voices
            handleTogglePerspective('explorer');
            handleToggleRole('architect');
          }}
          className="flex-1"
        >
          Quick Setup
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            // Clear all selections
            state.selectedPerspectives.forEach(id => handleTogglePerspective(id));
            state.selectedRoles.forEach(id => handleToggleRole(id));
          }}
          className="flex-1"
        >
          Clear All
        </Button>
      </div>
    </div>
  );
}