import { useState } from "react";
import { ModernSidebar } from "./ModernSidebar";
import { ModernMainContent } from "./ModernMainContent";
import { ModernSolutionStack } from "./ModernSolutionStack";
import { ChatGPTStyleGeneration } from "@/components/chatgpt-style-generation";
import { SynthesisPanel } from "@/components/synthesis-panel";
import { AnalyticsPanel } from "@/components/analytics-panel";
import { TeamsPanel } from "@/components/teams-panel";
import { AvatarCustomizer } from "@/components/avatar-customizer";
import { cn } from "@/lib/utils";
import type { Project, Solution } from "@shared/schema";
import { useSolutionGeneration } from "@/hooks/use-solution-generation";
import { useVoiceSelection } from "@/contexts/voice-selection-context";
import { usePlanGuard } from "@/hooks/usePlanGuard";

interface ModernLayoutProps {
  className?: string;
}

export function ModernLayout({ className }: ModernLayoutProps) {
  // Panel states
  const [showSolutionStack, setShowSolutionStack] = useState(false);
  const [showStreamingGeneration, setShowStreamingGeneration] = useState(false);
  const [showSynthesisPanel, setShowSynthesisPanel] = useState(false);
  const [showAnalyticsPanel, setShowAnalyticsPanel] = useState(false);
  const [showTeamsPanel, setShowTeamsPanel] = useState(false);
  const [showVoiceProfilesPanel, setShowVoiceProfilesPanel] = useState(false);

  // Data states
  const [currentSessionId, setCurrentSessionId] = useState<number | null>(null);
  const [solutions, setSolutions] = useState<Solution[]>([]);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);

  // Backend integration
  const { state } = useVoiceSelection();
  const planGuard = usePlanGuard();
  const { generateSession } = useSolutionGeneration();

  const handleGenerate = async () => {
    // Defensive programming - validate state before proceeding
    if (!planGuard.canGenerate) {
      console.warn('Generation blocked by plan guard:', planGuard);
      return;
    }

    if (!state.prompt.trim()) {
      console.warn('Empty prompt detected');
      return;
    }

    // Multi-voice consciousness validation
    if (state.selectedPerspectives.length === 0 && state.selectedRoles.length === 0) {
      console.warn('No voices selected for generation');
      return;
    }

    try {
      console.log('🎯 Starting Council Generation with voices:', {
        perspectives: state.selectedPerspectives,
        roles: state.selectedRoles,
        prompt: state.prompt.substring(0, 100) + '...'
      });

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
      } else if (!result.success && result.reason === 'quota_exceeded') {
        console.warn('Quota exceeded, showing upgrade modal');
        // Show upgrade modal (implement in parent component)
      } else {
        console.error('Generation failed:', result);
      }
    } catch (error) {
      console.error('Council Generation failed:', error);
    }
  };

  const handleStreamingGenerate = () => {
    // Defensive programming - validate state before proceeding
    if (!planGuard.canGenerate) {
      console.warn('Streaming generation blocked by plan guard:', planGuard);
      return;
    }

    if (!state.prompt.trim()) {
      console.warn('Empty prompt detected for streaming');
      return;
    }

    // Multi-voice consciousness validation
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
    setShowSolutionStack(false);
    setShowStreamingGeneration(false);
    setShowSynthesisPanel(false);
  };

  const handleProjectSelect = (project: Project) => {
    setSelectedProject(project);
    // Could open project details or use as context
  };

  const handleNavigate = (section: string) => {
    // Close all panels first
    setShowAnalyticsPanel(false);
    setShowTeamsPanel(false);
    setShowVoiceProfilesPanel(false);

    // Open requested panel
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
    }
  };

  const handleSynthesize = () => {
    if (currentSessionId) {
      setShowSolutionStack(false);
      setShowSynthesisPanel(true);
    }
  };

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
    </div>
  );
}