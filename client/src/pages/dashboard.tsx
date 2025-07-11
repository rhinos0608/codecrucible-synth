import { useState } from "react";
import { Terminal, Play, Settings, FolderOpen, User, LogOut, BarChart3, Users } from "lucide-react";
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
import { useVoiceRecommendations } from "@/hooks/use-voice-recommendations";
import { QUICK_PROMPTS } from "@/types/voices";
import type { Solution, VoiceProfile } from "@shared/schema";
import { useVoiceSelection } from "@/contexts/voice-selection-context";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { SubscriptionStatus } from "@/components/subscription/subscription-status";

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
  const { recommendations, isAnalyzing, analyzePrompt } = useVoiceRecommendations();
  
  const { 
    state, 
    setPrompt, 
    getActiveCount,
    getSelectedItems,
    selectPerspectives,
    selectRoles
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

  const handlePromptChange = (newPrompt: string) => {
    setPrompt(newPrompt);
    // Trigger voice recommendations when prompt changes
    if (newPrompt.trim().length > 10) {
      analyzePrompt(newPrompt);
    }
  };

  const trackRecommendation = useMutation({
    mutationFn: async (data: { sessionId: number; recommendedVoices: string[]; action: 'applied' | 'rejected' }) => {
      await apiRequest(`/api/analytics/recommendations/${data.action}`, {
        method: 'POST',
        body: JSON.stringify({
          sessionId: data.sessionId,
          recommendedVoices: data.recommendedVoices
        })
      });
    }
  });

  const handleApplyRecommendations = () => {
    if (recommendations?.suggested && sessionResponse?.session?.id) {
      selectPerspectives(recommendations.suggested.perspectives);
      selectRoles(recommendations.suggested.roles);
      
      // Track analytics event
      trackRecommendation.mutate({
        sessionId: sessionResponse.session.id,
        recommendedVoices: [
          ...recommendations.suggested.perspectives,
          ...recommendations.suggested.roles
        ],
        action: 'applied'
      });
    }
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
    handlePromptChange(prompt);
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
                <p className="text-sm text-gray-400">Multi-Engine AI Code Generator</p>
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
                variant="outline"
                size="sm"
                onClick={() => window.location.href = '/analytics'}
                className="text-green-300 hover:text-green-100 border-green-600"
              >
                <BarChart3 className="w-4 h-4 mr-2" />
                Analytics
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.location.href = '/teams'}
                className="text-blue-300 hover:text-blue-100 border-blue-600"
              >
                <Users className="w-4 h-4 mr-2" />
                Teams
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

          {/* Voice Recommendations */}
          {recommendations && (
            <Card className="bg-gradient-to-r from-purple-900/20 to-blue-900/20 border-purple-500/30">
              <div className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-medium text-purple-200">Smart Voice Recommendations</h3>
                  <Badge variant="secondary" className="bg-purple-800/50 text-purple-200">
                    {Math.round(recommendations.suggested.confidence * 100)}% confidence
                  </Badge>
                </div>
                <p className="text-sm text-gray-300 mb-3">
                  {recommendations.suggested.reasoning}
                </p>
                <div className="flex items-center justify-between">
                  <div className="flex flex-wrap gap-2">
                    {recommendations.suggested.perspectives.map(p => (
                      <Badge key={p} variant="outline" className="border-purple-500/50 text-purple-200">
                        {p}
                      </Badge>
                    ))}
                    {recommendations.suggested.roles.map(r => (
                      <Badge key={r} variant="outline" className="border-blue-500/50 text-blue-200">
                        {r}
                      </Badge>
                    ))}
                  </div>
                  <Button 
                    size="sm" 
                    onClick={handleApplyRecommendations}
                    className="bg-purple-600 hover:bg-purple-700 text-white"
                  >
                    Apply Suggestions
                  </Button>
                </div>
              </div>
            </Card>
          )}

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
