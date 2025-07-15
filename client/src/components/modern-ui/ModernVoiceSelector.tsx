import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AppleStyleButton } from "./AppleStyleButton";
import { 
  Search, 
  Compass, 
  Shield, 
  Eye, 
  Heart, 
  Target,
  Code2,
  Layers,
  Palette,
  Zap,
  Sparkles,
  Plus,
  Check,
  Crown
} from "lucide-react";
import { cn } from "@/lib/utils";

// Preserve all existing voice selection logic and hooks
import { useVoiceSelection } from "@/contexts/voice-selection-context";
import { useVoiceProfiles } from "@/hooks/use-voice-profiles";
import { useVoiceRecommendations } from "@/hooks/use-voice-recommendations";
import { usePlanGuard } from "@/hooks/usePlanGuard";
import { FeatureGate } from "@/components/FeatureGate";

// Voice archetype configurations with modern styling
const VOICE_ARCHETYPES = {
  perspectives: [
    {
      id: 'explorer',
      name: 'Explorer',
      description: 'Innovative problem-solving and edge case discovery',
      icon: Compass,
      color: 'blue',
      gradient: 'from-blue-500 to-cyan-500'
    },
    {
      id: 'maintainer',
      name: 'Maintainer', 
      description: 'Long-term stability and code quality',
      icon: Shield,
      color: 'green',
      gradient: 'from-green-500 to-emerald-500'
    },
    {
      id: 'analyzer',
      name: 'Analyzer',
      description: 'Deep pattern analysis and optimization',
      icon: Eye,
      color: 'purple',
      gradient: 'from-purple-500 to-violet-500'
    },
    {
      id: 'developer',
      name: 'Developer',
      description: 'User-focused development and experience',
      icon: Heart,
      color: 'rose',
      gradient: 'from-rose-500 to-pink-500'
    },
    {
      id: 'implementor',
      name: 'Implementor',
      description: 'Practical execution and delivery',
      icon: Target,
      color: 'orange',
      gradient: 'from-orange-500 to-amber-500'
    }
  ],
  roles: [
    {
      id: 'security_engineer',
      name: 'Security Engineer',
      description: 'Security best practices and vulnerability assessment',
      icon: Shield,
      color: 'red',
      gradient: 'from-red-500 to-rose-500'
    },
    {
      id: 'systems_architect',
      name: 'Systems Architect',
      description: 'System design and architecture planning',
      icon: Layers,
      color: 'indigo',
      gradient: 'from-indigo-500 to-blue-500'
    },
    {
      id: 'ui_ux_engineer',
      name: 'UI/UX Engineer',
      description: 'User interface design and experience optimization',
      icon: Palette,
      color: 'teal',
      gradient: 'from-teal-500 to-cyan-500'
    },
    {
      id: 'performance_engineer',
      name: 'Performance Engineer',
      description: 'Performance optimization and efficiency',
      icon: Zap,
      color: 'yellow',
      gradient: 'from-yellow-500 to-orange-500'
    }
  ]
};

interface VoiceCardProps {
  voice: any;
  isSelected: boolean;
  onToggle: () => void;
  disabled?: boolean;
}

function VoiceCard({ voice, isSelected, onToggle, disabled }: VoiceCardProps) {
  const Icon = voice.icon;
  
  return (
    <Card 
      className={cn(
        "cursor-pointer transition-all duration-200 hover:shadow-lg",
        "border-2 relative overflow-hidden group",
        isSelected 
          ? `border-${voice.color}-500 shadow-lg shadow-${voice.color}-500/20` 
          : "border-gray-200 dark:border-gray-700 hover:border-gray-300",
        disabled && "opacity-50 cursor-not-allowed"
      )}
      onClick={disabled ? undefined : onToggle}
    >
      {/* Selection indicator */}
      {isSelected && (
        <div className="absolute top-2 right-2 z-10">
          <div className={`w-6 h-6 rounded-full bg-gradient-to-r ${voice.gradient} flex items-center justify-center shadow-lg`}>
            <Check className="w-3 h-3 text-white" />
          </div>
        </div>
      )}

      {/* Gradient overlay */}
      <div className={cn(
        "absolute inset-0 bg-gradient-to-br opacity-0 transition-opacity duration-200",
        `${voice.gradient}`,
        isSelected ? "opacity-10" : "group-hover:opacity-5"
      )} />

      <CardContent className="p-4 relative">
        <div className="flex items-start gap-3">
          <div className={cn(
            "w-12 h-12 rounded-xl flex items-center justify-center shadow-sm transition-all duration-200",
            isSelected 
              ? `bg-gradient-to-r ${voice.gradient} shadow-lg` 
              : "bg-gray-100 dark:bg-gray-800 group-hover:scale-105"
          )}>
            <Icon className={cn(
              "w-6 h-6 transition-colors duration-200",
              isSelected ? "text-white" : `text-${voice.color}-600`
            )} />
          </div>

          <div className="flex-1 min-w-0">
            <h3 className={cn(
              "font-semibold mb-1 transition-colors duration-200",
              isSelected ? `text-${voice.color}-700 dark:text-${voice.color}-300` : "text-gray-900 dark:text-gray-100"
            )}>
              {voice.name}
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
              {voice.description}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function ModernVoiceSelector() {
  // Preserve all existing voice selection logic
  const { 
    selectedPerspectives, 
    selectedRoles, 
    togglePerspective, 
    toggleRole,
    resetVoiceSelection,
    applyVoiceProfile
  } = useVoiceSelection();
  
  const { data: voiceProfiles = [] } = useVoiceProfiles();
  const { planTier } = usePlanGuard();
  const [activeTab, setActiveTab] = useState("analysis");

  // Voice recommendations integration
  const [prompt, setPrompt] = useState("");
  const { data: recommendations, refetch: refetchRecommendations } = useVoiceRecommendations(prompt);

  const getVoiceLimit = () => {
    switch (planTier) {
      case 'free': return 2;
      case 'pro': 
      case 'team':
      case 'enterprise': return 10;
      default: return 2;
    }
  };

  const totalSelected = (selectedPerspectives?.length || 0) + (selectedRoles?.length || 0);
  const voiceLimit = getVoiceLimit();
  const canSelectMore = totalSelected < voiceLimit;

  return (
    <div className="space-y-6">
      {/* Voice Selection Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Voice Council Assembly</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Select AI voices to collaborate on your project
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="font-medium">
            {totalSelected}/{voiceLimit} voices
          </Badge>
          
          <AppleStyleButton
            variant="ghost"
            size="sm"
            onClick={resetVoiceSelection}
            disabled={totalSelected === 0}
          >
            Clear All
          </AppleStyleButton>
        </div>
      </div>

      {/* Voice Selection Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3 bg-gray-100 dark:bg-gray-800 p-1 rounded-xl">
          <TabsTrigger 
            value="analysis" 
            className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm"
          >
            Analysis Engines
          </TabsTrigger>
          <TabsTrigger 
            value="specialization"
            className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm"
          >
            Specialization
          </TabsTrigger>
          <TabsTrigger 
            value="profiles"
            className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm"
          >
            <FeatureGate feature="voice_profiles" showUpgradeIcon>
              My Profiles
            </FeatureGate>
          </TabsTrigger>
        </TabsList>

        {/* Code Analysis Engines */}
        <TabsContent value="analysis" className="space-y-4 mt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {VOICE_ARCHETYPES.perspectives.map((voice) => (
              <VoiceCard
                key={voice.id}
                voice={voice}
                isSelected={selectedPerspectives?.includes(voice.id) || false}
                onToggle={() => togglePerspective(voice.id)}
                disabled={!canSelectMore && !(selectedPerspectives?.includes(voice.id) || false)}
              />
            ))}
          </div>
        </TabsContent>

        {/* Code Specialization Engines */}
        <TabsContent value="specialization" className="space-y-4 mt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {VOICE_ARCHETYPES.roles.map((voice) => (
              <VoiceCard
                key={voice.id}
                voice={voice}
                isSelected={selectedRoles?.includes(voice.id) || false}
                onToggle={() => toggleRole(voice.id)}
                disabled={!canSelectMore && !(selectedRoles?.includes(voice.id) || false)}
              />
            ))}
          </div>
        </TabsContent>

        {/* Voice Profiles */}
        <TabsContent value="profiles" className="space-y-4 mt-6">
          <FeatureGate 
            feature="voice_profiles"
            fallback={
              <Card className="p-8 text-center border-dashed">
                <Crown className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
                  Custom Voice Profiles
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  Create and manage personalized AI voice profiles
                </p>
                <AppleStyleButton variant="consciousness">
                  Upgrade to Pro
                </AppleStyleButton>
              </Card>
            }
          >
            <ScrollArea className="h-[400px]">
              <div className="space-y-3">
                {(voiceProfiles || []).map((profile) => (
                  <Card
                    key={profile.id}
                    className="cursor-pointer hover:shadow-sm transition-all duration-200 border border-gray-200 dark:border-gray-700"
                    onClick={() => applyVoiceProfile(profile)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-gradient-to-r from-purple-500 to-blue-500 flex items-center justify-center">
                          <Sparkles className="w-5 h-5 text-white" />
                        </div>
                        <div className="flex-1">
                          <h4 className="font-medium text-gray-900 dark:text-white">
                            {profile.name}
                          </h4>
                          <p className="text-xs text-gray-600 dark:text-gray-400">
                            {profile.specialization || 'Custom Voice Profile'}
                          </p>
                        </div>
                        <AppleStyleButton variant="ghost" size="sm">
                          Apply
                        </AppleStyleButton>
                      </div>
                    </CardContent>
                  </Card>
                ))}

                {(!voiceProfiles || voiceProfiles.length === 0) && (
                  <Card className="p-6 text-center border-dashed">
                    <Plus className="w-8 h-8 mx-auto mb-3 text-gray-400" />
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                      No custom profiles yet
                    </p>
                    <AppleStyleButton variant="secondary" size="sm">
                      Create Profile
                    </AppleStyleButton>
                  </Card>
                )}
              </div>
            </ScrollArea>
          </FeatureGate>
        </TabsContent>
      </Tabs>

      {/* Voice Recommendations */}
      {recommendations && recommendations.suggestions && recommendations.suggestions.length > 0 && (
        <Card className="border-purple-200 dark:border-purple-800 bg-purple-50 dark:bg-purple-900/20">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Sparkles className="w-4 h-4 text-purple-600" />
              AI Recommendations
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-purple-700 dark:text-purple-300">
              {recommendations.reasoning}
            </p>
            
            <div className="flex flex-wrap gap-2">
              {(recommendations.suggestions || []).map((suggestion, idx) => (
                <Badge 
                  key={idx}
                  variant="secondary"
                  className="bg-purple-100 text-purple-800 hover:bg-purple-200 cursor-pointer transition-colors"
                >
                  {suggestion}
                </Badge>
              ))}
            </div>

            <AppleStyleButton
              variant="secondary"
              size="sm"
              onClick={() => {
                // Apply recommendations logic here
                console.log('Applying recommendations:', recommendations);
              }}
            >
              Apply Suggestions
            </AppleStyleButton>
          </CardContent>
        </Card>
      )}
    </div>
  );
}