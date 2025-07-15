import { useState } from "react";
import { ModernSidebar } from "./ModernSidebar";
import { ModernMainContent } from "./ModernMainContent";
// Temporarily simplified imports for layout testing
// import { ModernSolutionStack } from "./ModernSolutionStack";
// import { ChatGPTStyleGeneration } from "../chatgpt-style-generation";
// import { SynthesisPanel } from "../synthesis-panel";
// import { AnalyticsPanel } from "../analytics-panel";
// import { TeamsPanel } from "../teams-panel";
// import { AvatarCustomizer } from "../avatar-customizer";
import { cn } from "@/lib/utils";
import type { Project, Solution } from "@shared/schema";
// import { useSolutionGeneration } from "@/hooks/use-solution-generation"; // Temporarily simplified
// Removed problematic import for now

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

  // Simplified for initial implementation
  const [isGenerating, setIsGenerating] = useState(false);

  // Simplified streaming hook usage
  const [isStreaming, setIsStreaming] = useState(false);

  const handleGenerate = (prompt: string) => {
    setIsGenerating(true);
    console.log('Generate:', prompt);
    // Simulate generation
    setTimeout(() => {
      setIsGenerating(false);
      setShowSolutionStack(true);
    }, 2000);
  };

  const handleStreamingGenerate = (prompt: string) => {
    setIsStreaming(true);
    setShowStreamingGeneration(true);
    // Integrate with existing streaming logic
    console.log('Streaming generation:', prompt);
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