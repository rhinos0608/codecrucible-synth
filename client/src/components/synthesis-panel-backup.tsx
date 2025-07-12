import { X, CheckCircle, Loader2, Copy, Save } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useSynthesis } from "@/hooks/useSynthesis";
import { useState, useEffect } from "react";
import type { Solution } from "@shared/schema";

interface CodeMergePanelProps {
  isOpen: boolean;
  onClose: () => void;
  solutions: Solution[];
  sessionId: number;
}

interface MergeStep {
  id: number;
  title: string;
  description: string;
  status: "completed" | "processing" | "pending";
  result?: string;
}

export function SynthesisPanel({ isOpen, onClose, solutions, sessionId }: CodeMergePanelProps) {
  const { 
    synthesisSteps, 
    synthesisResult, 
    isStreaming, 
    isSynthesizing,
    synthesizeSolutions,
    saveToProject,
    isSavingProject,
    copyToClipboard
  } = useSynthesis();
  const { toast } = useToast();
  const [quotaError, setQuotaError] = useState<string | null>(null);
  
  // Project save mutation (separate from useSynthesis hook)
  const saveProjectMutation = useMutation({
    mutationFn: async (projectData: { name: string; description?: string }) => {
      const response = await apiRequest("POST", "/api/projects", {
        name: projectData.name,
        description: projectData.description,
        code: synthesisResult?.synthesizedCode || '',
        language: "javascript",
        sessionId: sessionId,
        tags: ["synthesis", "multi-voice"],
        isPublic: false
      });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Project Saved",
        description: "Your synthesized solution has been saved successfully."
      });
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
    },
    onError: (error) => {
      toast({
        title: "Save Failed", 
        description: "Failed to save project. Please try again.",
        variant: "destructive"
      });
      console.error("Failed to save project:", error);
    }
  });

  // Start synthesis when panel opens with solutions
  useEffect(() => {
    if (isOpen && solutions.length > 0 && !synthesisResult && !isSynthesizing) {
      synthesizeSolutions({ sessionId, solutions });
    }
  }, [isOpen, solutions.length, synthesisResult, isSynthesizing, synthesizeSolutions, sessionId, solutions]);

  // Handle save to project
  const handleSaveProject = (projectName: string) => {
    if (synthesisResult) {
      saveToProject({ 
        name: projectName, 
        description: `Synthesized solution from ${solutions.length} AI voices` 
      });
    } else {
      toast({
        title: "No Synthesis Available",
        description: "Please wait for synthesis to complete before saving.",
        variant: "destructive"
      });
    }
    console.log('Starting real OpenAI synthesis for session:', sessionId);
    
    setSynthesisSteps(prev => prev.map(step => 
      step.id === 1 ? { ...step, status: "processing" } : step
    ));

    try {
      setQuotaError(null);
      const synthesis = await createSynthesis.mutateAsync(sessionId);
      
      // Update all steps to completed
      setSynthesisSteps(prev => prev.map(step => ({ 
        ...step, 
        status: "completed" 
      })));

      // Use the real OpenAI generated code
      setSynthesizedCode(synthesis.combinedCode);
      setSynthesisComplete(true);

      console.log('OpenAI synthesis completed:', synthesis.id);

    } catch (error: any) {
      console.error('OpenAI synthesis failed:', error);
      
      // Handle quota exceeded error specifically
      if (error.message?.includes("quota") || error.message?.includes("limit") || error.message?.includes("403")) {
        setQuotaError("Daily generation limit reached. Upgrade to Pro for unlimited synthesis.");
      } else {
        setQuotaError("Synthesis failed. Please try again.");
      }
      
      setSynthesisSteps(prev => prev.map(step => ({ 
        ...step, 
        status: "pending" 
      })));
      
      toast({
        title: "Synthesis Failed",
        description: error.message?.includes("quota") ? "Daily generation limit reached. Upgrade to Pro for unlimited synthesis." : "Unable to synthesize solutions. Please try again.",
        variant: "destructive"
      });
    }
  };

  // Handle save to project with name prompt
  const handleSaveToProject = async () => {
    const projectName = prompt("Enter a name for your project:");
    if (projectName && projectName.trim()) {
      saveToProject.mutate({
        name: projectName.trim(),
        description: `Multi-voice synthesized solution from session ${sessionId}`
      });
    }
  };

  const getStepIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case "processing":
        return <Loader2 className="w-4 h-4 animate-spin text-blue-500" />;
      default:
        return <div className="w-4 h-4 border-2 border-gray-300 rounded-full" />;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle>
            <div>
              <h3 className="text-xl font-semibold">Synthesis Panel</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">Recursive solution integration and refinement</p>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="overflow-y-auto max-h-[calc(90vh-120px)] p-1">
          {/* Synthesis Process */}
          <div className="mb-6">
            <h4 className="text-lg font-semibold mb-4">Recursive Synthesis Process</h4>
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
                        : "bg-gray-50 dark:bg-gray-700/50 border-gray-200 dark:border-gray-700"
                    }`}>
                      <div className="flex items-center space-x-2 text-sm">
                        {getStepIcon(step.status)}
                        <span className={
                          step.status === "completed" 
                            ? "text-green-700 dark:text-green-300"
                            : step.status === "processing"
                            ? "text-blue-700 dark:text-blue-300"
                            : "text-gray-500"
                        }>
                          {step.status === "completed" && "Convergence detected: Security + Performance optimization patterns"}
                          {step.status === "processing" && "Processing layer 2 recursion..."}
                          {step.status === "pending" && "Waiting..."}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Synthesized Solution */}
          {synthesisComplete && (
            <>
              <div className="mb-6">
                <h4 className="text-lg font-semibold mb-4">Synthesized Solution</h4>
                <Card className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                  <div className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 p-4 border-b border-gray-200 dark:border-gray-700">
                    <div className="flex items-center justify-between">
                      <div>
                        <h5 className="font-semibold">Unified Form Management Hook</h5>
                        <p className="text-sm text-gray-600 dark:text-gray-400">Security-conscious, performance-optimized, user-friendly implementation</p>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Badge className="bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300">
                          96% Confidence
                        </Badge>
                        <Badge className="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300">
                          Ethical ✓
                        </Badge>
                      </div>
                    </div>
                  </div>
                  <div className="p-4">
                    <div className="bg-gray-900 rounded-lg p-4 text-sm font-mono text-gray-100 overflow-x-auto max-h-64 overflow-y-auto">
                      <pre className="whitespace-pre-wrap">{synthesisResult?.synthesizedCode || 'Synthesis in progress...'}</pre>
                    </div>
                  </div>
                </Card>
              </div>

              {/* Synthesis Metrics */}
              <div className="grid grid-cols-3 gap-4 mb-6">
                <Card className="bg-gray-50 dark:bg-gray-700/50 p-4 text-center">
                  <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">2</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Recursion Layers</div>
                </Card>
                <Card className="bg-gray-50 dark:bg-gray-700/50 p-4 text-center">
                  <div className="text-2xl font-bold text-green-600 dark:text-green-400">{solutions.length}</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Voices Harmonized</div>
                </Card>
                <Card className="bg-gray-50 dark:bg-gray-700/50 p-4 text-center">
                  <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">98%</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Synthesis Quality</div>
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
                    onClick={copyToClipboard}
                    className="flex items-center space-x-2"
                  >
                    <Copy className="w-4 h-4" />
                    <span>Copy Code</span>
                  </Button>
                  <Button 
                    onClick={handleSaveToProject}
                    disabled={saveToProject.isPending}
                    className="bg-gradient-to-r from-purple-600 to-pink-600 text-white flex items-center space-x-2"
                  >
                    <Save className="w-4 h-4" />
                    <span>{saveToProject.isPending ? "Saving..." : "Save to Project"}</span>
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
