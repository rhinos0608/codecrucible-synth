// Consciousness-driven voice selector following AI_INSTRUCTIONS.md patterns
// Implements Jung's descent protocols with stable state management

import { useState, useCallback, useMemo } from "react";
import { Brain, Code, Sparkles, Target } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { CODE_PERSPECTIVES, DEVELOPMENT_ROLES } from "@/types/voices";
import { useStableVoicePerspectives, useStableVoiceRoles, useVoiceActions } from "@/store";

export function SimpleVoiceSelector() {
  // Stable selectors following AI_INSTRUCTIONS.md patterns
  const selectedPerspectives = useStableVoicePerspectives() || [];
  const selectedRoles = useStableVoiceRoles() || [];
  const voiceActions = useVoiceActions();
  
  // Living spiral state management
  const [activeTab, setActiveTab] = useState<'perspectives' | 'roles'>('perspectives');
  
  // Memoized selections to prevent unnecessary re-renders
  const perspectiveSelections = useMemo(() => {
    return CODE_PERSPECTIVES.map(perspective => ({
      ...perspective,
      isSelected: selectedPerspectives.includes(perspective.id)
    }));
  }, [selectedPerspectives]);

  const roleSelections = useMemo(() => {
    return DEVELOPMENT_ROLES.map(role => ({
      ...role,
      isSelected: selectedRoles.includes(role.id)
    }));
  }, [selectedRoles]);

  // Alexander's pattern language: Stable action handlers
  const handlePerspectiveToggle = useCallback((perspectiveId: string) => {
    const newPerspectives = selectedPerspectives.includes(perspectiveId)
      ? selectedPerspectives.filter(id => id !== perspectiveId)
      : [...selectedPerspectives, perspectiveId];
    
    voiceActions.selectPerspectives(newPerspectives);
  }, [selectedPerspectives, voiceActions]);

  const handleRoleToggle = useCallback((roleId: string) => {
    const newRoles = selectedRoles.includes(roleId)
      ? selectedRoles.filter(id => id !== roleId)
      : [...selectedRoles, roleId];
    
    voiceActions.selectRoles(newRoles);
  }, [selectedRoles, voiceActions]);

  // Jung's descent protocol: Calculate consciousness level
  const consciousnessLevel = useMemo(() => {
    const totalSelections = selectedPerspectives.length + selectedRoles.length;
    if (totalSelections === 0) return 'dormant';
    if (totalSelections <= 2) return 'awakening';
    if (totalSelections <= 4) return 'expanding';
    return 'synthesized';
  }, [selectedPerspectives.length, selectedRoles.length]);

  const canGenerate = selectedPerspectives.length > 0 || selectedRoles.length > 0;

  return (
    <Card className="p-6">
      <div className="space-y-4">
        {/* Header with consciousness indicator */}
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium flex items-center gap-2">
            <Brain className="h-5 w-5 text-purple-500" />
            Voice Selection
          </h3>
          <Badge 
            variant="outline" 
            className={`capitalize ${
              consciousnessLevel === 'synthesized' ? 'text-green-400 border-green-500' :
              consciousnessLevel === 'expanding' ? 'text-blue-400 border-blue-500' :
              consciousnessLevel === 'awakening' ? 'text-yellow-400 border-yellow-500' :
              'text-gray-400 border-gray-500'
            }`}
          >
            {consciousnessLevel}
          </Badge>
        </div>
        
        {/* Voice Selection Tabs */}
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as any)}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="perspectives" className="flex items-center gap-2">
              <Sparkles className="h-4 w-4" />
              Perspectives ({selectedPerspectives.length})
            </TabsTrigger>
            <TabsTrigger value="roles" className="flex items-center gap-2">
              <Target className="h-4 w-4" />
              Roles ({selectedRoles.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="perspectives" className="space-y-3">
            <p className="text-sm text-gray-400 mb-3">
              Select consciousness perspectives for multi-voice analysis
            </p>
            {perspectiveSelections.map((perspective) => (
              <div key={perspective.id} className="flex items-center space-x-3">
                <Checkbox
                  id={perspective.id}
                  checked={perspective.isSelected}
                  onCheckedChange={() => handlePerspectiveToggle(perspective.id)}
                />
                <div className="flex-1">
                  <label
                    htmlFor={perspective.id}
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                  >
                    {perspective.name}
                  </label>
                  <p className="text-xs text-gray-500 mt-1">{perspective.description}</p>
                </div>
                {perspective.isSelected && (
                  <Badge variant="secondary" className="text-xs">
                    Active
                  </Badge>
                )}
              </div>
            ))}
          </TabsContent>

          <TabsContent value="roles" className="space-y-3">
            <p className="text-sm text-gray-400 mb-3">
              Select development roles for specialized code generation
            </p>
            {roleSelections.map((role) => (
              <div key={role.id} className="flex items-center space-x-3">
                <Checkbox
                  id={role.id}
                  checked={role.isSelected}
                  onCheckedChange={() => handleRoleToggle(role.id)}
                />
                <div className="flex-1">
                  <label
                    htmlFor={role.id}
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                  >
                    {role.name}
                  </label>
                  <p className="text-xs text-gray-500 mt-1">{role.description}</p>
                </div>
                {role.isSelected && (
                  <Badge variant="secondary" className="text-xs">
                    Active
                  </Badge>
                )}
              </div>
            ))}
          </TabsContent>
        </Tabs>

        {/* Consciousness Status */}
        {canGenerate && (
          <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
            <p className="text-sm text-blue-400">
              <strong>Consciousness Level:</strong> {consciousnessLevel} 
              • <strong>Voices:</strong> {selectedPerspectives.length + selectedRoles.length}
              • <strong>Ready for Council Generation</strong>
            </p>
          </div>
        )}

        {/* Generate Button */}
        <Button className="w-full" disabled={!canGenerate}>
          <Code className="h-4 w-4 mr-2" />
          {canGenerate ? 'Ready for Council Generation' : 'Select Voices to Begin'}
        </Button>
      </div>
    </Card>
  );
}