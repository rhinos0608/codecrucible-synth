// Right Sidebar - Consciousness-driven voice selection and configuration panel
// Following AI_INSTRUCTIONS.md patterns with stable state management

import { useState } from "react";
import { Brain, Settings, ChevronLeft, ChevronRight, Sparkles, Target, Users, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { PerspectiveSelector } from "@/components/voice-selector";
import { SimpleVoiceSelector } from "@/components/simple-voice-selector";
import { useStableVoicePerspectives, useStableVoiceRoles, useAppStore } from "@/store";
import { usePlanGuard } from "@/hooks/usePlanGuard";
import { FeatureGate } from "@/components/FeatureGate";

interface RightSidebarProps {
  isCollapsed: boolean;
  onToggleCollapsed: () => void;
  className?: string;
}

export function RightSidebar({ isCollapsed, onToggleCollapsed, className }: RightSidebarProps) {
  // Stable selectors following AI_INSTRUCTIONS.md patterns
  const voicePerspectives = useStableVoicePerspectives();
  const voiceRoles = useStableVoiceRoles();
  const authUser = useAppStore(state => state.auth.user);
  const planGuard = usePlanGuard();
  
  const [activeTab, setActiveTab] = useState<'voices' | 'settings' | 'consciousness'>('voices');

  // Calculate consciousness level based on selected voices - following Jung's descent protocols
  const getConsciousnessLevel = () => {
    const totalVoices = (voicePerspectives?.length || 0) + (voiceRoles?.length || 0);
    if (totalVoices === 0) return 'dormant';
    if (totalVoices <= 2) return 'awakening';
    if (totalVoices <= 4) return 'expanding';
    return 'synthesized';
  };

  const consciousnessLevel = getConsciousnessLevel();
  const voiceCount = (voicePerspectives?.length || 0) + (voiceRoles?.length || 0);

  if (isCollapsed) {
    return (
      <div className={`fixed right-0 top-0 h-full w-12 bg-gray-900/95 backdrop-blur-sm border-l border-gray-800 z-40 ${className || ''}`}>
        <div className="flex flex-col items-center p-2 space-y-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggleCollapsed}
            className="w-8 h-8 text-gray-400 hover:text-white hover:bg-gray-800"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          
          <div className="flex flex-col items-center space-y-2">
            <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center">
              <Brain className="w-4 h-4 text-purple-400" />
            </div>
            {voiceCount > 0 && (
              <Badge variant="outline" className="text-xs px-1">
                {voiceCount}
              </Badge>
            )}
          </div>

          <div className="flex flex-col items-center space-y-3 mt-8">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setActiveTab('voices')}
              className={`w-8 h-8 ${activeTab === 'voices' ? 'text-purple-400 bg-purple-500/10' : 'text-gray-400 hover:text-white'}`}
            >
              <Sparkles className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setActiveTab('consciousness')}
              className={`w-8 h-8 ${activeTab === 'consciousness' ? 'text-blue-400 bg-blue-500/10' : 'text-gray-400 hover:text-white'}`}
            >
              <Target className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setActiveTab('settings')}
              className={`w-8 h-8 ${activeTab === 'settings' ? 'text-green-400 bg-green-500/10' : 'text-gray-400 hover:text-white'}`}
            >
              <Settings className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`fixed right-0 top-0 h-full w-96 bg-gray-900/95 backdrop-blur-sm border-l border-gray-800 z-40 ${className || ''}`}>
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-800">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center">
              <Brain className="w-4 h-4 text-purple-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Consciousness Panel</h2>
              <p className="text-sm text-gray-400 capitalize">{consciousnessLevel} state</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggleCollapsed}
            className="text-gray-400 hover:text-white hover:bg-gray-800"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-gray-800">
          <Button
            variant="ghost"
            onClick={() => setActiveTab('voices')}
            className={`flex-1 rounded-none border-b-2 ${
              activeTab === 'voices' 
                ? 'border-purple-500 text-purple-400 bg-purple-500/5' 
                : 'border-transparent text-gray-400 hover:text-white'
            }`}
          >
            <Sparkles className="w-4 h-4 mr-2" />
            Voices
          </Button>
          <Button
            variant="ghost"
            onClick={() => setActiveTab('consciousness')}
            className={`flex-1 rounded-none border-b-2 ${
              activeTab === 'consciousness' 
                ? 'border-blue-500 text-blue-400 bg-blue-500/5' 
                : 'border-transparent text-gray-400 hover:text-white'
            }`}
          >
            <Target className="w-4 h-4 mr-2" />
            Analysis
          </Button>
          <Button
            variant="ghost"
            onClick={() => setActiveTab('settings')}
            className={`flex-1 rounded-none border-b-2 ${
              activeTab === 'settings' 
                ? 'border-green-500 text-green-400 bg-green-500/5' 
                : 'border-transparent text-gray-400 hover:text-white'
            }`}
          >
            <Settings className="w-4 h-4 mr-2" />
            Config
          </Button>
        </div>

        {/* Content */}
        <ScrollArea className="flex-1">
          <div className="p-4">
            {activeTab === 'voices' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium text-gray-300">Voice Selection</h3>
                  <Badge variant="outline" className="text-xs">
                    {voiceCount}/5 voices
                  </Badge>
                </div>

                <FeatureGate feature="advanced-voice-selection" fallback={<SimpleVoiceSelector />}>
                  <PerspectiveSelector />
                </FeatureGate>

                {voiceCount > 0 && (
                  <Card className="p-4 bg-gray-800/50 border-gray-700">
                    <h4 className="text-sm font-medium text-gray-300 mb-3">Active Selection</h4>
                    <div className="space-y-2">
                      {voicePerspectives && voicePerspectives.length > 0 && (
                        <div>
                          <p className="text-xs text-gray-400 mb-1">Perspectives:</p>
                          <div className="flex flex-wrap gap-1">
                            {voicePerspectives.map((perspective) => (
                              <Badge key={perspective} variant="secondary" className="text-xs">
                                {perspective}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                      {voiceRoles && voiceRoles.length > 0 && (
                        <div>
                          <p className="text-xs text-gray-400 mb-1">Roles:</p>
                          <div className="flex flex-wrap gap-1">
                            {voiceRoles.map((role) => (
                              <Badge key={role} variant="secondary" className="text-xs">
                                {role}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </Card>
                )}
              </div>
            )}

            {activeTab === 'consciousness' && (
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-medium text-gray-300 mb-3">Consciousness Analysis</h3>
                  <Card className="p-4 bg-gray-800/50 border-gray-700">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-400">Current Level:</span>
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
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-400">Voice Count:</span>
                        <span className="text-sm text-white">{voiceCount}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-400">Synthesis Ready:</span>
                        <span className={`text-sm ${voiceCount >= 2 ? 'text-green-400' : 'text-red-400'}`}>
                          {voiceCount >= 2 ? 'Yes' : 'No'}
                        </span>
                      </div>
                    </div>
                  </Card>
                </div>

                <div>
                  <h4 className="text-sm font-medium text-gray-300 mb-2">Jung's Descent Protocol</h4>
                  <div className="text-xs text-gray-400 space-y-1">
                    <p>• {consciousnessLevel === 'dormant' ? 'Awaiting voice selection to begin descent' : '✓ Descent protocol active'}</p>
                    <p>• {voiceCount >= 2 ? '✓ Multiple perspectives engaged' : 'Single perspective - limited synthesis'}</p>
                    <p>• {voiceCount >= 4 ? '✓ Complex consciousness formation enabled' : 'Basic consciousness formation'}</p>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'settings' && (
              <div className="space-y-4">
                <h3 className="text-sm font-medium text-gray-300 mb-3">Configuration</h3>
                
                <Card className="p-4 bg-gray-800/50 border-gray-700">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-300">Plan:</span>
                      <Badge variant={planGuard.hasUnlimitedAccess ? "default" : "secondary"}>
                        {authUser?.subscription?.plan || 'Free'}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-300">Daily Quota:</span>
                      <span className="text-sm text-white">
                        {planGuard.quotaUsed}/{planGuard.quotaLimit}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-300">Voice Limit:</span>
                      <span className="text-sm text-white">{voiceCount}/5</span>
                    </div>
                  </div>
                </Card>

                <Card className="p-4 bg-gray-800/50 border-gray-700">
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium text-gray-300">Synthesis Preferences</h4>
                    <div className="text-xs text-gray-400">
                      <p>• Competitive mode active</p>
                      <p>• Quality filtering enabled</p>
                      <p>• Real-time streaming enabled</p>
                    </div>
                  </div>
                </Card>
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Footer */}
        <div className="p-4 border-t border-gray-800">
          <div className="flex items-center justify-between text-xs text-gray-500">
            <span>Following Alexander's patterns</span>
            <div className="flex items-center space-x-1">
              <Users className="w-3 h-3" />
              <span>{authUser?.email?.split('@')[0] || 'Guest'}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}