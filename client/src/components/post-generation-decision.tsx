import { MessageCircle, Layers3, Brain, Zap } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Solution } from "@shared/schema";
import { CODE_PERSPECTIVES, DEVELOPMENT_ROLES } from "@/types/voices";

interface PostGenerationDecisionProps {
  isOpen: boolean;
  onClose: () => void;
  solutions: Solution[];
  onContinueWithVoice: (solution: Solution) => void;
  onSynthesizeAll: () => void;
}

// Map voice combination to display name following AI_INSTRUCTIONS.md patterns
const getVoiceDisplayName = (voiceCombination: string | undefined): string => {
  if (!voiceCombination) return 'Unknown Voice Engine';
  
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
  if (voiceCombination.startsWith('perspective-')) {
    const perspectiveId = voiceCombination.replace('perspective-', '');
    const perspective = CODE_PERSPECTIVES.find(p => p.id === perspectiveId);
    if (perspective) return perspective.name;
  }
  
  // Handle role-prefixed voices (e.g., "role-architect" -> "Systems Architect")
  if (voiceCombination.startsWith('role-')) {
    const roleId = voiceCombination.replace('role-', '');
    const role = DEVELOPMENT_ROLES.find(r => r.id === roleId);
    if (role) return role.name;
  }
  
  // Direct ID mapping
  const perspective = CODE_PERSPECTIVES.find(p => p.id === voiceCombination);
  if (perspective) return perspective.name;
  
  const role = DEVELOPMENT_ROLES.find(r => r.id === voiceCombination);
  if (role) return role.name;
  
  return voiceCombination;
};

export function PostGenerationDecision({ 
  isOpen, 
  onClose, 
  solutions, 
  onContinueWithVoice, 
  onSynthesizeAll 
}: PostGenerationDecisionProps) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  // Enhanced chat session creation following Jung's Descent Protocol with robust error recovery
  const createChatSessionMutation = useMutation({
    mutationFn: async (solution: Solution) => {
      console.log('🧠 Council Assembly: Creating chat session for solution:', {
        solutionId: solution.id,
        sessionId: solution.sessionId,
        voiceEngine: solution.voiceEngine,
        voiceCombination: solution.voiceCombination
      });

      try {
        // Robust session mapping with defensive programming - AI_INSTRUCTIONS.md patterns
        let mappedSessionId = solution.sessionId;
        
        try {
          const sessionMapping = await apiRequest('/api/sessions/map-id', {
            method: 'POST',
            body: { timestampSessionId: solution.sessionId }
          });
          mappedSessionId = sessionMapping.databaseSessionId || solution.sessionId;
          console.log('✅ Session mapped successfully:', mappedSessionId);
        } catch (mappingError) {
          console.warn('⚠️ Session mapping failed, using fallback approach:', mappingError);
          // Continue with original session ID as fallback
        }

        return apiRequest('/api/chat/sessions', {
          method: 'POST',
          body: {
            sessionId: mappedSessionId,
            selectedVoice: getVoiceDisplayName(solution.voiceCombination || solution.voiceEngine || solution.voiceName || 'general'),
            initialSolutionId: solution.id,
            contextData: {
              originalSolution: {
                code: solution.code || '',
                explanation: solution.explanation || '',
                confidence: solution.confidence || 85,
                voiceEngine: solution.voiceEngine || solution.voiceCombination || 'general'
              },
              voiceEngine: solution.voiceEngine || solution.voiceCombination || 'general',
              sessionMetadata: {
                sessionId: solution.sessionId,
                generatedAt: new Date().toISOString()
              }
            }
          }
        });
      } catch (error) {
        console.error('❌ Complete chat session creation failed:', error);
        throw new Error('Failed to create chat session. Please try again.');
      }
    },
    onSuccess: (chatSession) => {
      console.log('✅ Chat session created:', chatSession);
      onClose();
      // Navigate to full-page chat
      setLocation(`/chat/${chatSession.id}`);
    },
    onError: (error) => {
      console.error('❌ Failed to create chat session:', error);
      toast({
        title: "Failed to start chat",
        description: "Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleContinueWithVoice = (solution: Solution) => {
    console.log('🧠 Creating chat session with:', getVoiceDisplayName(solution.voiceCombination || solution.voiceEngine || solution.voiceName));
    createChatSessionMutation.mutate(solution);
  };
  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      if (!open) {
        console.log('🔄 Post-generation decision dialog closing via onOpenChange');
        onClose();
      }
    }}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <Brain className="w-6 h-6 text-blue-500" />
            <span>What's your next move?</span>
          </DialogTitle>
          <DialogDescription className="text-gray-500 dark:text-gray-400">
            You've got {solutions.length} AI-generated solutions. Continue discussing with a specific AI voice or synthesize all solutions together.
          </DialogDescription>
        </DialogHeader>

        <div className="overflow-y-auto max-h-[calc(90vh-180px)] space-y-6">
          {/* Option 1: Continue with specific voice */}
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <MessageCircle className="w-5 h-5 text-blue-500" />
              <h3 className="text-lg font-semibold">Continue with specific AI voice</h3>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Choose an AI specialist to continue the technical conversation. Perfect for deep dives into specific areas like performance optimization, security concerns, or UI improvements.
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {solutions.map((solution, index) => (
                <Card key={`solution-${solution.id || index}`} className="p-4 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                        <Brain className="w-4 h-4 text-blue-600" />
                      </div>
                      <div>
                        <h4 className="font-medium">{getVoiceDisplayName(solution.voiceCombination || solution.voiceEngine || solution.voiceName)}</h4>
                        <p className="text-xs text-gray-500">AI Specialist</p>
                      </div>
                    </div>
                    <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                      {solution.confidence}% Confidence
                    </Badge>
                  </div>
                  
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-3 line-clamp-2">
                    {solution.explanation}
                  </p>
                  
                  <Button 
                    onClick={() => handleContinueWithVoice(solution)}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                    size="sm"
                    disabled={createChatSessionMutation.isPending}
                  >
                    {createChatSessionMutation.isPending ? (
                      <Brain className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <MessageCircle className="w-4 h-4 mr-2" />
                    )}
                    Chat with {getVoiceDisplayName(solution.voiceCombination || solution.voiceEngine || solution.voiceName)}
                  </Button>
                </Card>
              ))}
            </div>
          </div>

          {/* Divider */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-gray-200 dark:border-gray-700" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white dark:bg-gray-900 px-2 text-gray-500">or</span>
            </div>
          </div>

          {/* Option 2: Synthesize all solutions */}
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <Layers3 className="w-5 h-5 text-purple-500" />
              <h3 className="text-lg font-semibold">Synthesize all solutions</h3>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Combine insights from all AI voices into one comprehensive solution. AI will merge the best parts of each approach.
            </p>
            
            <Card className="p-4 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 border-purple-200 dark:border-purple-800">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-900 flex items-center justify-center">
                    <Zap className="w-4 h-4 text-purple-600" />
                  </div>
                  <div>
                    <h4 className="font-medium">AI Synthesis Engine</h4>
                    <p className="text-xs text-gray-500">Combines {solutions.length} perspectives</p>
                  </div>
                </div>
                <Button 
                  onClick={onSynthesizeAll}
                  className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white"
                >
                  <Layers3 className="w-4 h-4 mr-2" />
                  Synthesize All Solutions
                </Button>
              </div>
            </Card>
          </div>
        </div>

        {/* Help text */}
        <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
          <p className="text-xs text-blue-700 dark:text-blue-300">
            💡 <strong>Tip:</strong> Choose "Chat" for iterative discussions and specific questions. Choose "Synthesize" for a final, comprehensive solution combining all perspectives.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}