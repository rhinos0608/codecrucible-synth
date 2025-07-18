import { useState, useEffect } from "react";
import { Terminal, Play, Settings, FolderOpen, User, LogOut, BarChart3, Crown, Users, GraduationCap, Brain, Loader2, Target, X, Menu, ChevronRight, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

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
import { 
  useVoiceSelection, 
  useUIState, 
  useAuthState, 
  useProjectManagement 
} from "@/store";
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

export default function Dashboard() {
  // Replace scattered useState with centralized store - following AI_INSTRUCTIONS.md patterns
  const { panels, modals, actions: uiActions } = useUIState();
  const { user: storeUser, isAuthenticated, subscription } = useAuthState();
  const { perspectives, roles, actions: voiceActions } = useVoiceSelection();
  const { selectedProject, actions: projectActions } = useProjectManagement();
  
  // Keep some local state for non-persistent UI elements
  const [showSolutionStack, setShowSolutionStack] = useState(false);
  const [showSynthesisPanel, setShowSynthesisPanel] = useState(false);
  const [showVoiceProfileTutorial, setShowVoiceProfileTutorial] = useState(false);
  const [showRightPanel, setShowRightPanel] = useState(true);
  const [editingProfile, setEditingProfile] = useState<VoiceProfile | null>(null);
  const [currentSessionId, setCurrentSessionId] = useState<number | null>(null);
  const [currentSolutions, setCurrentSolutions] = useState<Solution[]>([]);
  const [showErrorMonitor, setShowErrorMonitor] = useState(false);
  const [projectContext, setProjectContext] = useState<Project | null>(null);
  const [selectedContextProjects, setSelectedContextProjects] = useState<Project[]>([]);
  const [contextFileCount, setContextFileCount] = useState(0);
  const [attachedFiles, setAttachedFiles] = useState<UserFile[]>([]);
  const [sessionId, setSessionId] = useState<number | null>(null);

  const [showChatGPTGeneration, setShowChatGPTGeneration] = useState(false);
  const [prompt, setPrompt] = useState('');

  const { user: authUser } = useAuth();
  const { profiles } = useVoiceProfiles();
  const { recommendations, isAnalyzing, analyzePrompt } = useVoiceRecommendations();
  const planGuard = usePlanGuard();
  const { toast } = useToast();

  // File upload handlers for session context
  const handleFileUploaded = (file: UserFile) => {
    setAttachedFiles(prev => [...prev, file]);
    toast({
      title: "File uploaded",
      description: `${file.fileName} has been added to your workspace and will be included in AI context.`,
    });
  };

  const handleFilesAttached = (files: UserFile[]) => {
    setAttachedFiles(prev => [...prev, ...files]);
    toast({
      title: "Files attached",
      description: `${files.length} file${files.length > 1 ? 's' : ''} attached to current session.`,
    });
  };
  
  // Upgrade success detection - following AI_INSTRUCTIONS.md patterns
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const upgrade = urlParams.get('upgrade');
    const tier = urlParams.get('tier');
    
    if (upgrade === 'success' && tier) {
      toast({
        title: "Subscription Activated",
        description: `Welcome to Arkane Technologies ${tier.charAt(0).toUpperCase() + tier.slice(1)}! You now have unlimited AI generations.`,
      });
      
      // Clean URL parameters
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [toast]);
  
  // Remove old useVoiceSelection hook - now using store

  const { 
    shouldShowTour, 
    newUserMetrics, 
    completeTour, 
    skipTour, 
    trackMilestone 
  } = useNewUserDetection();

  // Show voice profile tutorial for users who completed main tour but haven't created profiles
  const shouldShowVoiceProfileTutorial = !shouldShowTour && profiles.length === 0;
  
  const { generateSession, isGenerating } = useSolutionGeneration();

  // Enhanced navigation guard to prevent accidental exit during code generation
  const { navigateWithConfirmation, isBlocking, confirmationDialog } = useNavigationGuard({
    shouldBlock: isGenerating || showChatGPTGeneration,
    message: 'Code generation is in progress. Are you sure you want to leave? All progress will be lost.',
    type: 'critical',
    context: {
      feature: isGenerating ? 'Council Generation' : 'Live Streaming',
      progress: isGenerating ? 'Generating...' : 'Streaming...',
      timeInvested: '30+ seconds',
      consequences: [
        'All generated code will be lost',
        'Voice analysis progress will be reset',
        'You will need to restart the generation process'
      ]
    },
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

  // Enhanced generation with quota enforcement - FIXED to use mutation API
  const handleSecureGeneration = async () => {
    if (!planGuard.canGenerate) {
      uiActions.openModal('upgrade');
      return;
    }

    const result = await planGuard.attemptGeneration(async () => {
      return generateSession.mutateAsync({
        prompt: prompt,
        selectedVoices: {
          perspectives: perspectives,
          roles: roles
        },
        contextProjects: selectedContextProjects,
        recursionDepth: 2,
        synthesisMode: "competitive",
        ethicalFiltering: true
      });
    });

    if (result.success && result.data?.session?.id) {
      handleSolutionsGenerated(result.data.session.id);
    }
  };

  const handleSolutionsGenerated = (sessionId: number) => {
    console.log("🎯 handleSolutionsGenerated called:", {
      sessionId,
      previousSessionId: currentSessionId,
      aboutToSetShowSolutionStack: true
    });
    setCurrentSessionId(sessionId);
    setShowSolutionStack(true);
    console.log("✅ Solution Stack state updated:", {
      newSessionId: sessionId,
      showSolutionStack: true
    });
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
  
  // Context-aware generation mutation
  const contextAwareGenerationMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest('/api/sessions/context-aware', {
        method: 'POST',
        body: JSON.stringify(data)
      });
    },
    onSuccess: (data) => {
      setCurrentSolutions(data.solutions || []);
      setCurrentSessionId(data.sessionId || Date.now());
      setShowSolutionStack(true);
    },
    onError: (error: any) => {
      console.error('Context-aware generation failed:', error);
    }
  });
  
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

  // Handle using projects as context
  const handleUseAsContext = (projects: Project[]) => {
    setSelectedContextProjects(projects);
    
    // Calculate total file count from all projects with selectedFiles
    const totalFiles = projects.reduce((count, project) => {
      return count + (project.selectedFiles?.length || 0);
    }, 0);
    setContextFileCount(totalFiles);
    
    console.log('🔧 Context Updated - Projects selected for AI council:', {
      projectCount: projects.length,
      totalFiles,
      projects: projects.map(p => ({
        name: p.name,
        selectedFiles: p.selectedFiles?.length || 0
      }))
    });

    // Show success notification following AI_INSTRUCTIONS.md patterns
    toast({
      title: "AI Council Context Updated",
      description: `Using ${projects.length} project${projects.length !== 1 ? 's' : ''} with ${totalFiles} selected files for enhanced code generation.`,
    });
  };



  const handleApplyRecommendations = () => {
    console.log("[Dashboard] Apply Recommendations clicked", {
      hasRecommendations: !!recommendations?.suggested,
      perspectives: recommendations?.suggested?.perspectives,
      roles: recommendations?.suggested?.roles,
      currentState: {
        selectedPerspectives: perspectives,
        selectedRoles: roles
      }
    });

    if (!recommendations?.suggested) {
      console.error("[Dashboard] No recommendations available to apply");
      return;
    }

    try {
      // Apply recommendations using the store actions
      voiceActions.selectPerspectives(recommendations.suggested.perspectives);
      voiceActions.selectRoles(recommendations.suggested.roles);
      
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
    // Enhanced dev mode logging for debugging
    console.log('Council Generation Debug - Plan Guard State:', {
      canGenerate: planGuard.canGenerate,
      planTier: planGuard.planTier,
      quotaUsed: planGuard.quotaUsed,
      quotaLimit: planGuard.quotaLimit,
      isLoading: planGuard.isLoading,
      error: planGuard.error
    });
    
    // Critical dev mode detection following AI_INSTRUCTIONS.md patterns
    const isDevModeActive = planGuard.planTier === 'development' || planGuard.quotaLimit === 999 || planGuard.quotaLimit === -1;
    
    console.log('🔧 DEV MODE ANALYSIS:', {
      planTier: planGuard.planTier,
      quotaLimit: planGuard.quotaLimit,
      canGenerate: planGuard.canGenerate,
      isDevModeActive: isDevModeActive,
      shouldBypass: isDevModeActive
    });
    
    // DEV MODE ALWAYS BYPASSES - Check dev mode FIRST before any blocking
    if (isDevModeActive) {
      console.log('🔧 DEV MODE ACTIVE - proceeding with unlimited generation regardless of other checks');
    } else if (!planGuard.canGenerate) {
      console.log('❌ Generation BLOCKED - redirecting to upgrade modal:', {
        canGenerate: planGuard.canGenerate,
        planTier: planGuard.planTier,
        quotaLimit: planGuard.quotaLimit,
        isDevModeActive
      });
      uiActions.openModal('upgrade');
      return;
    }
    
    console.log('✅ Generation ALLOWED - proceeding with council assembly:', {
      canGenerate: planGuard.canGenerate,
      planTier: planGuard.planTier,
      isDevModeActive,
      quotaUsed: planGuard.quotaUsed,
      quotaLimit: planGuard.quotaLimit
    });

    // Enhanced Live Council Generation logging following AI_INSTRUCTIONS.md security patterns
    console.log("Live Council Generation Debug:", {
      perspectives: perspectives,
      roles: roles,
      prompt: "TODO: prompt...",
      perspectiveCount: perspectives.length,
      roleCount: roles.length,
      mode: "live_council_generation",
      realTimeOpenAI: true
    });
    
    // TODO: Add prompt validation when prompt is added to store
    
    if (perspectives.length === 0 && roles.length === 0) {
      console.error("Validation Error: At least one voice must be selected");
      return;
    }

    try {
      // Use plan guard to enforce quotas
      const result = await planGuard.attemptGeneration(async () => {
        console.log("Starting Live Council Generation with real OpenAI integration:", {
          prompt: "TODO: prompt",
          perspectives: perspectives,
          roles: roles,
          mode: "live_council_generation"
        });
        
        return generateSession.mutateAsync({
          prompt: prompt,
          selectedVoices: {
            perspectives: perspectives,
            roles: roles
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
        console.log("✅ Council Generation Success - Opening Solutions Display:", {
          sessionId: result.data.session.id,
          solutionCount: result.data.session.solutionCount,
          showSolutionStack: showSolutionStack,
          currentSessionId: currentSessionId
        });
        handleSolutionsGenerated(result.data.session.id);
      } else if (!result.success && result.reason === 'quota_exceeded') {
        uiActions.openModal('upgrade');
      } else {
        console.error("Generation failed:", result);
      }
    } catch (error) {
      console.error("Failed to generate solutions:", error);
    }
  };



  return (
    <>
      {confirmationDialog}
      <div className="dashboard-container min-h-screen flex bg-gray-900 text-gray-100 main-content overflow-hidden">
      {/* Main Chat Interface */}
      <div className="dashboard-main flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header - Mobile Optimized */}
        <header className="bg-gray-800 border-b border-gray-700 px-3 sm:px-6 py-3 sm:py-4">
          <div className="flex items-center justify-between min-w-0">
            <div className="flex items-center space-x-2 sm:space-x-3 flex-shrink-0">
              <Terminal className="w-5 h-5 sm:w-6 sm:h-6 text-blue-400" />
              <div className="hidden sm:block">
                <h1 className="text-lg sm:text-xl font-semibold">Code Crucible</h1>
                <p className="text-xs sm:text-sm text-gray-400">Multi-Voice AI Coding Assistant</p>
              </div>
              <div className="block sm:hidden">
                <h1 className="text-base font-semibold">Crucible</h1>
              </div>
            </div>
            <div className="flex items-center space-x-1 sm:space-x-2 overflow-x-auto flex-shrink-0 min-w-0 nav-scroll-container">
              <div className="flex items-center space-x-1 sm:space-x-2 whitespace-nowrap min-w-max pr-2 sm:pr-4">
                <FeatureGate feature="voice_profiles" fallback={
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => uiActions.openModal('upgrade')}
                    className="text-gray-400 hover:text-gray-200 border-gray-600/50 hover:border-gray-500 whitespace-nowrap"
                  >
                    <User className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                    <Crown className="w-2 h-2 sm:w-3 sm:h-3 mr-0.5 sm:mr-1" />
                    <span className="hidden sm:inline">Voice Profiles (Pro)</span>
                    <span className="sm:hidden">Voices</span>
                  </Button>
                }>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => uiActions.openModal('avatarCustomizer')}
                    className="text-gray-400 hover:text-gray-200 border-gray-600/50 hover:border-gray-500 whitespace-nowrap"
                  >
                    <User className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                    <span className="hidden sm:inline">Voice Profiles</span>
                    <span className="sm:hidden">Voices</span>
                  </Button>
                </FeatureGate>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    console.log("🎯 Enhanced Projects button clicked, setting showEnhancedProjectsPanel to true");
                    uiActions.togglePanel('projects');
                  }}
                  className="text-gray-400 hover:text-blue-400 border-gray-600/50 hover:border-blue-500/50 hover:bg-blue-500/10 whitespace-nowrap transition-all duration-200"
                >
                  <FolderOpen className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                  <span className="hidden sm:inline">Projects</span>
                  <span className="sm:hidden">Files</span>
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowVoiceProfileTutorial(true)}
                  className="text-gray-400 hover:text-gray-200 border-gray-600/50 hover:border-gray-500 whitespace-nowrap relative"
                  data-tour="learning-button"
                >
                  <GraduationCap className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                  <span className="hidden sm:inline">Learning</span>
                  <span className="sm:hidden">Learn</span>
                  {shouldShowVoiceProfileTutorial && (
                    <span className="ml-1 sm:ml-2 px-1 sm:px-2 py-0.5 text-xs bg-blue-500/20 text-blue-400 rounded-full border border-blue-500/30 hidden sm:inline">
                      Tutorial Available
                    </span>
                  )}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    console.log("📊 Analytics button clicked, opening analytics panel");
                    uiActions.togglePanel('analytics');
                  }}
                  className="text-gray-400 hover:text-gray-200 border-gray-600/50 hover:border-gray-500 whitespace-nowrap"
                  data-tour="navigation-buttons"
                >
                  <BarChart3 className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                  <span className="hidden sm:inline">Analytics</span>
                  <span className="sm:hidden">Stats</span>
                </Button>
                {/* Settings/Configuration Toggle */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowRightPanel(!showRightPanel)}
                  className="text-gray-400 hover:text-gray-200 border-gray-600/50 hover:border-gray-500"
                  title={showRightPanel ? "Hide Configuration" : "Show Configuration"}
                >
                  <Menu className="w-4 h-4 md:hidden" />
                  <Settings className="w-4 h-4 hidden md:inline" />
                  <span className="hidden lg:inline ml-2">
                    {showRightPanel ? "Hide Config" : "Show Config"}
                  </span>
                </Button>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => uiActions.openModal('upgrade')}
                  className="text-gray-400 hover:text-gray-200 border-gray-600/50 hover:border-gray-500 whitespace-nowrap"
                >
                  <Crown className="w-4 h-4 mr-2" />
                  Premium
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    console.log("👥 Teams button clicked, opening teams panel");
                    uiActions.togglePanel('teams');
                  }}
                  className="text-gray-400 hover:text-gray-200 border-gray-600/50 hover:border-gray-500 whitespace-nowrap"
                  data-tour="teams-button"
                >
                  <Users className="w-4 h-4 mr-2" />
                  Teams
                  <span className="ml-2 px-2 py-0.5 text-xs bg-orange-500/20 text-orange-400 rounded-full border border-orange-500/30">
                    Coming Soon
                  </span>
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
                  className="text-red-300 hover:text-red-100 border-red-600 whitespace-nowrap"
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
          </div>
        </header>

        {/* Chat Area - Mobile Optimized */}
        <div className="flex-1 flex flex-col p-3 sm:p-6 space-y-4 sm:space-y-6">
          {/* Welcome Element for Tour */}
          <div className="hidden" data-tour="welcome">
            <h1 className="text-2xl font-bold text-gray-100">Welcome to CodeCrucible</h1>
            <p className="text-gray-400">Your AI-powered collaborative coding platform</p>
          </div>

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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
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
                  className="group p-2 sm:p-3 text-left bg-gray-800/50 hover:bg-gray-700/50 border border-gray-700 hover:border-gray-600 rounded-lg transition-all duration-200 hover:scale-[1.02]"
                >
                  <div className="flex items-start gap-2">
                    <span className="text-base sm:text-lg">{suggestion.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs text-gray-400 font-medium mb-1">{suggestion.category}</div>
                      <div className="text-xs sm:text-sm text-gray-200 group-hover:text-white line-clamp-2 leading-relaxed">
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
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider">Your Request</h3>
              {selectedContextProjects.length > 0 && (
                <div className="flex items-center gap-2 px-3 py-1 bg-blue-900/30 border border-blue-700/50 rounded-full">
                  <Target className="w-4 h-4 text-blue-400" />
                  <span className="text-xs text-blue-300 font-medium">
                    {selectedContextProjects.length} project{selectedContextProjects.length !== 1 ? 's' : ''} • {contextFileCount} files
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-4 w-4 p-0 text-blue-400 hover:text-blue-300"
                    onClick={() => {
                      setSelectedContextProjects([]);
                      setContextFileCount(0);
                      toast({
                        title: "Context Cleared",
                        description: "AI council context has been reset.",
                      });
                    }}
                    title="Clear context"
                  >
                    <X className="w-3 h-3" />
                  </Button>
                </div>
              )}
            </div>
            <Card className="bg-gray-800 border-gray-700">
              <div className="p-3 sm:p-4">
                <Textarea
                  placeholder="Describe what you want to build or the problem you need to solve..."
                  value={prompt}
                  onChange={(e) => handlePromptChange(e.target.value)}
                  className="min-h-[100px] sm:min-h-[120px] bg-transparent border-none resize-none text-gray-100 placeholder-gray-500 focus:ring-0 text-sm sm:text-base"
                  data-tour="prompt-textarea"
                />
                {isAnalyzing && (
                  <div className="flex items-center space-x-2 mt-2 text-sm text-purple-300">
                    <div className="animate-pulse w-2 h-2 bg-purple-400 rounded-full"></div>
                    <span>Analyzing prompt for voice recommendations...</span>
                  </div>
                )}
                
                {/* File Upload Area */}
                <div className="mt-4 border-t border-gray-700 pt-4" data-tour="file-upload">
                  <FileUploadArea
                    sessionId={sessionId}
                    onFileUploaded={handleFileUploaded}
                    onFilesAttached={handleFilesAttached}
                    variant="compact"
                    maxFiles={3}
                    showAttachedFiles={true}
                    attachedFiles={attachedFiles}
                    className="mb-2"
                  />
                </div>
              </div>
              <div className="border-t border-gray-700 p-4 flex items-center justify-between">
                <div className="text-sm text-gray-400">
                  {prompt.length > 0 ? `${prompt.length} characters` : "Start typing your request..."}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
                  <Button
                    onClick={handleGenerateSolutions}
                    disabled={isGenerating || planGuard.isLoading || !prompt.trim() || (perspectives.length === 0 && roles.length === 0)}
                    className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 flex items-center justify-center gap-2 py-2 sm:py-3 px-3 sm:px-4 text-sm sm:text-base"
                    data-tour="generate-button"
                  >
                    {isGenerating ? (
                      <>
                        <Loader2 className="w-4 sm:w-5 h-4 sm:h-5 animate-spin flex-shrink-0" />
                        <span className="font-medium hidden sm:inline">Council Generation...</span>
                        <span className="font-medium sm:hidden">Generating...</span>
                      </>
                    ) : (
                      <>
                        <Brain className="w-4 sm:w-5 h-4 sm:h-5 flex-shrink-0" />
                        <span className="font-medium hidden sm:inline">Council Generation</span>
                        <span className="font-medium sm:hidden">Council</span>
                      </>
                    )}
                    <Badge variant="secondary" className="bg-blue-100 text-blue-800 text-xs font-medium hidden sm:inline-flex">
                      {planGuard.planTier === 'free' ? `${planGuard.quotaUsed}/${planGuard.quotaLimit}` : 'UNLIMITED'}
                    </Badge>
                  </Button>

                  <Button
                    onClick={() => {
                      console.log('Live Streaming button clicked - Dev mode check:', {
                        canGenerate: planGuard.canGenerate,
                        planTier: planGuard.planTier,
                        isDevMode: planGuard.planTier === 'development'
                      });
                      setShowChatGPTGeneration(true);
                    }}
                    disabled={!prompt.trim() || (perspectives.length === 0 && roles.length === 0)}
                    className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 flex items-center justify-center gap-2 py-2 sm:py-3 px-3 sm:px-4 text-sm sm:text-base"
                  >
                    <Brain className="w-4 sm:w-5 h-4 sm:h-5 flex-shrink-0" />
                    <span className="font-medium hidden sm:inline">Live Streaming</span>
                    <span className="font-medium sm:hidden">Streaming</span>
                    <Badge variant="secondary" className="bg-purple-100 text-purple-800 text-xs font-medium hidden sm:inline-flex">
                      REAL-TIME
                    </Badge>
                    {isFrontendDevModeFeatureEnabled('showDevBadges') && (
                      <Badge variant="secondary" className="bg-green-100 text-green-800 text-xs font-medium hidden sm:inline-flex">
                        {createDevModeBadge()}
                      </Badge>
                    )}
                  </Button>
                </div>
              </div>
              {/* Validation Error Display */}
              {!prompt.trim() && (
                <div className="px-4 pb-3">
                  <p className="text-xs text-red-400">Please enter a prompt to generate solutions</p>
                </div>
              )}
              {prompt.trim() && perspectives.length === 0 && roles.length === 0 && (
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
                      <div>Perspectives: [{perspectives.join(', ')}] ({perspectives.length})</div>
                      <div>Roles: [{roles.join(', ')}] ({roles.length})</div>
                      <div>Button disabled: {(isGenerating || !prompt.trim() || (perspectives.length === 0 && roles.length === 0)).toString()}</div>
                      <div>Generating: {isGenerating.toString()}</div>
                      <div>Prompt valid: {prompt.trim().length > 0 ? 'true' : 'false'}</div>
                      <div>Voices valid: {(perspectives.length > 0 || roles.length > 0) ? 'true' : 'false'}</div>
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

      {/* Right Panel - Mobile Optimized */}
      {showRightPanel && (
        <>
          {/* Mobile Overlay */}
          <div className="md:hidden fixed inset-0 bg-black/50 z-40" onClick={() => setShowRightPanel(false)} />
          
          <div className={`dashboard-right-panel w-80 lg:w-96 xl:w-[400px] min-w-[320px] max-w-[480px] bg-gray-800 border-l border-gray-700 flex flex-col flex-shrink-0 ${showRightPanel ? 'show' : ''}`}>
            <div className="p-3 sm:p-4 border-b border-gray-700">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base sm:text-lg font-semibold text-gray-100">Configuration</h2>
                  <p className="text-xs sm:text-sm text-gray-400">Select code engines and configure generation settings</p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowRightPanel(false)}
                  className="md:hidden text-gray-400 hover:text-gray-200"
                >
                  <X className="w-5 h-5" />
                </Button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto">
              {/* Subscription Status */}
              <div className="p-3 sm:p-4" data-tour="subscription-status">
                <SubscriptionStatus onUpgrade={() => uiActions.openModal('upgrade')} />
              </div>
              <div className="border-t border-gray-700" data-tour="voice-selector">
                <PerspectiveSelector />
              </div>
            </div>
          </div>
        </>
      )}

      {/* Modals */}
      <SolutionStack
        isOpen={showSolutionStack}
        onClose={() => setShowSolutionStack(false)}
        sessionId={currentSessionId}
        onMergeClick={handleMergeClick}
        data-tour="solution-stack"
      />

      <SynthesisPanel
        isOpen={showSynthesisPanel}
        onClose={() => setShowSynthesisPanel(false)}
        solutions={currentSolutions}
        sessionId={currentSessionId || 0}
        data-tour="synthesis-button"
      />

      {panels.projects && (
        <ProjectsPanel
          isOpen={panels.projects}
          onClose={() => {
            console.log("🎯 Projects panel closing");
            uiActions.togglePanel('projects');
          }}
          onUseAsContext={(project) => {
            setProjectContext(project);
            setPrompt(`Using project "${project.name}" as context:\n\n${project.description || 'No description provided'}\n\n`);
          }}
          data-tour="save-project"
        />
      )}

      <AvatarCustomizer
        isOpen={modals.avatarCustomizer}
        onClose={() => {
          uiActions.closeModal('avatarCustomizer');
          setEditingProfile(null);
        }}
        editingProfile={editingProfile}
      />

      <ChatGPTStyleGeneration
        isOpen={showChatGPTGeneration}
        onClose={() => setShowChatGPTGeneration(false)}
        prompt={prompt}
        selectedVoices={{
          perspectives: perspectives,
          roles: roles
        }}
        onComplete={(sessionId) => {
          setCurrentSessionId(sessionId);
          setShowSolutionStack(true);
        }}
      />

      {panels.analytics && (
        <AnalyticsPanel
          isOpen={panels.analytics}
          onClose={() => {
            console.log("📊 Analytics panel closing");
            uiActions.togglePanel('analytics');
          }}
        />
      )}

      {panels.teams && (
        <TeamsPanel
          isOpen={panels.teams}
          onClose={() => {
            console.log("👥 Teams panel closing");
            uiActions.togglePanel('teams');
          }}
        />
      )}

      {/* Enhanced Projects Panel with Context-Aware Features */}
      <EnhancedProjectsPanel
        isOpen={panels.projects}
        onClose={() => uiActions.togglePanel('projects')}
        onUseAsContext={handleUseAsContext}
        selectedContextProjects={selectedContextProjects}
      />




      <UpgradeModal
        isOpen={modals.upgrade}
        onClose={() => uiActions.closeModal('upgrade')}
        trigger="manual"
        currentQuota={planGuard.quotaUsed}
        quotaLimit={planGuard.quotaLimit}
      />
      
      <ErrorMonitor 
        isOpen={showErrorMonitor} 
        onClose={() => setShowErrorMonitor(false)} 
      />

      {/* Voice Profile Tutorial */}
      {showVoiceProfileTutorial && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="max-w-6xl w-full max-h-[90vh] overflow-auto">
            <VoiceProfileTutorial
              onComplete={() => {
                setShowVoiceProfileTutorial(false);
                toast({
                  title: "Voice Profile Tutorial Complete!",
                  description: "Ready to create your custom AI assistant? Click Voice Profiles to get started.",
                });
              }}
              onSkip={() => {
                setShowVoiceProfileTutorial(false);
                toast({
                  title: "Tutorial skipped",
                  description: "You can access this tutorial anytime from the Learning button.",
                });
              }}
            />
          </div>
        </div>
      )}

      {/* Enhanced Onboarding Tour for New Users */}
      <OnboardingTour
        isActive={shouldShowTour}
        onComplete={() => {
          completeTour.mutate();
          trackMilestone.mutate({ type: 'first_solution' });
        }}
        onSkip={() => {
          skipTour.mutate();
        }}
      />
    </div>
    </>
  );
}
