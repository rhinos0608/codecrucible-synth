import { useState } from "react";
import { Terminal, Play, Settings, FolderOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PerspectiveSelector } from "@/components/voice-selector";
import { SolutionStack } from "@/components/solution-stack";
import { SynthesisPanel } from "@/components/synthesis-panel";
import { ProjectsPanel } from "@/components/projects-panel";
import { usePerspectiveSelection } from "@/hooks/use-voice-selection";
import { useSolutionGeneration } from "@/hooks/use-solution-generation";
import { QUICK_PROMPTS } from "@/types/voices";
import type { Solution } from "@shared/schema";

export default function Dashboard() {
  const [showSolutionStack, setShowSolutionStack] = useState(false);
  const [showSynthesisPanel, setShowSynthesisPanel] = useState(false);
  const [showProjectsPanel, setShowProjectsPanel] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState<number | null>(null);
  const [currentSolutions, setCurrentSolutions] = useState<Solution[]>([]);
  const [showRightPanel, setShowRightPanel] = useState(true);
  
  const { 
    state, 
    setPrompt, 
    getActiveCount,
    getSelectedItems
  } = usePerspectiveSelection();
  
  const { generateSession, isGenerating } = useSolutionGeneration();

  const handleSolutionsGenerated = (sessionId: number) => {
    setCurrentSessionId(sessionId);
    setShowSolutionStack(true);
  };

  const handleMergeClick = (solutions: Solution[]) => {
    setCurrentSolutions(solutions);
    setShowSynthesisPanel(true);
  };

  const handleGenerateSolutions = async () => {
    if (!state.prompt.trim() || state.selectedPerspectives.length === 0 || state.selectedRoles.length === 0) return;

    try {
      const result = await generateSession.mutateAsync({
        prompt: state.prompt,
        selectedVoices: {
          perspectives: state.selectedPerspectives,
          roles: state.selectedRoles
        },
        recursionDepth: state.analysisDepth,
        synthesisMode: state.mergeStrategy,
        ethicalFiltering: state.qualityFiltering
      });
      
      if (result?.session?.id) {
        handleSolutionsGenerated(result.session.id);
      }
    } catch (error) {
      console.error("Failed to generate solutions:", error);
    }
  };

  const handleQuickPrompt = (prompt: string) => {
    setPrompt(prompt);
  };

  return (
    <div className="min-h-screen flex bg-gray-900 text-gray-100">
      {/* Main Chat Interface */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <header className="bg-gray-800 border-b border-gray-700 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Terminal className="w-6 h-6 text-blue-400" />
              <div>
                <h1 className="text-xl font-semibold">CodeCrucible</h1>
                <p className="text-sm text-gray-400">Multi-Perspective AI Coding Assistant</p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <Badge variant="secondary" className="bg-blue-500/20 text-blue-300">
                {getActiveCount()} perspectives active
              </Badge>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowProjectsPanel(true)}
                className="text-gray-300 hover:text-gray-100 border-gray-600"
              >
                <FolderOpen className="w-4 h-4 mr-2" />
                Projects
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
          {/* Quick Prompts */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider">Quick Prompts</h3>
            <div className="grid grid-cols-1 gap-2">
              {QUICK_PROMPTS.slice(0, 4).map((prompt, index) => (
                <Button
                  key={index}
                  variant="ghost"
                  className="text-left justify-start p-3 h-auto bg-gray-800/50 hover:bg-gray-700/50 text-gray-300 hover:text-gray-100 border border-gray-700"
                  onClick={() => handleQuickPrompt(prompt)}
                >
                  <div className="text-sm">{prompt}</div>
                </Button>
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
                  onChange={(e) => setPrompt(e.target.value)}
                  className="min-h-[120px] bg-transparent border-none resize-none text-gray-100 placeholder-gray-500 focus:ring-0"
                />
              </div>
              <div className="border-t border-gray-700 p-4 flex items-center justify-between">
                <div className="text-sm text-gray-400">
                  {state.prompt.length > 0 ? `${state.prompt.length} characters` : "Start typing your request..."}
                </div>
                <Button
                  onClick={handleGenerateSolutions}
                  disabled={isGenerating || !state.prompt.trim() || state.selectedPerspectives.length === 0 || state.selectedRoles.length === 0}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  <Play className="w-4 h-4 mr-2" />
                  {isGenerating ? "Generating..." : "Generate Solutions"}
                </Button>
              </div>
            </Card>
          </div>
        </div>
      </div>

      {/* Right Panel */}
      {showRightPanel && (
        <div className="w-96 bg-gray-800 border-l border-gray-700 flex flex-col">
          <div className="p-4 border-b border-gray-700">
            <h2 className="text-lg font-semibold text-gray-100">Configuration</h2>
            <p className="text-sm text-gray-400">Select perspectives and configure generation settings</p>
          </div>
          <div className="flex-1 overflow-y-auto">
            <PerspectiveSelector />
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
      />
    </div>
  );
}
