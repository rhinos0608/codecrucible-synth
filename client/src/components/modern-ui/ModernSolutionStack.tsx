import { useState } from "react";
import { X, Copy, Download, MessageSquare, Lightbulb, Code2, Sparkles } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AppleStyleButton } from "./AppleStyleButton";
import { cn } from "@/lib/utils";
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { useToast } from "@/hooks/use-toast";

interface Solution {
  id: number;
  voice: string;
  confidence: number;
  code: string;
  explanation: string;
  voiceCombination?: string;
}

interface ModernSolutionStackProps {
  isOpen: boolean;
  onClose: () => void;
  sessionId: number;
  solutions?: Solution[];
  onSynthesize?: () => void;
}

export function ModernSolutionStack({ 
  isOpen, 
  onClose, 
  sessionId, 
  solutions = [],
  onSynthesize = () => {}
}: ModernSolutionStackProps) {
  const [activeTab, setActiveTab] = useState("solutions");
  const [selectedSolution, setSelectedSolution] = useState<number | null>(null);
  const { toast } = useToast();

  const handleCopyCode = (code: string, voice: string) => {
    navigator.clipboard.writeText(code);
    toast({
      title: "Code copied",
      description: `${voice}'s solution copied to clipboard`,
    });
  };

  const handleStartChat = (solution: Solution) => {
    // This would integrate with the chat system
    toast({
      title: "Chat initiated",
      description: `Starting conversation with ${solution.voice}`,
    });
  };

  // Mock solutions if none provided (for development)
  const displaySolutions = solutions.length > 0 ? solutions : [
    {
      id: 1,
      voice: "Explorer",
      confidence: 92,
      code: "// Explorer's innovative approach\nconst solution = () => {\n  // Experimental implementation\n  return 'explored';\n};",
      explanation: "This solution explores new possibilities with an innovative approach.",
      voiceCombination: "Explorer"
    },
    {
      id: 2,
      voice: "Analyzer",
      confidence: 88,
      code: "// Analyzer's systematic solution\nfunction analyze() {\n  // Thorough analysis\n  return 'analyzed';\n}",
      explanation: "A systematic analysis-driven solution with comprehensive evaluation.",
      voiceCombination: "Analyzer"
    }
  ];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl h-[90vh] flex flex-col glass-panel">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-gradient-to-r from-purple-500 to-blue-500 flex items-center justify-center">
              <Code2 className="w-4 h-4 text-white" />
            </div>
            Voice Council Solutions
            <Badge variant="outline" className="ml-2">
              Session {sessionId}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
          <TabsList className="flex-shrink-0 grid w-full grid-cols-3 bg-gray-100 dark:bg-gray-800 p-1 rounded-xl">
            <TabsTrigger 
              value="solutions" 
              className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm"
            >
              <Code2 className="w-4 h-4 mr-2" />
              Solutions ({displaySolutions.length})
            </TabsTrigger>
            <TabsTrigger 
              value="comparison"
              className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm"
            >
              <Lightbulb className="w-4 h-4 mr-2" />
              Comparison
            </TabsTrigger>
            <TabsTrigger 
              value="synthesis"
              className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm"
            >
              <Sparkles className="w-4 h-4 mr-2" />
              Synthesis
            </TabsTrigger>
          </TabsList>

          {/* Solutions Tab */}
          <TabsContent value="solutions" className="flex-1 mt-6">
            <ScrollArea className="h-full">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {displaySolutions.map((solution) => (
                  <Card 
                    key={solution.id} 
                    className={cn(
                      "modern-card transition-all duration-200 hover:shadow-lg",
                      selectedSolution === solution.id && "ring-2 ring-purple-500"
                    )}
                    onClick={() => setSelectedSolution(solution.id)}
                  >
                    <CardHeader className="pb-3">
                      <CardTitle className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-gradient-to-r from-purple-500 to-blue-500 flex items-center justify-center">
                            <span className="text-xs font-bold text-white">
                              {solution.voice.charAt(0)}
                            </span>
                          </div>
                          {solution.voiceCombination || solution.voice}
                        </div>
                        <Badge 
                          variant="secondary" 
                          className={cn(
                            "font-medium",
                            solution.confidence >= 90 && "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
                            solution.confidence >= 80 && solution.confidence < 90 && "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
                            solution.confidence < 80 && "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
                          )}
                        >
                          {solution.confidence}% confidence
                        </Badge>
                      </CardTitle>
                    </CardHeader>
                    
                    <CardContent className="space-y-4">
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {solution.explanation}
                      </p>
                      
                      <div className="relative">
                        <SyntaxHighlighter
                          style={oneDark}
                          language="typescript"
                          className="!text-sm !rounded-lg !max-h-[300px]"
                        >
                          {solution.code}
                        </SyntaxHighlighter>
                      </div>
                      
                      <div className="flex gap-2">
                        <AppleStyleButton
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCopyCode(solution.code, solution.voice);
                          }}
                          icon={<Copy className="w-3 h-3" />}
                        >
                          Copy
                        </AppleStyleButton>
                        
                        <AppleStyleButton
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleStartChat(solution);
                          }}
                          icon={<MessageSquare className="w-3 h-3" />}
                        >
                          Chat
                        </AppleStyleButton>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          </TabsContent>

          {/* Comparison Tab */}
          <TabsContent value="comparison" className="flex-1 mt-6">
            <Card className="h-full">
              <CardContent className="p-6">
                <div className="text-center py-12">
                  <Lightbulb className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                    Solution Comparison
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400">
                    Compare different approaches and methodologies from your voice council
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Synthesis Tab */}
          <TabsContent value="synthesis" className="flex-1 mt-6">
            <Card className="h-full">
              <CardContent className="p-6">
                <div className="text-center py-12">
                  <Sparkles className="w-12 h-12 text-purple-500 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                    AI Synthesis Engine
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400 mb-6">
                    Combine multiple voice solutions into a comprehensive final implementation
                  </p>
                  
                  <AppleStyleButton
                    variant="consciousness"
                    onClick={onSynthesize}
                    icon={<Sparkles className="w-4 h-4" />}
                  >
                    Synthesize Solutions
                  </AppleStyleButton>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}