import { X, Layers3, CheckCircle, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import type { Solution } from "@shared/schema";

interface SolutionStackProps {
  isOpen: boolean;
  onClose: () => void;
  sessionId: number | null;
  onSynthesizeClick: (solutions: Solution[]) => void;
}

export function SolutionStack({ isOpen, onClose, sessionId, onSynthesizeClick }: SolutionStackProps) {
  const { data: solutions = [], isLoading } = useQuery({
    queryKey: ["/api/sessions", sessionId, "solutions"],
    enabled: !!sessionId && isOpen,
  });

  const handleSynthesizeClick = () => {
    onSynthesizeClick(solutions);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <div>
              <h3 className="text-xl font-semibold">Solution Stack</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">Multi-voice code generation results</p>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="overflow-y-auto max-h-[calc(90vh-120px)] p-1">
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
                            <h4 className="font-semibold text-steward">{solution.voiceCombination}</h4>
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
                        <div className="bg-gray-900 rounded-lg p-3 text-xs font-mono text-gray-100 overflow-x-auto max-h-48 overflow-y-auto">
                          <pre className="whitespace-pre-wrap">{solution.code}</pre>
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
                <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    Ready to synthesize solutions into final implementation?
                  </div>
                  <Button 
                    className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white px-4 py-2 rounded-lg transition-all flex items-center space-x-2"
                    onClick={handleSynthesizeClick}
                  >
                    <Layers3 className="w-4 h-4" />
                    <span>Synthesize Solutions</span>
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
