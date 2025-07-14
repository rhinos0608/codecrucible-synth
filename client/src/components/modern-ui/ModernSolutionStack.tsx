import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AppleStyleButton } from "./AppleStyleButton";
import { Progress } from "@/components/ui/progress";
import { 
  Code2, 
  Sparkles, 
  Eye, 
  MessageSquare, 
  Download,
  Copy,
  Star,
  ThumbsUp,
  ThumbsDown,
  ChevronRight,
  Layers,
  FileCode,
  Zap,
  Brain
} from "lucide-react";
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { cn } from "@/lib/utils";

// Preserve all existing solution logic and API calls
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import type { Solution } from "@shared/schema";

interface ModernSolutionStackProps {
  isOpen: boolean;
  onClose: () => void;
  sessionId: number | null;
  solutions: Solution[];
  onSynthesize: () => void;
}

// Voice-specific styling configurations
const VOICE_STYLES = {
  explorer: {
    color: 'blue',
    gradient: 'from-blue-500 to-cyan-500',
    icon: Eye,
    bgColor: 'bg-blue-50 dark:bg-blue-900/20'
  },
  maintainer: {
    color: 'green', 
    gradient: 'from-green-500 to-emerald-500',
    icon: FileCode,
    bgColor: 'bg-green-50 dark:bg-green-900/20'
  },
  analyzer: {
    color: 'purple',
    gradient: 'from-purple-500 to-violet-500', 
    icon: Brain,
    bgColor: 'bg-purple-50 dark:bg-purple-900/20'
  },
  developer: {
    color: 'rose',
    gradient: 'from-rose-500 to-pink-500',
    icon: Code2,
    bgColor: 'bg-rose-50 dark:bg-rose-900/20'
  },
  implementor: {
    color: 'orange',
    gradient: 'from-orange-500 to-amber-500',
    icon: Zap,
    bgColor: 'bg-orange-50 dark:bg-orange-900/20'
  }
};

interface SolutionCardProps {
  solution: Solution;
  index: number;
}

function SolutionCard({ solution, index }: SolutionCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [rating, setRating] = useState<'up' | 'down' | null>(null);
  const { toast } = useToast();

  // Get voice style configuration
  const voiceStyle = VOICE_STYLES[solution.voiceCombination as keyof typeof VOICE_STYLES] || VOICE_STYLES.explorer;
  const Icon = voiceStyle.icon;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(solution.code);
      toast({
        title: "Code Copied",
        description: "Solution copied to clipboard"
      });
    } catch (error) {
      toast({
        title: "Copy Failed", 
        description: "Unable to copy to clipboard",
        variant: "destructive"
      });
    }
  };

  const handleRating = (newRating: 'up' | 'down') => {
    setRating(newRating);
    toast({
      title: "Feedback Recorded",
      description: `Thanks for rating this ${solution.voiceCombination} solution`
    });
  };

  return (
    <Card className={cn(
      "transition-all duration-300 hover:shadow-lg border-l-4",
      `border-l-${voiceStyle.color}-500`,
      voiceStyle.bgColor
    )}>
      <CardHeader className="pb-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className={cn(
              "w-12 h-12 rounded-xl flex items-center justify-center shadow-sm",
              `bg-gradient-to-r ${voiceStyle.gradient}`
            )}>
              <Icon className="w-6 h-6 text-white" />
            </div>
            
            <div>
              <CardTitle className="text-lg capitalize">
                {solution.voiceCombination || solution.voiceEngine}
              </CardTitle>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="outline" className={`border-${voiceStyle.color}-300`}>
                  <Star className="w-3 h-3 mr-1" />
                  {solution.confidenceScore}% confidence
                </Badge>
                <Badge variant="secondary">
                  Solution #{index + 1}
                </Badge>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <AppleStyleButton
              variant="ghost"
              size="sm"
              onClick={() => handleRating('up')}
              className={rating === 'up' ? 'bg-green-100 text-green-700' : ''}
            >
              <ThumbsUp className="w-4 h-4" />
            </AppleStyleButton>
            
            <AppleStyleButton
              variant="ghost"
              size="sm"
              onClick={() => handleRating('down')}
              className={rating === 'down' ? 'bg-red-100 text-red-700' : ''}
            >
              <ThumbsDown className="w-4 h-4" />
            </AppleStyleButton>

            <AppleStyleButton
              variant="ghost"
              size="sm"
              onClick={handleCopy}
            >
              <Copy className="w-4 h-4" />
            </AppleStyleButton>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Solution explanation */}
        <div className="space-y-2">
          <h4 className="font-medium text-gray-900 dark:text-white">Approach</h4>
          <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
            {solution.explanation}
          </p>
        </div>

        {/* Code preview */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="font-medium text-gray-900 dark:text-white">Implementation</h4>
            <AppleStyleButton
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
            >
              {isExpanded ? 'Collapse' : 'Expand'}
              <ChevronRight className={cn(
                "w-4 h-4 ml-1 transition-transform duration-200",
                isExpanded && "rotate-90"
              )} />
            </AppleStyleButton>
          </div>

          <div className="relative">
            <SyntaxHighlighter
              style={oneDark}
              language="typescript"
              className="!rounded-lg !text-sm"
              customStyle={{
                maxHeight: isExpanded ? 'none' : '200px',
                overflow: isExpanded ? 'visible' : 'hidden'
              }}
            >
              {solution.code}
            </SyntaxHighlighter>
            
            {!isExpanded && solution.code.length > 500 && (
              <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-gray-900 to-transparent rounded-b-lg" />
            )}
          </div>
        </div>

        {/* Technical details */}
        {solution.tradeOffs && (
          <div className="space-y-2">
            <h4 className="font-medium text-gray-900 dark:text-white">Trade-offs</h4>
            <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
              {solution.tradeOffs.split('\n').map((tradeOff, idx) => (
                <div key={idx} className="flex items-start gap-2">
                  <div className="w-1 h-1 bg-gray-400 rounded-full mt-2 flex-shrink-0" />
                  <span>{tradeOff}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Performance metrics */}
        <div className="grid grid-cols-2 gap-4 pt-2 border-t border-gray-200 dark:border-gray-700">
          <div className="text-center">
            <div className="text-lg font-semibold text-gray-900 dark:text-white">
              {solution.timeComplexity || 'O(n)'}
            </div>
            <div className="text-xs text-gray-500">Time Complexity</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-semibold text-gray-900 dark:text-white">
              {solution.spaceComplexity || 'O(1)'}
            </div>
            <div className="text-xs text-gray-500">Space Complexity</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function ModernSolutionStack({ 
  isOpen, 
  onClose, 
  sessionId, 
  solutions, 
  onSynthesize 
}: ModernSolutionStackProps) {
  const [activeTab, setActiveTab] = useState("solutions");

  // Fetch solutions if sessionId provided but no solutions
  const { data: fetchedSolutions, isLoading } = useQuery({
    queryKey: ['/api/sessions', sessionId, 'solutions'],
    enabled: !!sessionId && solutions.length === 0,
  });

  const displaySolutions = solutions.length > 0 ? solutions : (fetchedSolutions || []);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] p-0 gap-0">
        <DialogDescription className="sr-only">
          AI-generated code solutions from multiple voice perspectives
        </DialogDescription>
        
        {/* Header */}
        <DialogHeader className="p-6 pb-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-2xl font-bold">Solution Council</DialogTitle>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                {displaySolutions.length} solutions generated by your AI voice council
              </p>
            </div>

            <div className="flex items-center gap-3">
              <Badge variant="outline" className="font-medium">
                Session #{sessionId}
              </Badge>
              
              <AppleStyleButton
                variant="consciousness"
                onClick={onSynthesize}
                icon={<Layers className="w-4 h-4" />}
              >
                Synthesize All
              </AppleStyleButton>
            </div>
          </div>
        </DialogHeader>

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
            <TabsList className="mx-6 mt-4 bg-gray-100 dark:bg-gray-800 p-1">
              <TabsTrigger value="solutions" className="flex-1">
                Solutions ({displaySolutions.length})
              </TabsTrigger>
              <TabsTrigger value="comparison">
                Compare
              </TabsTrigger>
              <TabsTrigger value="analysis">
                Analysis
              </TabsTrigger>
            </TabsList>

            {/* Solutions Grid */}
            <TabsContent value="solutions" className="flex-1 mt-4">
              <ScrollArea className="h-[60vh] px-6 pb-6">
                {isLoading ? (
                  <div className="flex items-center justify-center h-40">
                    <div className="text-center">
                      <div className="w-8 h-8 border-2 border-purple-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                      <p className="text-sm text-gray-600 dark:text-gray-400">Loading solutions...</p>
                    </div>
                  </div>
                ) : displaySolutions.length === 0 ? (
                  <div className="text-center py-12">
                    <Code2 className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                      No Solutions Yet
                    </h3>
                    <p className="text-gray-600 dark:text-gray-400">
                      Start a generation to see AI solutions appear here
                    </p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {displaySolutions.map((solution, index) => (
                      <SolutionCard
                        key={solution.id || index}
                        solution={solution}
                        index={index}
                      />
                    ))}
                  </div>
                )}
              </ScrollArea>
            </TabsContent>

            {/* Comparison View */}
            <TabsContent value="comparison" className="flex-1 mt-4">
              <ScrollArea className="h-[60vh] px-6 pb-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {displaySolutions.slice(0, 4).map((solution, index) => (
                    <Card key={solution.id || index} className="h-fit">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base capitalize">
                          {solution.voiceCombination || solution.voiceEngine}
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <SyntaxHighlighter
                          style={oneDark}
                          language="typescript"
                          className="!text-xs !rounded-lg"
                          customStyle={{ maxHeight: '300px' }}
                        >
                          {solution.code.slice(0, 800)}
                        </SyntaxHighlighter>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </ScrollArea>
            </TabsContent>

            {/* Analysis View */}
            <TabsContent value="analysis" className="flex-1 mt-4">
              <ScrollArea className="h-[60vh] px-6 pb-6">
                <div className="space-y-6">
                  {/* Performance Overview */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Brain className="w-5 h-5" />
                        Council Performance
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="text-center p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                          <div className="text-2xl font-bold text-blue-600">
                            {Math.round(displaySolutions.reduce((acc, s) => acc + (s.confidenceScore || 85), 0) / displaySolutions.length)}%
                          </div>
                          <div className="text-sm text-gray-600 dark:text-gray-400">Avg Confidence</div>
                        </div>
                        
                        <div className="text-center p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                          <div className="text-2xl font-bold text-green-600">
                            {displaySolutions.length}
                          </div>
                          <div className="text-sm text-gray-600 dark:text-gray-400">Solutions</div>
                        </div>
                        
                        <div className="text-center p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                          <div className="text-2xl font-bold text-purple-600">
                            {new Set(displaySolutions.map(s => s.voiceCombination || s.voiceEngine)).size}
                          </div>
                          <div className="text-sm text-gray-600 dark:text-gray-400">Unique Voices</div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Voice Breakdown */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Voice Contributions</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {displaySolutions.map((solution, index) => {
                        const voiceStyle = VOICE_STYLES[solution.voiceCombination as keyof typeof VOICE_STYLES] || VOICE_STYLES.explorer;
                        return (
                          <div key={index} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                            <div className="flex items-center gap-3">
                              <div className={cn(
                                "w-8 h-8 rounded-lg flex items-center justify-center",
                                `bg-gradient-to-r ${voiceStyle.gradient}`
                              )}>
                                <voiceStyle.icon className="w-4 h-4 text-white" />
                              </div>
                              <span className="font-medium capitalize">
                                {solution.voiceCombination || solution.voiceEngine}
                              </span>
                            </div>
                            <Progress 
                              value={solution.confidenceScore || 85} 
                              className="w-24"
                            />
                          </div>
                        );
                      })}
                    </CardContent>
                  </Card>
                </div>
              </ScrollArea>
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
}