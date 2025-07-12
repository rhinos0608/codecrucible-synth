import { X, Layers3, CheckCircle, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import type { Solution } from "@shared/schema";
import { CODE_PERSPECTIVES, DEVELOPMENT_ROLES } from "@/types/voices";

interface ImplementationOptionsProps {
  isOpen: boolean;
  onClose: () => void;
  sessionId: number | null;
  onMergeClick: (solutions: Solution[]) => void;
}

// Map voice combination IDs to display names following AI_INSTRUCTIONS.md patterns
const getVoiceDisplayName = (voiceCombination: string): string => {
  // Handle single voice cases
  const perspective = CODE_PERSPECTIVES.find(p => p.id === voiceCombination);
  if (perspective) return perspective.name;
  
  const role = DEVELOPMENT_ROLES.find(r => r.id === voiceCombination);
  if (role) return role.name;
  
  // Handle combined voice cases (perspective-role or perspective+role)
  const combinationParts = voiceCombination.split(/[-+]/);
  if (combinationParts.length === 2) {
    const [part1, part2] = combinationParts;
    const perspective1 = CODE_PERSPECTIVES.find(p => p.id === part1);
    const role1 = DEVELOPMENT_ROLES.find(r => r.id === part1);
    const perspective2 = CODE_PERSPECTIVES.find(p => p.id === part2);
    const role2 = DEVELOPMENT_ROLES.find(r => r.id === part2);
    
    const name1 = perspective1?.name || role1?.name || part1;
    const name2 = perspective2?.name || role2?.name || part2;
    
    return `${name1} + ${name2}`;
  }
  
  // Fallback: return original if no mapping found
  return voiceCombination;
};

export function SolutionStack({ isOpen, onClose, sessionId, onMergeClick }: ImplementationOptionsProps) {
  const { data: solutions = [], isLoading } = useQuery({
    queryKey: ["/api/sessions", sessionId, "solutions"],
    enabled: !!sessionId && isOpen,
  });

  const handleMergeClick = () => {
    onMergeClick(solutions);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <div>
              <h3 className="text-xl font-semibold">Implementation Options</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">Multi-perspective code generation results</p>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="overflow-y-auto max-h-[calc(90vh-120px)] p-1" style={{ scrollbarWidth: 'thin' }}>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
              <span className="ml-2 text-gray-600 dark:text-gray-400">Generating solutions...</span>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                {solutions.map((solution) => (
                  <Card key={solution.id} className={`border border-steward/20 rounded-lg overflow-hidden`}>
                    <div className="bg-steward/10 p-4 border-b border-steward/20">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <div className="flex -space-x-1">
                            <div className="w-8 h-8 bg-steward rounded-full border-2 border-white dark:border-gray-800 flex items-center justify-center">
                              <CheckCircle className="w-4 h-4 text-white" />
                            </div>
                          </div>
                          <div>
                            <h4 className="font-semibold text-steward">{getVoiceDisplayName(solution.voiceCombination)}</h4>
                            <p className="text-xs text-gray-600 dark:text-gray-400">{solution.explanation}</p>
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
                        <div className="bg-gray-900 rounded-lg p-3 text-xs font-mono text-gray-100 overflow-x-auto max-h-64 overflow-y-auto">
                          <pre className="whitespace-pre-wrap break-words">{solution.code || "No code generated"}</pre>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4 text-xs">
                        <div>
                          <h6 className="font-medium text-gray-700 dark:text-gray-300 mb-1">Strengths</h6>
                          <ul className="space-y-1 text-gray-600 dark:text-gray-400">
                            {(solution.strengths as string[]).map((strength, idx) => (
                              <li key={idx}>• {strength}</li>
                            ))}
                          </ul>
                        </div>
                        <div>
                          <h6 className="font-medium text-gray-700 dark:text-gray-300 mb-1">Considerations</h6>
                          <ul className="space-y-1 text-gray-600 dark:text-gray-400">
                            {(solution.considerations as string[]).map((consideration, idx) => (
                              <li key={idx}>• {consideration}</li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>

              {solutions.length > 0 && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                    <div className="text-sm text-gray-600 dark:text-gray-400">
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
  );
}
