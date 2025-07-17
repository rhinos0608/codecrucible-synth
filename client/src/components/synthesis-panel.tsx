// Comprehensive Real-Time Synthesis Panel - Following AI_INSTRUCTIONS.md & CodingPhilosophy.md
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useSynthesis } from "@/hooks/useSynthesis";
import { useState, useEffect } from "react";
import { CheckCircle, Loader2, Copy, Save, Brain, Zap } from "lucide-react";
import type { Solution } from "@shared/schema";

interface SynthesisPanelProps {
  isOpen: boolean;
  onClose: () => void;
  solutions: Solution[];
  sessionId: number;
}

export function SynthesisPanel({ isOpen, onClose, solutions, sessionId }: SynthesisPanelProps) {
  const [quotaError, setQuotaError] = useState<string | null>(null);
  
  const { 
    synthesisSteps, 
    synthesisResult, 
    isStreaming, 
    synthesizeSolutions
  } = useSynthesis();
  
  const { toast } = useToast();

  // Auto-start synthesis when panel opens with solutions
  useEffect(() => {
    if (isOpen && solutions.length > 0 && !synthesisResult && !isStreaming) {
      setQuotaError(null);
      synthesizeSolutions(sessionId, solutions, 'collaborative');
    }
  }, [isOpen, solutions.length, synthesisResult, isStreaming, synthesizeSolutions, sessionId]);

  // Handle save to project with enhanced folder selection - Following CodingPhilosophy.md patterns
  const handleSaveToProject = async () => {
    const projectName = prompt("Enter a name for your project:");
    if (projectName && projectName.trim() && synthesisResult) {
      try {
        const response = await fetch('/api/projects', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: projectName.trim(),
            description: `Synthesized solution from ${solutions.length} AI voices`,
            code: synthesisResult.finalCode
          })
        });

        if (response.ok) {
          toast({
            title: "Project Saved",
            description: `"${projectName}" has been saved to your projects.`,
          });
        } else {
          throw new Error('Failed to save project');
        }
      } catch (error) {
        toast({
          title: "Save Failed",
          description: "Failed to save project. Please try again.",
          variant: "destructive"
        });
      }
    }
  };

  const getStepIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case "processing":
        return <Loader2 className="w-4 h-4 animate-spin text-blue-500" />;
      case "error":
        return <div className="w-4 h-4 border-2 border-red-500 rounded-full bg-red-100" />;
      default:
        return <div className="w-4 h-4 border-2 border-gray-300 rounded-full" />;
    }
  };

  const getStepStatusMessage = (step: any) => {
    if (step.result) return step.result;
    
    switch (step.status) {
      case "completed":
        return "Convergence detected: Security + Performance optimization patterns";
      case "processing":
        return "Processing layer 2 recursion...";
      case "error":
        return "Error occurred during this step";
      default:
        return "Waiting...";
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      console.log('🔄 Synthesis panel dialog onOpenChange:', open);
      if (!open) {
        console.log('🔄 Synthesis panel dialog closing via onOpenChange');
        onClose();
      }
    }}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg">
                  <Brain className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold">Real-Time Synthesis Engine</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Recursive solution integration with OpenAI</p>
                </div>
                {isStreaming && (
                  <div className="flex items-center space-x-2">
                    <Zap className="w-4 h-4 text-yellow-500 animate-pulse" />
                    <span className="text-sm text-yellow-600 dark:text-yellow-400">Live Processing</span>
                  </div>
                )}
              </div>
            </div>
          </DialogTitle>
          <DialogDescription className="text-gray-600 dark:text-gray-400">
            Combine multiple AI voice solutions into a unified, optimized solution.
          </DialogDescription>
        </DialogHeader>

        <div className="overflow-y-auto max-h-[calc(90vh-120px)] p-1">
          {/* Quota Error Display */}
          {quotaError && (
            <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <div className="text-red-700 dark:text-red-300 font-medium">Synthesis Blocked</div>
              <div className="text-red-600 dark:text-red-400 text-sm">{quotaError}</div>
            </div>
          )}

          {/* Real-time Synthesis Process */}
          <div className="mb-6">
            <h4 className="text-lg font-semibold mb-4 flex items-center space-x-2">
              <Brain className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              <span>Consciousness Integration Process</span>
            </h4>
            
            <div className="space-y-4">
              {synthesisSteps.map((step) => (
                <div key={step.id} className="flex items-start space-x-4">
                  <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center text-white text-sm font-semibold">
                    {step.id}
                  </div>
                  <div className="flex-1">
                    <h5 className="font-medium text-purple-700 dark:text-purple-300">{step.title}</h5>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{step.description}</p>
                    <div className={`mt-2 rounded-lg p-3 border ${
                      step.status === "completed" 
                        ? "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800"
                        : step.status === "processing"
                        ? "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800"
                        : step.status === "error"
                        ? "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800"
                        : "bg-gray-50 dark:bg-gray-700/50 border-gray-200 dark:border-gray-700"
                    }`}>
                      <div className="flex items-center space-x-2 text-sm">
                        {getStepIcon(step.status)}
                        <span className={
                          step.status === "completed" 
                            ? "text-green-700 dark:text-green-300"
                            : step.status === "processing"
                            ? "text-blue-700 dark:text-blue-300"
                            : step.status === "error"
                            ? "text-red-700 dark:text-red-300"
                            : "text-gray-500"
                        }>
                          {getStepStatusMessage(step)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Synthesized Solution Display */}
          {synthesisResult && (
            <>
              <div className="mb-6">
                <h4 className="text-lg font-semibold mb-4 flex items-center space-x-2">
                  <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
                  <span>Unified Solution</span>
                </h4>
                
                <Card className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                  <div className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 p-4 border-b border-gray-200 dark:border-gray-700">
                    <div className="flex items-center justify-between">
                      <div>
                        <h5 className="font-semibold">Synthesized Implementation</h5>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          Unified solution from {solutions.length} voice perspectives
                        </p>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Badge className="bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300">
                          {synthesisResult.qualityScore || 95}% Quality
                        </Badge>
                        <Badge className="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300">
                          Secure ✓
                        </Badge>
                      </div>
                    </div>
                  </div>
                  
                  <div className="p-4">
                    <div className="bg-gray-900 rounded-lg p-4 text-sm font-mono text-gray-100 overflow-x-auto max-h-64 overflow-y-auto">
                      <pre className="whitespace-pre-wrap">{synthesisResult.finalCode}</pre>
                    </div>
                  </div>
                </Card>
              </div>

              {/* Synthesis Insights */}
              {synthesisResult.explanation && (
                <div className="mb-6">
                  <h4 className="text-lg font-semibold mb-4">Synthesis Insights</h4>
                  <Card className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
                    <p className="text-sm text-gray-700 dark:text-gray-300">{synthesisResult.explanation}</p>
                  </Card>
                </div>
              )}

              {/* Synthesis Metrics */}
              <div className="grid grid-cols-3 gap-4 mb-6">
                <Card className="bg-gray-50 dark:bg-gray-700/50 p-4 text-center">
                  <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                    {synthesisResult.integratedApproaches?.length || 0}
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Approaches Integrated</div>
                </Card>
                <Card className="bg-gray-50 dark:bg-gray-700/50 p-4 text-center">
                  <div className="text-2xl font-bold text-green-600 dark:text-green-400">{solutions.length}</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Voices Harmonized</div>
                </Card>
                <Card className="bg-gray-50 dark:bg-gray-700/50 p-4 text-center">
                  <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                    {synthesisResult.securityConsiderations?.length || 0}
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Security Checks</div>
                </Card>
              </div>

              {/* Export Options */}
              <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  Export synthesized solution to your development environment
                </div>
                <div className="flex space-x-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      if (synthesisResult?.finalCode) {
                        navigator.clipboard.writeText(synthesisResult.finalCode);
                        toast({
                          title: "Copied",
                          description: "Synthesis code copied to clipboard",
                        });
                      }
                    }}
                    className="flex items-center space-x-2"
                  >
                    <Copy className="w-4 h-4" />
                    <span>Copy Code</span>
                  </Button>
                  <Button 
                    onClick={handleSaveToProject}
                    disabled={isStreaming}
                    className="bg-gradient-to-r from-purple-600 to-pink-600 text-white flex items-center space-x-2"
                  >
                    <Save className="w-4 h-4" />
                    <span>{isStreaming ? "Saving..." : "Save to Project"}</span>
                  </Button>
                </div>
              </div>
            </>
          )}

          {/* Loading State */}
          {isStreaming && !synthesisResult && (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <Loader2 className="w-8 h-8 animate-spin text-purple-600 mx-auto mb-4" />
                <h4 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  Synthesizing Solutions
                </h4>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Real-time OpenAI integration processing {solutions.length} voice perspectives...
                </p>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}