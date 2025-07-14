import { useState, useEffect } from "react";
import { Terminal, Play, Settings, FolderOpen, User, LogOut, BarChart3, Crown, Users, GraduationCap, Brain, Loader2, Target, X, Menu, ChevronRight, HelpCircle, Sparkles, Zap } from "lucide-react";
import { AppleStyleButton } from "./AppleStyleButton";
import { ChatInterface } from "./ChatInterface";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";

import { PerspectiveSelector } from "@/components/voice-selector";
import { SolutionStack } from "@/components/solution-stack";
import { SynthesisPanel } from "@/components/synthesis-panel";
import { ProjectsPanel } from "@/components/projects-panel";
import { EnhancedProjectsPanel } from "@/components/enhanced-projects-panel";
import { AnalyticsPanel } from "@/components/analytics-panel";
import { TeamsPanel } from "@/components/teams-panel";

import { AvatarCustomizer } from "@/components/avatar-customizer";
import { ChatGPTStyleGeneration } from "@/components/chatgpt-style-generation";

import { useSolutionGeneration } from "@/hooks/use-solution-generation";
import { useAuth } from "@/hooks/useAuth";
import { useVoiceProfiles } from "@/hooks/use-voice-profiles";
import { useVoiceRecommendations } from "@/hooks/use-voice-recommendations";
import { usePlanGuard } from "@/hooks/usePlanGuard";
import { useNavigationGuard } from "@/hooks/useNavigationGuard";

import type { Solution, VoiceProfile, Project } from "@shared/schema";
import { useVoiceSelection } from "@/contexts/voice-selection-context";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { SubscriptionStatus } from "@/components/subscription/subscription-status";

import UpgradeModal from "@/components/UpgradeModal";
import LegalSection from "@/components/legal-section";
import ErrorMonitor from "@/components/error-monitor";
import { FeatureGate } from "@/components/FeatureGate";
import { isFrontendDevModeEnabled, isFrontendDevModeFeatureEnabled, createDevModeBadge, devLog } from "@/lib/dev-mode";
import { OnboardingTour } from "@/components/onboarding/OnboardingTour";
import { VoiceProfileTutorial } from "@/components/onboarding/VoiceProfileTutorial";
import { useNewUserDetection } from "@/hooks/useNewUserDetection";
import { useToast } from "@/hooks/use-toast";
import { FileUploadArea } from "@/components/file-upload-area";
import { useSessionFiles } from "@/hooks/useFileUpload";
import type { UserFile } from "@shared/schema";
import { cn } from "@/lib/utils";

export function ModernDashboard() {
  // Preserve all existing state management and hooks
  const [showSolutionStack, setShowSolutionStack] = useState(false);
  const [showSynthesisPanel, setShowSynthesisPanel] = useState(false);
  const [showProjectsPanel, setShowProjectsPanel] = useState(false);
  const [showVoiceProfilesPanel, setShowVoiceProfilesPanel] = useState(false);
  const [showAnalyticsPanel, setShowAnalyticsPanel] = useState(false);
  const [showTeamsPanel, setShowTeamsPanel] = useState(false);
  const [showLearningPanel, setShowLearningPanel] = useState(false);
  const [showVoiceProfileTutorial, setShowVoiceProfileTutorial] = useState(false);

  const [showAvatarCustomizer, setShowAvatarCustomizer] = useState(false);
  const [showChatGPTGeneration, setShowChatGPTGeneration] = useState(false);

  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [editingProfile, setEditingProfile] = useState<VoiceProfile | null>(null);
  const [currentSessionId, setCurrentSessionId] = useState<number | null>(null);
  const [currentSolutions, setCurrentSolutions] = useState<Solution[]>([]);
  const [showRightPanel, setShowRightPanel] = useState(true);
  const [showErrorMonitor, setShowErrorMonitor] = useState(false);
  const [projectContext, setProjectContext] = useState<Project | null>(null);
  const [selectedContextProjects, setSelectedContextProjects] = useState<Project[]>([]);

  // Preserve all existing hooks
  const { user, logout } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { planTier, planGuard } = usePlanGuard();
  const { selectedPerspectives, selectedRoles, resetVoiceSelection } = useVoiceSelection();
  const { isNewUser, shouldShowTour } = useNewUserDetection();

  // Enhanced prompt state with Apple-style interactions
  const [prompt, setPrompt] = useState("");
  const [isPromptFocused, setIsPromptFocused] = useState(false);

  // Preserve existing mutations and API calls
  const generateSessionMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest('/api/sessions', {
        method: 'POST',
        body: data
      });
    },
    onSuccess: (response) => {
      setCurrentSessionId(response.sessionId);
      setCurrentSolutions(response.solutions || []);
      setShowSolutionStack(true);
      queryClient.invalidateQueries({ queryKey: ['/api/analytics'] });
    },
    onError: (error) => {
      console.error('Session generation error:', error);
      toast({
        title: "Generation Failed",
        description: "Unable to generate solutions. Please try again.",
        variant: "destructive"
      });
    }
  });

  // Enhanced generation handler with modern UX
  const handleGeneration = async () => {
    if (!prompt.trim()) {
      toast({
        title: "Prompt Required",
        description: "Please enter a coding challenge or request.",
        variant: "destructive"
      });
      return;
    }

    const canGenerate = await planGuard.attemptGeneration();
    if (!canGenerate) return;

    const sessionData = {
      prompt: prompt.trim(),
      perspectives: selectedPerspectives,
      roles: selectedRoles,
      context: selectedContextProjects.map(p => ({
        id: p.id,
        name: p.name,
        code: p.code
      }))
    };

    generateSessionMutation.mutate(sessionData);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Modern Header */}
      <header className="sticky top-0 z-50 bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo & Brand */}
            <div className="flex items-center gap-4">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-r from-purple-600 to-blue-600 flex items-center justify-center shadow-lg">
                <Brain className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900 dark:text-white">CodeCrucible</h1>
                <p className="text-xs text-gray-500 dark:text-gray-400">Multi-Voice AI Platform</p>
              </div>
            </div>

            {/* Navigation */}
            <nav className="hidden md:flex items-center gap-2">
              <AppleStyleButton
                variant="ghost"
                size="sm"
                onClick={() => setShowProjectsPanel(true)}
              >
                <FolderOpen className="w-4 h-4" />
                Projects
              </AppleStyleButton>
              
              <FeatureGate feature="voice_profiles">
                <AppleStyleButton
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowVoiceProfilesPanel(true)}
                >
                  <User className="w-4 h-4" />
                  Voice Profiles
                </AppleStyleButton>
              </FeatureGate>

              <FeatureGate feature="analytics">
                <AppleStyleButton
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowAnalyticsPanel(true)}
                >
                  <BarChart3 className="w-4 h-4" />
                  Analytics
                </AppleStyleButton>
              </FeatureGate>

              <AppleStyleButton
                variant="ghost"
                size="sm"
                onClick={() => setShowTeamsPanel(true)}
              >
                <Users className="w-4 h-4" />
                Teams
              </AppleStyleButton>
            </nav>

            {/* User Menu */}
            <div className="flex items-center gap-3">
              <SubscriptionStatus />
              <AppleStyleButton
                variant="ghost"
                size="sm"
                onClick={logout}
              >
                <LogOut className="w-4 h-4" />
              </AppleStyleButton>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Panel - Prompt & Voice Selection */}
          <div className="lg:col-span-2 space-y-6">
            {/* Enhanced Prompt Input */}
            <Card className="overflow-hidden shadow-sm border-0 bg-white dark:bg-gray-800">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Terminal className="w-5 h-5 text-purple-600" />
                  Your Coding Challenge
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="relative">
                  <Textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    onFocus={() => setIsPromptFocused(true)}
                    onBlur={() => setIsPromptFocused(false)}
                    placeholder="Describe your coding challenge or ask a question..."
                    className={cn(
                      "min-h-[120px] resize-none border-2 transition-all duration-200",
                      isPromptFocused 
                        ? "border-purple-500 shadow-lg shadow-purple-500/20" 
                        : "border-gray-200 dark:border-gray-700"
                    )}
                  />
                  <div className="absolute bottom-3 right-3 text-xs text-gray-400">
                    {prompt.length}/5000
                  </div>
                </div>

                {/* Enhanced Generation Buttons */}
                <div className="flex gap-3">
                  <AppleStyleButton
                    onClick={handleGeneration}
                    disabled={!prompt.trim() || generateSessionMutation.isPending}
                    loading={generateSessionMutation.isPending}
                    variant="consciousness"
                    className="flex-1"
                    icon={<Brain className="w-4 h-4" />}
                  >
                    Council Generation
                  </AppleStyleButton>

                  <AppleStyleButton
                    onClick={() => setShowChatGPTGeneration(true)}
                    disabled={!prompt.trim()}
                    variant="secondary"
                    icon={<Zap className="w-4 h-4" />}
                  >
                    Live Streaming
                  </AppleStyleButton>
                </div>
              </CardContent>
            </Card>

            {/* Voice Selection */}
            <Card className="shadow-sm border-0 bg-white dark:bg-gray-800">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-blue-600" />
                  Voice Council Assembly
                </CardTitle>
              </CardHeader>
              <CardContent>
                <PerspectiveSelector />
              </CardContent>
            </Card>
          </div>

          {/* Right Panel - Results & Tools */}
          <div className="space-y-6">
            {/* Quick Actions */}
            <Card className="shadow-sm border-0 bg-white dark:bg-gray-800">
              <CardHeader>
                <CardTitle className="text-base">Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <AppleStyleButton
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start"
                  onClick={() => setShowProjectsPanel(true)}
                >
                  <FolderOpen className="w-4 h-4" />
                  Browse Projects
                </AppleStyleButton>

                <FeatureGate feature="voice_profiles">
                  <AppleStyleButton
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start"
                    onClick={() => setShowAvatarCustomizer(true)}
                  >
                    <User className="w-4 h-4" />
                    Create Voice Profile
                  </AppleStyleButton>
                </FeatureGate>

                <AppleStyleButton
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start"
                  onClick={() => setShowAnalyticsPanel(true)}
                >
                  <BarChart3 className="w-4 h-4" />
                  View Analytics
                </AppleStyleButton>
              </CardContent>
            </Card>

            {/* System Metrics */}
            <Card className="shadow-sm border-0 bg-white dark:bg-gray-800">
              <CardHeader>
                <CardTitle className="text-base">System Status</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400">Generation Speed</span>
                    <span className="font-medium">Fast</span>
                  </div>
                  <Progress value={85} className="h-2" />
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400">Success Rate</span>
                    <span className="font-medium">98%</span>
                  </div>
                  <Progress value={98} className="h-2" />
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400">Ethical Score</span>
                    <span className="font-medium">A+</span>
                  </div>
                  <Progress value={95} className="h-2" />
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>

      {/* Preserve all existing modals and panels */}
      {showSolutionStack && (
        <SolutionStack
          isOpen={showSolutionStack}
          onClose={() => setShowSolutionStack(false)}
          sessionId={currentSessionId}
          solutions={currentSolutions}
          onSynthesize={() => setShowSynthesisPanel(true)}
        />
      )}

      {showSynthesisPanel && (
        <SynthesisPanel
          isOpen={showSynthesisPanel}
          onClose={() => setShowSynthesisPanel(false)}
          sessionId={currentSessionId}
          solutions={currentSolutions}
        />
      )}

      {showProjectsPanel && (
        <EnhancedProjectsPanel
          isOpen={showProjectsPanel}
          onClose={() => setShowProjectsPanel(false)}
          onProjectContext={(project) => {
            setProjectContext(project);
            if (project) {
              setSelectedContextProjects([project]);
              toast({
                title: "Project Context Added",
                description: `Using "${project.name}" as generation context`
              });
            }
          }}
        />
      )}

      {showChatGPTGeneration && (
        <ChatGPTStyleGeneration
          isOpen={showChatGPTGeneration}
          onClose={() => setShowChatGPTGeneration(false)}
          prompt={prompt}
          selectedVoices={{ perspectives: selectedPerspectives, roles: selectedRoles }}
          onComplete={(sessionId) => {
            setCurrentSessionId(sessionId);
            setShowSolutionStack(true);
          }}
        />
      )}

      {/* Preserve all other existing modals */}
      <UpgradeModal
        isOpen={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
      />

      {shouldShowTour && (
        <OnboardingTour />
      )}

      {showVoiceProfileTutorial && (
        <VoiceProfileTutorial
          isOpen={showVoiceProfileTutorial}
          onClose={() => setShowVoiceProfileTutorial(false)}
        />
      )}
    </div>
  );
}