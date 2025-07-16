import { useState } from "react";
import { ModernSidebar } from "./ModernSidebar";
import { ModernMainContent } from "./ModernMainContent";
import { ModernSolutionStack } from "./ModernSolutionStack";
import { ChatGPTStyleGeneration } from "@/components/chatgpt-style-generation";
import { SynthesisPanel } from "@/components/synthesis-panel";
import { AnalyticsPanel } from "@/components/analytics-panel";
import { TeamsPanel } from "@/components/teams-panel";
import { AvatarCustomizer } from "@/components/avatar-customizer";
import { EnhancedProjectsPanel } from "@/components/enhanced-projects-panel";
import UpgradeModal from "@/components/UpgradeModal";
import OnboardingPage from "@/pages/onboarding";
import { cn } from "@/lib/utils";
import type { Project, Solution } from "@shared/schema";
import { useSolutionGeneration } from "@/hooks/use-solution-generation";
import { useVoiceSelection } from "@/contexts/voice-selection-context";
import { usePlanGuard } from "@/hooks/usePlanGuard";
import { useLocation } from "wouter";

interface ModernLayoutProps {
  className?: string;
  onNavigate?: (section: string) => void;
  onGenerate?: () => void;
  onStreamingGenerate?: () => void;
  onSolutionsGenerated?: (sessionId: number) => void;
  onSynthesize?: (solutions: any[]) => void;
  onUseProjectContext?: (projects: any[]) => void;
}

export function ModernLayout({ 
  className, 
  onNavigate, 
  onGenerate, 
  onStreamingGenerate, 
  onSolutionsGenerated, 
  onSynthesize, 
  onUseProjectContext 
}: ModernLayoutProps) {
  // Panel states
  const [showSolutionStack, setShowSolutionStack] = useState(false);
  const [showStreamingGeneration, setShowStreamingGeneration] = useState(false);
  const [showSynthesisPanel, setShowSynthesisPanel] = useState(false);
  const [showAnalyticsPanel, setShowAnalyticsPanel] = useState(false);
  const [showTeamsPanel, setShowTeamsPanel] = useState(false);
  const [showVoiceProfilesPanel, setShowVoiceProfilesPanel] = useState(false);
  const [showProjectsPanel, setShowProjectsPanel] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [showLearningSection, setShowLearningSection] = useState(false);

  // Data states
  const [currentSessionId, setCurrentSessionId] = useState<number | null>(null);
  const [solutions, setSolutions] = useState<Solution[]>([]);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [selectedContextProjects, setSelectedContextProjects] = useState<Project[]>([]);

  // Backend integration
  const { state } = useVoiceSelection();
  const planGuard = usePlanGuard();
  const { generateSession } = useSolutionGeneration();
  const [, setLocation] = useLocation();

  const handleGenerate = async () => {
    // Use parent callback if provided, otherwise use internal logic
    if (onGenerate) {
      onGenerate();
      return;
    }

    // Fallback to internal generation logic
    if (!planGuard.canGenerate) {
      console.warn('Generation blocked by plan guard:', planGuard);
      return;
    }

    if (!state.prompt.trim()) {
      console.warn('Empty prompt detected');
      return;
    }

    if (state.selectedPerspectives.length === 0 && state.selectedRoles.length === 0) {
      console.warn('No voices selected for generation');
      return;
    }

    try {
      const result = await planGuard.attemptGeneration(async () => {
        return generateSession.mutateAsync({
          prompt: state.prompt,
          selectedVoices: {
            perspectives: state.selectedPerspectives,
            roles: state.selectedRoles
          },
          recursionDepth: 2,
          synthesisMode: "competitive",
          ethicalFiltering: true
        });
      });

      if (result.success && result.data?.session?.id) {
        console.log('✅ Council Generation Success:', result.data.session.id);
        setCurrentSessionId(result.data.session.id);
        setSolutions(result.data.solutions || []);
        setShowSolutionStack(true);
        
        // Notify parent if callback provided
        if (onSolutionsGenerated) {
          onSolutionsGenerated(result.data.session.id);
        }
      }
    } catch (error) {
      console.error('Council Generation failed:', error);
    }
  };

  const handleStreamingGenerate = () => {
    // Use parent callback if provided, otherwise use internal logic
    if (onStreamingGenerate) {
      onStreamingGenerate();
      return;
    }

    // Fallback to internal streaming logic
    if (!planGuard.canGenerate) {
      console.warn('Streaming generation blocked by plan guard:', planGuard);
      return;
    }

    if (!state.prompt.trim()) {
      console.warn('Empty prompt detected for streaming');
      return;
    }

    if (state.selectedPerspectives.length === 0 && state.selectedRoles.length === 0) {
      console.warn('No voices selected for streaming generation');
      return;
    }

    console.log('🔥 Starting Live Streaming Generation with voices:', {
      perspectives: state.selectedPerspectives,
      roles: state.selectedRoles,
      prompt: state.prompt.substring(0, 100) + '...'
    });
    
    setShowStreamingGeneration(true);
  };

  const handleNewChat = () => {
    // Reset states for new session
    setCurrentSessionId(null);
    setSolutions([]);
    setSelectedProject(null);
    setSelectedContextProjects([]);
    setShowSolutionStack(false);
    setShowStreamingGeneration(false);
    setShowSynthesisPanel(false);
    setShowLearningSection(false);
    setShowProjectsPanel(false);
    setShowUpgradeModal(false);
  };

  const handleProjectSelect = (project: Project) => {
    setSelectedProject(project);
    
    // Use parent callback if provided for project context
    if (onUseProjectContext) {
      onUseProjectContext([project]);
    }
  };

  const handleUseProjectContext = (projects: Project[]) => {
    setSelectedContextProjects(projects);
    
    // Use parent callback if provided for project context
    if (onUseProjectContext) {
      onUseProjectContext(projects);
    }
  };

  const handleNavigate = (section: string) => {
    // Use parent callback if provided, otherwise use internal logic
    if (onNavigate) {
      onNavigate(section);
      return;
    }

    // Fallback to internal navigation logic
    setShowAnalyticsPanel(false);
    setShowTeamsPanel(false);
    setShowVoiceProfilesPanel(false);
    setShowProjectsPanel(false);
    setShowUpgradeModal(false);
    setShowLearningSection(false);

    switch (section) {
      case 'analytics':
        setShowAnalyticsPanel(true);
        break;
      case 'teams':
        setShowTeamsPanel(true);
        break;
      case 'voice-profiles':
        setShowVoiceProfilesPanel(true);
        break;
      case 'projects':
        setShowProjectsPanel(true);
        break;
      case 'premium':
        setShowUpgradeModal(true);
        break;
      case 'learning':
        setShowLearningSection(true);
        break;
    }
  };

  const handleSynthesize = () => {
    // Use parent callback if provided, otherwise use internal logic
    if (onSynthesize) {
      onSynthesize(solutions);
      return;
    }

    // Fallback to internal synthesis logic
    if (currentSessionId) {
      setShowSolutionStack(false);
      setShowSynthesisPanel(true);
    }
  };

  // Handle different view modes
  if (showLearningSection) {
    return (
      <div className={cn("h-screen bg-gray-950", className)}>
        <OnboardingPage />
      </div>
    );
  }

  return (
    <div className={cn("flex h-screen bg-gray-950", className)}>
      {/* Left Sidebar - Enlarged width to match ChatGPT style */}
      <div className="w-[280px] flex-shrink-0 bg-gray-900 border-r border-gray-800">
        <ModernSidebar
          onProjectSelect={handleProjectSelect}
          onNewChat={handleNewChat}
          onNavigate={handleNavigate}
        />
      </div>

      {/* Main Content Area - Dark theme matching reference */}
      <div className="flex-1 flex flex-col min-w-0 bg-gray-950">
        <ModernMainContent
          onGenerate={handleGenerate}
          onStreamingGenerate={handleStreamingGenerate}
        />
      </div>

      {/* Production-ready panels with proper integration */}
      {showSolutionStack && currentSessionId && (
        <ModernSolutionStack
          isOpen={showSolutionStack}
          onClose={() => setShowSolutionStack(false)}
          sessionId={currentSessionId}
          solutions={solutions}
          onSynthesize={handleSynthesize}
        />
      )}

      {showStreamingGeneration && (
        <ChatGPTStyleGeneration
          isOpen={showStreamingGeneration}
          onClose={() => setShowStreamingGeneration(false)}
          prompt={state.prompt}
          selectedVoices={{
            perspectives: state.selectedPerspectives,
            roles: state.selectedRoles
          }}
        />
      )}

      {showSynthesisPanel && currentSessionId && (
        <SynthesisPanel
          isOpen={showSynthesisPanel}
          onClose={() => setShowSynthesisPanel(false)}
          sessionId={currentSessionId}
        />
      )}

      {showAnalyticsPanel && (
        <AnalyticsPanel
          isOpen={showAnalyticsPanel}
          onClose={() => setShowAnalyticsPanel(false)}
        />
      )}

      {showTeamsPanel && (
        <TeamsPanel
          isOpen={showTeamsPanel}
          onClose={() => setShowTeamsPanel(false)}
        />
      )}

      {showVoiceProfilesPanel && (
        <AvatarCustomizer
          isOpen={showVoiceProfilesPanel}
          onClose={() => setShowVoiceProfilesPanel(false)}
        />
      )}

      {showProjectsPanel && (
        <EnhancedProjectsPanel
          isOpen={showProjectsPanel}
          onClose={() => setShowProjectsPanel(false)}
          onUseAsContext={handleUseProjectContext}
          selectedContextProjects={selectedContextProjects}
        />
      )}

      {showUpgradeModal && (
        <UpgradeModal
          isOpen={showUpgradeModal}
          onClose={() => setShowUpgradeModal(false)}
        />
      )}
    </div>
  );
}