import { useEffect, useState } from "react";
import { X, Layers3, CheckCircle, Loader2, MessageCircle } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import type { Solution } from "@shared/schema";
import { CODE_PERSPECTIVES, DEVELOPMENT_ROLES } from "@/types/voices";
import { PostGenerationDecision } from "./post-generation-decision";
import { AiChatInterface } from "./ai-chat-interface";

interface ImplementationOptionsProps {
  isOpen: boolean;
  onClose: () => void;
  sessionId: number | null;
  onMergeClick: (solutions: Solution[]) => void;
}

// Map voice combination IDs to display names following AI_INSTRUCTIONS.md patterns
const getVoiceDisplayName = (voiceCombination: string | undefined): string => {
  // Defensive programming: handle undefined/null voiceCombination - Jung's Descent Protocol
  if (!voiceCombination) {
    console.warn('🔧 Voice Council Assembly: Undefined voice combination detected, using fallback name');
    return 'Unknown Voice Engine';
  }
  
  // Enhanced voice name mapping following AI_INSTRUCTIONS.md patterns
  
  // Handle colon-separated format (e.g., "perspective:seeker" -> "Explorer")
  if (voiceCombination.includes(':')) {
    const [type, voiceId] = voiceCombination.split(':');
    if (type === 'perspective') {
      const perspective = CODE_PERSPECTIVES.find(p => p.id === voiceId);
      if (perspective) return perspective.name;
    }
    if (type === 'role') {
      const role = DEVELOPMENT_ROLES.find(r => r.id === voiceId);
      if (role) return role.name;
    }
  }
  
  // Handle perspective-prefixed voices (e.g., "perspective-seeker" -> "Explorer")
  if (voiceCombination && voiceCombination.startsWith('perspective-')) {
    const perspectiveId = voiceCombination.replace('perspective-', '');
    const perspective = CODE_PERSPECTIVES.find(p => p.id === perspectiveId);
    if (perspective) return perspective.name;
  }
  
  // Handle role-prefixed voices (e.g., "role-architect" -> "Systems Architect")
  if (voiceCombination && voiceCombination.startsWith('role-')) {
    const roleId = voiceCombination.replace('role-', '');
    const role = DEVELOPMENT_ROLES.find(r => r.id === roleId);
    if (role) return role.name;
  }
  
  // Handle single voice cases (direct ID mapping)
  const perspective = CODE_PERSPECTIVES.find(p => p.id === voiceCombination);
  if (perspective) return perspective.name;
  
  const role = DEVELOPMENT_ROLES.find(r => r.id === voiceCombination);
  if (role) return role.name;
  
  // Handle combined voice cases (perspective-role or perspective+role) - Alexander's Pattern Language
  const combinationParts = voiceCombination ? voiceCombination.split(/[-+]/) : [];
  if (combinationParts.length === 2) {
    const [part1, part2] = combinationParts;
    
    // Remove any prefixes and find the actual voice
    const cleanPart1 = part1.replace(/^(perspective|role)-/, '');
    const cleanPart2 = part2.replace(/^(perspective|role)-/, '');
    
    const perspective1 = CODE_PERSPECTIVES.find(p => p.id === cleanPart1);
    const role1 = DEVELOPMENT_ROLES.find(r => r.id === cleanPart1);
    const perspective2 = CODE_PERSPECTIVES.find(p => p.id === cleanPart2);
    const role2 = DEVELOPMENT_ROLES.find(r => r.id === cleanPart2);
    
    const name1 = perspective1?.name || role1?.name || cleanPart1;
    const name2 = perspective2?.name || role2?.name || cleanPart2;
    
    return `${name1} + ${name2}`;
  }
  
  // Fallback: return original if no mapping found - Consciousness-driven resilience
  return voiceCombination || 'Voice Engine';
};

export function SolutionStack({ isOpen, onClose, sessionId, onMergeClick }: ImplementationOptionsProps) {
  // State for post-generation decision modal and chat interface - Following AI_INSTRUCTIONS.md patterns
  const [showPostGenDecision, setShowPostGenDecision] = useState(false);
  const [showChatInterface, setShowChatInterface] = useState(false);
  const [selectedSolution, setSelectedSolution] = useState<Solution | null>(null);

  const { data: solutions = [], isLoading, error } = useQuery({
    queryKey: ["/api/sessions", sessionId, "solutions"],
    enabled: !!sessionId && isOpen,
    retry: 3,
    retryDelay: 1000,
  });

  // Enhanced debug logging following AI_INSTRUCTIONS.md patterns
  useEffect(() => {
    if (isOpen && sessionId) {
      console.log('SolutionStack Debug:', {
        sessionId,
        isOpen,
        isLoading,
        solutionCount: solutions?.length || 0,
        solutions: solutions?.map(s => ({ 
          id: s.id, 
          voiceEngine: s.voiceEngine,
          voiceName: s.voiceName,
          voiceCombination: s.voiceCombination || 'N/A'
        })) || [],
        error: error?.message || null,
        rawError: error
      });
      
      // Enhanced error tracking for HTML responses
      if (error?.message?.includes('Unexpected token')) {
        console.error('🔴 JSON Parsing Error - Likely receiving HTML instead of JSON:', {
          errorMessage: error.message,
          sessionId: sessionId,
          endpoint: `/api/sessions/${sessionId}/solutions`,
          suggestion: 'Check if endpoint returns proper JSON'
        });
      }
    }
  }, [isOpen, sessionId, isLoading, solutions, error]);

  // Enhanced modal state management following Jung's Descent Protocol and Alexander's Pattern Language
  useEffect(() => {
    // Modal transition logic with consciousness-driven flow control
    if (solutions.length > 0 && !isLoading && !isOpen) {
      console.log('📋 Council Assembly: Managing modal transition for', solutions.length, 'solutions');
      
      // Prevent modal conflicts using Living Spiral methodology
      const shouldShowPostGenDecision = !showPostGenDecision && !showChatInterface;
      
      if (shouldShowPostGenDecision) {
        // Delayed activation to prevent race conditions - Defensive programming
        const modalTransitionTimer = setTimeout(() => {
          console.log('🌀 Living Spiral: Activating post-generation decision modal');
          setShowPostGenDecision(true);
        }, 200); // Extended delay for consciousness-aware transitions
        
        return () => clearTimeout(modalTransitionTimer);
      }
    }
  }, [solutions.length, isLoading, isOpen, showPostGenDecision, showChatInterface]);

  const handleMergeClick = () => {
    onMergeClick(solutions);
    setShowPostGenDecision(false);
    onClose();
  };

  // Handle post-generation decision modal close - close both modals
  const handlePostGenDecisionClose = () => {
    console.log('🔄 Closing post-generation decision modal');
    setShowPostGenDecision(false);
    setShowChatInterface(false);
    setSelectedSolution(null);
    // Clean reset of all modal states
  };

  // Handle voice selection for chat - Alexander's Pattern Language for consistent interaction patterns
  const handleContinueWithVoice = (solution: Solution) => {
    console.log('🧠 Starting chat with', getVoiceDisplayName(solution.voiceCombination || solution.voiceEngine || solution.voiceName));
    setSelectedSolution(solution);
    setShowPostGenDecision(false);
    setShowChatInterface(true);
  };

  // Handle synthesis from post-generation decision modal
  const handleSynthesizeAll = () => {
    console.log('🔧 User chose to synthesize all solutions');
    handleMergeClick();
  };

  // Handle chat interface close - return to post-generation decision
  const handleChatClose = () => {
    console.log('💬 Closing chat interface');
    setShowChatInterface(false);
    setSelectedSolution(null);
    setShowPostGenDecision(true);
  };

  return (
    <>
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <div>
              <h3 className="text-xl font-semibold">Implementation Options</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">Multi-perspective code generation results</p>
            </div>
          </DialogTitle>
          <DialogDescription className="text-gray-500 dark:text-gray-400">
            Review solutions generated by different AI voice perspectives and choose the best implementation
          </DialogDescription>
        </DialogHeader>

        <div className="overflow-y-auto max-h-[calc(90vh-120px)] p-1" style={{ scrollbarWidth: 'thin' }}>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
              <span className="ml-2 text-gray-400">Generating solutions...</span>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center py-8">
              <div className="text-center">
                <p className="text-red-500 mb-2">Error loading solutions</p>
                <p className="text-sm text-gray-400">{error.message}</p>
              </div>
            </div>
          ) : solutions.length === 0 ? (
            <div className="flex items-center justify-center py-8">
              <div className="text-center">
                <p className="text-gray-400 mb-2">No solutions found</p>
                <p className="text-sm text-gray-500">Session ID: {sessionId}</p>
              </div>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                {solutions.map((solution, index) => (
                  <Card key={solution.id || `solution-${index}-${solution.voiceCombination || 'unknown'}`} className={`border border-steward/20 rounded-lg overflow-hidden`}>
                    <div className="bg-steward/10 p-4 border-b border-steward/20">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <div className="flex -space-x-1">
                            <div className="w-8 h-8 bg-steward rounded-full border-2 border-gray-800 flex items-center justify-center">
                              <CheckCircle className="w-4 h-4 text-gray-100" />
                            </div>
                          </div>
                          <div>
                            <h4 className="font-semibold text-steward">{getVoiceDisplayName(solution.voiceCombination || solution.voiceEngine || solution.voiceName)}</h4>
                            <p className="text-xs text-gray-400">{solution.explanation}</p>
                          </div>
                        </div>
                        <Badge variant="secondary" className="bg-steward/20 text-steward">
                          {solution.confidence}% Confidence
                        </Badge>
                      </div>
                    </div>
                    
                    <div className="p-4">
                      <div className="mb-4">
                        <h5 className="text-sm font-medium mb-2">Generated Code</h5>
                        <div className="bg-gray-800 rounded-lg p-3 text-xs font-mono text-gray-100 overflow-x-auto max-h-64 overflow-y-auto">
                          <pre className="whitespace-pre-wrap break-words">{solution.code || "No code generated"}</pre>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4 text-xs">
                        <div>
                          <h6 className="font-medium text-gray-300 mb-1">Voice Engine</h6>
                          <p className="text-gray-400 text-xs">{solution.voiceEngine || solution.voiceName || 'Unknown Engine'}</p>
                        </div>
                        <div>
                          <h6 className="font-medium text-gray-300 mb-1">Solution Type</h6>
                          <p className="text-gray-400 text-xs">Code Analysis & Generation</p>
                        </div>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>

              {solutions.length > 0 && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-gray-700/50 rounded-lg">
                    <div className="text-sm text-gray-400">
                      Ready to merge solutions into final implementation?
                    </div>
                    <Button 
                      className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white px-4 py-2 rounded-lg transition-all flex items-center space-x-2"
                      onClick={handleMergeClick}
                    >
                      <Layers3 className="w-4 h-4" />
                      <span>Synthesize Solutions</span>
                    </Button>
                  </div>
                  
                  <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                    <h6 className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-2">Next Steps</h6>
                    <ul className="text-xs text-blue-700 dark:text-blue-300 space-y-1">
                      <li>• Click "Synthesize Solutions" to merge all approaches with AI</li>
                      <li>• Review and edit the synthesized code</li>
                      <li>• Save the final solution to your Projects for future use</li>
                    </ul>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>

    {/* Post-Generation Decision Modal - Following CodingPhilosophy.md consciousness principles */}
    {showPostGenDecision && (
      <PostGenerationDecision
        isOpen={showPostGenDecision}
        onClose={handlePostGenDecisionClose}
        solutions={solutions}
        onContinueWithVoice={handleContinueWithVoice}
        onSynthesizeAll={handleSynthesizeAll}
      />
    )}

    {/* AI Chat Interface for continuing conversation with selected voice */}
    {showChatInterface && selectedSolution && sessionId && (
      <AiChatInterface
        isOpen={showChatInterface}
        onClose={handleChatClose}
        solution={selectedSolution}
        sessionId={sessionId}
      />
    )}
    </>
  );
}
