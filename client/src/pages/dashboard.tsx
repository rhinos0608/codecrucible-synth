import { useState } from "react";
import { Terminal, Play, Settings, FolderOpen, User, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PerspectiveSelector } from "@/components/voice-selector";
import { SolutionStack } from "@/components/solution-stack";
import { SynthesisPanel } from "@/components/synthesis-panel";
import { ProjectsPanel } from "@/components/projects-panel";
import { AvatarCustomizer } from "@/components/avatar-customizer";
import { useSolutionGeneration } from "@/hooks/use-solution-generation";
import { useAuth } from "@/hooks/useAuth";
import { useVoiceProfiles } from "@/hooks/use-voice-profiles";
import { QUICK_PROMPTS } from "@/types/voices";
import type { Solution, VoiceProfile } from "@shared/schema";
import { useVoiceSelection } from "@/contexts/voice-selection-context";

export default function Dashboard() {
  const [showSolutionStack, setShowSolutionStack] = useState(false);
  const [showSynthesisPanel, setShowSynthesisPanel] = useState(false);
  const [showProjectsPanel, setShowProjectsPanel] = useState(false);
  const [showAvatarCustomizer, setShowAvatarCustomizer] = useState(false);
  const [editingProfile, setEditingProfile] = useState<VoiceProfile | null>(null);
  const [currentSessionId, setCurrentSessionId] = useState<number | null>(null);
  const [currentSolutions, setCurrentSolutions] = useState<Solution[]>([]);
  const [showRightPanel, setShowRightPanel] = useState(true);

  const { user } = useAuth();
  const { profiles } = useVoiceProfiles();
  
  const { 
    state, 
    setPrompt, 
    getActiveCount,
    getSelectedItems
  } = useVoiceSelection();
  
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
    // Validation following AI_INSTRUCTIONS.md security patterns
    console.log("Voice Selection Debug:", {
      perspectives: state.selectedPerspectives,
      roles: state.selectedRoles,
      prompt: state.prompt.substring(0, 50) + "...",
      perspectiveCount: state.selectedPerspectives.length,
      roleCount: state.selectedRoles.length
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
      console.error("API Error: Failed to generate solutions:", error);
      // Error handling according to AI_INSTRUCTIONS.md patterns
      if (error instanceof Error) {
        console.error("Error details:", error.message);
      }
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
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowAvatarCustomizer(true)}
                className="text-purple-300 hover:text-purple-100 border-purple-600"
              >
                <User className="w-4 h-4 mr-2" />
                Voice Profiles
              </Button>
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
                size="sm"
                onClick={() => window.location.href = '/api/logout'}
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
                  disabled={isGenerating || !state.prompt.trim() || (state.selectedPerspectives.length === 0 && state.selectedRoles.length === 0)}
                  className="bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Play className="w-4 h-4 mr-2" />
                  {isGenerating ? "Generating..." : "Generate Solutions"}
                </Button>
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

      <AvatarCustomizer
        isOpen={showAvatarCustomizer}
        onClose={() => {
          setShowAvatarCustomizer(false);
          setEditingProfile(null);
        }}
        editingProfile={editingProfile}
      />
    </div>
  );
}
