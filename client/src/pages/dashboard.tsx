import { useState } from "react";
import { Terminal, Play, Settings, FolderOpen, User, LogOut, BarChart3, Crown, Users, GraduationCap, Brain, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PerspectiveSelector } from "@/components/voice-selector";
import { SolutionStack } from "@/components/solution-stack";
import { SynthesisPanel } from "@/components/synthesis-panel";
import { ProjectsPanel } from "@/components/projects-panel";

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
// import { GuidedTour } from "@/components/guided-tour/GuidedTour";
// import { useNewUserDetection } from "@/hooks/useNewUserDetection";

export default function Dashboard() {
  const [showSolutionStack, setShowSolutionStack] = useState(false);
  const [showSynthesisPanel, setShowSynthesisPanel] = useState(false);
  const [showProjectsPanel, setShowProjectsPanel] = useState(false);

  const [showAvatarCustomizer, setShowAvatarCustomizer] = useState(false);
  const [showChatGPTGeneration, setShowChatGPTGeneration] = useState(false);

  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [editingProfile, setEditingProfile] = useState<VoiceProfile | null>(null);
  const [currentSessionId, setCurrentSessionId] = useState<number | null>(null);
  const [currentSolutions, setCurrentSolutions] = useState<Solution[]>([]);
  const [showRightPanel, setShowRightPanel] = useState(true);
  const [showErrorMonitor, setShowErrorMonitor] = useState(false);
  const [projectContext, setProjectContext] = useState<Project | null>(null);

  const { user } = useAuth();
  const { profiles } = useVoiceProfiles();
  const { recommendations, isAnalyzing, analyzePrompt } = useVoiceRecommendations();
  const planGuard = usePlanGuard();
  
  const { 
    state, 
    setPrompt, 
    getActiveCount,
    getSelectedItems,
    selectPerspectives,
    selectRoles
  } = useVoiceSelection();

  // const { 
  //   shouldShowTour, 
  //   newUserMetrics, 
  //   completeTour, 
  //   skipTour, 
  //   trackMilestone 
  // } = useNewUserDetection();
  
  const { generateSession, isGenerating } = useSolutionGeneration();

  // Navigation guard to prevent accidental exit during code generation
  const { navigateWithConfirmation, isBlocking } = useNavigationGuard({
    shouldBlock: isGenerating || showChatGPTGeneration,
    message: 'Code generation is in progress. Are you sure you want to leave? Your progress will be lost.',
    onBlock: () => {
      console.log('Navigation blocked during code generation');
    },
    onConfirm: () => {
      // Reset generation state when user confirms leaving
      setShowChatGPTGeneration(false);
      setCurrentSessionId(null);
      setCurrentSolutions([]);
    }
  });

  // Enhanced generation with quota enforcement
  const handleSecureGeneration = async () => {
    if (!planGuard.canGenerate) {
      setShowUpgradeModal(true);
      return;
    }

    const result = await planGuard.attemptGeneration(async () => {
      return generateSession(
        state.prompt,
        getSelectedItems(),
        state.prompt
      );
    });

    if (result.success && result.data) {
      handleSolutionsGenerated(result.data);
    }
  };

  const handleSolutionsGenerated = (sessionId: number) => {
    setCurrentSessionId(sessionId);
    setShowSolutionStack(true);
  };

  const handleMergeClick = (solutions: Solution[]) => {
    setCurrentSolutions(solutions);
    setShowSynthesisPanel(true);
  };

  const handlePromptChange = (newPrompt: string) => {
    setPrompt(newPrompt);
    // Trigger voice recommendations when prompt changes
    if (newPrompt.trim().length > 10) {
      analyzePrompt(newPrompt);
    }
  };

  const queryClient = useQueryClient();
  
  const trackRecommendation = useMutation({
    mutationFn: async (data: { sessionId: number; recommendedVoices: string[]; action: 'applied' | 'rejected' }) => {
      const response = await apiRequest('POST', `/api/analytics/recommendations/${data.action}`, {
        sessionId: data.sessionId,
        recommendedVoices: data.recommendedVoices
      });
      return response.json();
    },
    onError: (error) => {
      console.error('Failed to track recommendation:', error);
    }
  });

  const handleApplyRecommendations = () => {
    console.log("[Dashboard] Apply Recommendations clicked", {
      hasRecommendations: !!recommendations?.suggested,
      perspectives: recommendations?.suggested?.perspectives,
      roles: recommendations?.suggested?.roles,
      currentState: {
        selectedPerspectives: state.selectedPerspectives,
        selectedRoles: state.selectedRoles
      }
    });

    if (!recommendations?.suggested) {
      console.error("[Dashboard] No recommendations available to apply");
      return;
    }

    try {
      // Apply recommendations using the context functions
      selectPerspectives(recommendations.suggested.perspectives);
      selectRoles(recommendations.suggested.roles);
      
      console.log("[Dashboard] Recommendations applied successfully", {
        appliedPerspectives: recommendations.suggested.perspectives,
        appliedRoles: recommendations.suggested.roles
      });
      
      // Track analytics event if we have a current session
      if (currentSessionId) {
        trackRecommendation.mutate({
          sessionId: currentSessionId,
          recommendedVoices: [
            ...recommendations.suggested.perspectives,
            ...recommendations.suggested.roles
          ],
          action: 'applied'
        });
      }
    } catch (error) {
      console.error("[Dashboard] Failed to apply recommendations", error);
    }
  };

  const handleGenerateSolutions = async () => {
    // Check quota before proceeding
    if (!planGuard.canGenerate) {
      setShowUpgradeModal(true);
      return;
    }

    // Enhanced Live Council Generation logging following AI_INSTRUCTIONS.md security patterns
    console.log("Live Council Generation Debug:", {
      perspectives: state.selectedPerspectives,
      roles: state.selectedRoles,
      prompt: state.prompt.substring(0, 50) + "...",
      perspectiveCount: state.selectedPerspectives.length,
      roleCount: state.selectedRoles.length,
      mode: "live_council_generation",
      realTimeOpenAI: true
    });
    
    if (!state.prompt.trim()) {
      console.error("Validation Error: Prompt is required");
      return;
    }
    
    if (state.selectedPerspectives.length === 0 && state.selectedRoles.length === 0) {
      console.error("Validation Error: At least one voice must be selected");
      return;
    }

    try {
      // Use plan guard to enforce quotas
      const result = await planGuard.attemptGeneration(async () => {
        console.log("Starting Live Council Generation with real OpenAI integration:", {
          prompt: state.prompt.substring(0, 100),
          perspectives: state.selectedPerspectives,
          roles: state.selectedRoles,
          mode: "live_council_generation"
        });
        
        return generateSession.mutateAsync({
          prompt: state.prompt,
          selectedVoices: {
            perspectives: state.selectedPerspectives,
            roles: state.selectedRoles
          },
          recursionDepth: 2,
          synthesisMode: "competitive",
          ethicalFiltering: true,
          projectContext: projectContext ? {
            name: projectContext.name,
            description: projectContext.description,
            code: projectContext.code,
            language: projectContext.language,
            tags: projectContext.tags
          } : undefined
        });
      });

      console.log("Generation result:", result);

      if (result.success && result.data?.session?.id) {
        handleSolutionsGenerated(result.data.session.id);
      } else if (!result.success && result.reason === 'quota_exceeded') {
        setShowUpgradeModal(true);
      } else {
        console.error("Generation failed:", result);
      }
    } catch (error) {
      console.error("Failed to generate solutions:", error);
    }
  };



  return (
    <div className="min-h-screen flex bg-gray-900 text-gray-100 main-content">
      {/* Main Chat Interface */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <header className="bg-gray-800 border-b border-gray-700 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Terminal className="w-6 h-6 text-blue-400" />
              <div>
                <h1 className="text-xl font-semibold">CodeCrucible</h1>
                <p className="text-sm text-gray-400">Multi-Engine AI Code Generator</p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <FeatureGate feature="voice_profiles" fallback={
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowUpgradeModal(true)}
                  className="text-gray-400 hover:text-gray-200 border-gray-600/50 hover:border-gray-500"
                >
                  <User className="w-4 h-4 mr-2" />
                  <Crown className="w-3 h-3 mr-1" />
                  Voice Profiles (Pro)
                </Button>
              }>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowAvatarCustomizer(true)}
                  className="text-gray-400 hover:text-gray-200 border-gray-600/50 hover:border-gray-500"
                >
                  <User className="w-4 h-4 mr-2" />
                  Voice Profiles
                </Button>
              </FeatureGate>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowProjectsPanel(true)}
                className="text-gray-400 hover:text-gray-200 border-gray-600/50 hover:border-gray-500"
              >
                <FolderOpen className="w-4 h-4 mr-2" />
                Projects
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => navigateWithConfirmation('/onboarding')}
                className="text-gray-400 hover:text-gray-200 border-gray-600/50 hover:border-gray-500"
                data-tour="learning-button"
              >
                <GraduationCap className="w-4 h-4 mr-2" />
                Learning
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigateWithConfirmation('/analytics')}
                className="text-gray-400 hover:text-gray-200 border-gray-600/50 hover:border-gray-500"
              >
                <BarChart3 className="w-4 h-4 mr-2" />
                Analytics
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowUpgradeModal(true)}
                className="text-gray-400 hover:text-gray-200 border-gray-600/50 hover:border-gray-500"
              >
                <Crown className="w-4 h-4 mr-2" />
                Premium
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigateWithConfirmation('/teams')}
                className="text-gray-400 hover:text-gray-200 border-gray-600/50 hover:border-gray-500"
                data-tour="teams-button"
              >
                <Users className="w-4 h-4 mr-2" />
                Teams
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  if (isGenerating || showChatGPTGeneration) {
                    const confirmed = window.confirm('Code generation is in progress. Are you sure you want to logout? Your progress will be lost.');
                    if (confirmed) {
                      window.location.href = '/api/logout';
                    }
                  } else {
                    window.location.href = '/api/logout';
                  }
                }}
                className="text-red-300 hover:text-red-100 border-red-600"
              >
                <LogOut className="w-4 h-4 mr-2" />
                Logout
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowRightPanel(!showRightPanel)}
                className="text-gray-400 hover:text-gray-200"
              >
                <Settings className="w-5 h-5" />
              </Button>
            </div>
          </div>
        </header>

        {/* Chat Area */}
        <div className="flex-1 flex flex-col p-6 space-y-6">

          {/* Project Context */}
          {projectContext && (
            <Card className="bg-gradient-to-r from-green-900/20 to-emerald-900/20 border-green-500/30">
              <div className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-medium text-green-200">Project Context Applied</h3>
                  <Button
                    onClick={() => setProjectContext(null)}
                    size="sm"
                    variant="ghost"
                    className="text-green-300 hover:text-green-100"
                  >
                    ✕ Clear
                  </Button>
                </div>
                <p className="text-sm text-gray-300 mb-2">
                  Using "{projectContext.name}" as context for AI generation
                </p>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline" className="border-green-500/50 text-green-200">
                    {projectContext.language}
                  </Badge>
                  {(projectContext.tags as string[])?.slice(0, 3).map(tag => (
                    <Badge key={tag} variant="outline" className="border-green-500/50 text-green-200">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </div>
            </Card>
          )}



          {/* Prompt Suggestions */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider">Quick Start Ideas</h3>
              <Badge variant="secondary" className="bg-blue-500/10 text-blue-400 border-blue-500/20">
                {isFrontendDevModeEnabled() ? 'DEV 🔧' : 'Suggestions'}
              </Badge>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {[
                {
                  category: "React Components",
                  prompt: "Create a responsive navigation component with dark mode toggle",
                  icon: "⚛️"
                },
                {
                  category: "API Integration", 
                  prompt: "Build a REST API client with error handling and TypeScript types",
                  icon: "🔌"
                },
                {
                  category: "Database Schema",
                  prompt: "Design a user authentication system with Drizzle ORM and PostgreSQL",
                  icon: "🗄️"
                },
                {
                  category: "UI/UX Features",
                  prompt: "Implement a dashboard with charts, filters, and real-time updates",
                  icon: "📊"
                },
                {
                  category: "Performance",
                  prompt: "Optimize a React app for faster loading and better SEO",
                  icon: "⚡"
                },
                {
                  category: "Security",
                  prompt: "Add authentication, input validation, and rate limiting to an API",
                  icon: "🔒"
                }
              ].map((suggestion, index) => (
                <button
                  key={index}
                  onClick={() => handlePromptChange(suggestion.prompt)}
                  className="group p-3 text-left bg-gray-800/50 hover:bg-gray-700/50 border border-gray-700 hover:border-gray-600 rounded-lg transition-all duration-200 hover:scale-[1.02]"
                >
                  <div className="flex items-start gap-2">
                    <span className="text-lg">{suggestion.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs text-gray-400 font-medium mb-1">{suggestion.category}</div>
                      <div className="text-sm text-gray-200 group-hover:text-white line-clamp-2 leading-relaxed">
                        {suggestion.prompt}
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Current Prompt */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider">Your Request</h3>
            <Card className="bg-gray-800 border-gray-700">
              <div className="p-4">
                <Textarea
                  placeholder="Describe what you want to build or the problem you need to solve..."
                  value={state.prompt}
                  onChange={(e) => handlePromptChange(e.target.value)}
                  className="min-h-[120px] bg-transparent border-none resize-none text-gray-100 placeholder-gray-500 focus:ring-0"
                  data-tour="prompt-textarea"
                />
                {isAnalyzing && (
                  <div className="flex items-center space-x-2 mt-2 text-sm text-purple-300">
                    <div className="animate-pulse w-2 h-2 bg-purple-400 rounded-full"></div>
                    <span>Analyzing prompt for voice recommendations...</span>
                  </div>
                )}
              </div>
              <div className="border-t border-gray-700 p-4 flex items-center justify-between">
                <div className="text-sm text-gray-400">
                  {state.prompt.length > 0 ? `${state.prompt.length} characters` : "Start typing your request..."}
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                  <Button
                    onClick={handleGenerateSolutions}
                    disabled={isGenerating || planGuard.isLoading || !state.prompt.trim() || (state.selectedPerspectives.length === 0 && state.selectedRoles.length === 0)}
                    className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300"
                    data-tour="generate-button"
                  >
                    <Brain className="w-4 h-4 mr-2" />
                    {isGenerating ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Council Generation...
                      </>
                    ) : (
                      "Council Generation"
                    )}
                    <Badge variant="secondary" className="ml-2 bg-blue-100 text-blue-800 text-xs">
                      {planGuard.planTier === 'free' ? `${planGuard.quotaUsed}/${planGuard.quotaLimit}` : 'UNLIMITED'}
                    </Badge>
                  </Button>

                  <Button
                    onClick={() => setShowChatGPTGeneration(true)}
                    disabled={!state.prompt.trim() || (state.selectedPerspectives.length === 0 && state.selectedRoles.length === 0)}
                    className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300"
                  >
                    <Brain className="w-4 h-4 mr-2" />
                    Live Streaming
                    <Badge variant="secondary" className="ml-2 bg-purple-100 text-purple-800 text-xs">
                      REAL-TIME
                    </Badge>
                    {isFrontendDevModeFeatureEnabled('showDevBadges') && (
                      <Badge variant="secondary" className="ml-2 bg-green-100 text-green-800 text-xs">
                        {createDevModeBadge()}
                      </Badge>
                    )}
                  </Button>
                </div>
              </div>
              {/* Validation Error Display */}
              {!state.prompt.trim() && (
                <div className="px-4 pb-3">
                  <p className="text-xs text-red-400">Please enter a prompt to generate solutions</p>
                </div>
              )}
              {state.prompt.trim() && state.selectedPerspectives.length === 0 && state.selectedRoles.length === 0 && (
                <div className="px-4 pb-3">
                  <p className="text-xs text-red-400">Please select at least one voice from the configuration panel</p>
                </div>
              )}
              
              {/* Debug State Display - Following AI_INSTRUCTIONS.md security pattern */}
              {process.env.NODE_ENV === 'development' && (
                <div className="px-4 pb-3 border-t border-gray-600 pt-3">
                  <details className="text-xs">
                    <summary className="text-gray-400 cursor-pointer">Debug Voice State</summary>
                    <div className="mt-2 text-gray-500 font-mono space-y-1">
                      <div>Perspectives: [{state.selectedPerspectives.join(', ')}] ({state.selectedPerspectives.length})</div>
                      <div>Roles: [{state.selectedRoles.join(', ')}] ({state.selectedRoles.length})</div>
                      <div>Button disabled: {(isGenerating || !state.prompt.trim() || (state.selectedPerspectives.length === 0 && state.selectedRoles.length === 0)).toString()}</div>
                      <div>Generating: {isGenerating.toString()}</div>
                      <div>Prompt valid: {state.prompt.trim().length > 0 ? 'true' : 'false'}</div>
                      <div>Voices valid: {(state.selectedPerspectives.length > 0 || state.selectedRoles.length > 0) ? 'true' : 'false'}</div>
                    </div>
                  </details>
                </div>
              )}
            </Card>

            {/* Legal Information Section - Following AI_INSTRUCTIONS.md */}
            <LegalSection />
          </div>
        </div>
      </div>

      {/* Right Panel */}
      {showRightPanel && (
        <div className="w-96 bg-gray-800 border-l border-gray-700 flex flex-col">
          <div className="p-4 border-b border-gray-700">
            <h2 className="text-lg font-semibold text-gray-100">Configuration</h2>
            <p className="text-sm text-gray-400">Select code engines and configure generation settings</p>
          </div>
          <div className="flex-1 overflow-y-auto">
            {/* Subscription Status */}
            <div className="p-4">
              <SubscriptionStatus />
            </div>
            <div className="border-t border-gray-700">
              <PerspectiveSelector />
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      <SolutionStack
        isOpen={showSolutionStack}
        onClose={() => setShowSolutionStack(false)}
        sessionId={currentSessionId}
        onMergeClick={handleMergeClick}
      />

      <SynthesisPanel
        isOpen={showSynthesisPanel}
        onClose={() => setShowSynthesisPanel(false)}
        solutions={currentSolutions}
        sessionId={currentSessionId || 0}
      />

      <ProjectsPanel
        isOpen={showProjectsPanel}
        onClose={() => setShowProjectsPanel(false)}
        onUseAsContext={(project) => {
          setProjectContext(project);
          // Clear the prompt and add context information
          setPrompt(`Using project "${project.name}" as context:\n\n${project.description || 'No description provided'}\n\n`);
        }}
      />

      <AvatarCustomizer
        isOpen={showAvatarCustomizer}
        onClose={() => {
          setShowAvatarCustomizer(false);
          setEditingProfile(null);
        }}
        editingProfile={editingProfile}
      />

      <ChatGPTStyleGeneration
        isOpen={showChatGPTGeneration}
        onClose={() => setShowChatGPTGeneration(false)}
        prompt={state.prompt}
        selectedVoices={{
          perspectives: state.selectedPerspectives,
          roles: state.selectedRoles
        }}
        onComplete={(sessionId) => {
          setCurrentSessionId(sessionId);
          setShowSolutionStack(true);
        }}
      />





      <UpgradeModal
        isOpen={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
        trigger="manual"
        currentQuota={planGuard.quotaUsed}
        quotaLimit={planGuard.quotaLimit}
      />

      {/* Guided Tour for New Users - Temporarily disabled for audit */}
      {/* <GuidedTour
        isNewUser={shouldShowTour}
        onComplete={() => {
          completeTour.mutate();
          trackMilestone.mutate({ type: 'first_solution' });
        }}
        onSkip={() => {
          skipTour.mutate();
        }}
      /> */}

      {/* Error Monitor */}
      <ErrorMonitor
        isVisible={showErrorMonitor}
        onToggle={() => setShowErrorMonitor(!showErrorMonitor)}
      />
    </div>
  );
}
