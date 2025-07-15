import { useState } from "react";
import { ModernSidebar } from "./ModernSidebar";
import { ModernMainContent } from "./ModernMainContent";
import { ModernSolutionStack } from "./ModernSolutionStack";
import { ChatGPTStyleGeneration } from "../chatgpt-style-generation";
import { SynthesisPanel } from "../synthesis-panel";
import { AnalyticsPanel } from "../analytics-panel";
import { TeamsPanel } from "../teams-panel";
import { AvatarCustomizer } from "../avatar-customizer";
import { cn } from "@/lib/utils";
import type { Project, Solution } from "@shared/schema";
import { useSolutionGeneration } from "@/hooks/use-solution-generation";
import { useStreamingGeneration } from "@/hooks/useStreamingGeneration";

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

  // Hooks
  const { mutate: generateSolution, isPending: isGenerating } = useSolutionGeneration({
    onSuccess: (data) => {
      setCurrentSessionId(data.sessionId);
      setSolutions(data.solutions || []);
      setShowSolutionStack(true);
    }
  });

  const { startStreaming, isStreaming } = useStreamingGeneration({
    onComplete: (sessionId, solutions) => {
      setCurrentSessionId(sessionId);
      setSolutions(solutions);
      setShowStreamingGeneration(false);
      setShowSolutionStack(true);
    }
  });

  const handleGenerate = (prompt: string) => {
    generateSolution({ 
      prompt,
      selectedVoices: {
        perspectives: ['explorer'], // Default selection
        roles: ['architect']
      }
    });
  };

  const handleStreamingGenerate = (prompt: string) => {
    startStreaming(prompt, {
      perspectives: ['explorer'],
      roles: ['architect']
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
    <div className={cn("flex h-screen bg-white dark:bg-gray-950", className)}>
      {/* Left Sidebar */}
      <div className="w-80 flex-shrink-0">
        <ModernSidebar
          onProjectSelect={handleProjectSelect}
          onNewChat={handleNewChat}
          onNavigate={handleNavigate}
        />
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <ModernMainContent
          onGenerate={handleGenerate}
          onStreamingGenerate={handleStreamingGenerate}
        />
      </div>

      {/* Modals and Panels */}
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