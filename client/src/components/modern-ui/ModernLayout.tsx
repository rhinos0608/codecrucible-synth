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
    if (!planGuard.canGenerate) {
      // Show upgrade modal or toast
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
        setCurrentSessionId(result.data.session.id);
        setShowSolutionStack(true);
      }
    } catch (error) {
      console.error('Generation failed:', error);
    }
  };

  const handleStreamingGenerate = () => {
    if (!planGuard.canGenerate) {
      return;
    }
    
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

      {/* Modals and Panels - Temporarily simplified for layout testing */}
      {showSolutionStack && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-900 rounded-lg p-6 max-w-2xl w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">Generated Solutions</h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">Solutions generated successfully!</p>
            <button 
              onClick={() => setShowSolutionStack(false)}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {showStreamingGeneration && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-900 rounded-lg p-6 max-w-2xl w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">Live Streaming Generation</h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">Streaming code generation in progress...</p>
            <button 
              onClick={() => setShowStreamingGeneration(false)}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}