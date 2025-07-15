import { useState } from "react";
import { Brain, Sparkles, Zap, Plus, MessageSquare } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ModernVoiceSelector } from "./ModernVoiceSelector";
import { AppleStyleButton } from "./AppleStyleButton";
import { cn } from "@/lib/utils";
// Simplified imports for initial implementation

interface ModernMainContentProps {
  onGenerate?: (prompt: string) => void;
  onStreamingGenerate?: (prompt: string) => void;
  className?: string;
}

export function ModernMainContent({ 
  onGenerate, 
  onStreamingGenerate,
  className 
}: ModernMainContentProps) {
  const [prompt, setPrompt] = useState("");
  const [showVoiceSelector, setShowVoiceSelector] = useState(false);
  // Simplified voice selection for initial implementation
  const selectedVoices = ['explorer', 'architect'];
  // Mock data for initial implementation
  const canGenerate = true;
  const planTier = 'free';

  const handleGenerate = () => {
    if (!canGenerate || !prompt.trim()) return;
    onGenerate?.(prompt);
  };

  const handleStreamingGenerate = () => {
    if (!canGenerate || !prompt.trim()) return;
    onStreamingGenerate?.(prompt);
  };

  const promptSuggestions = [
    "Create a React component for user authentication",
    "Build a REST API with TypeScript and Express",
    "Design a responsive dashboard layout",
    "Implement real-time data synchronization",
    "Create a state management solution"
  ];

  return (
    <div className={cn("flex flex-col h-full", className)}>
      {/* Header */}
      <div className="flex-shrink-0 p-6 border-b border-gray-200 dark:border-gray-800">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              What's on the agenda today?
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              Describe your coding challenge and let our AI council collaborate
            </p>
          </div>

          {/* Voice Selection Status */}
          <div className="flex items-center justify-center gap-4 mb-6">
            <Badge variant="outline" className="flex items-center gap-1">
              <Brain className="w-3 h-3" />
              {selectedVoices.length} voices selected
            </Badge>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowVoiceSelector(!showVoiceSelector)}
              className="text-purple-600 hover:text-purple-700 dark:text-purple-400"
            >
              {showVoiceSelector ? 'Hide' : 'Configure'} Voice Council
            </Button>
            <Badge variant="secondary" className="capitalize">
              {planTier} Plan
            </Badge>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 p-6 overflow-y-auto">
        <div className="max-w-3xl mx-auto space-y-6">
          {/* Voice Selector */}
          {showVoiceSelector && (
            <Card className="modern-card">
              <CardContent className="p-6">
                <ModernVoiceSelector />
              </CardContent>
            </Card>
          )}

          {/* Prompt Input */}
          <Card className="modern-card">
            <CardContent className="p-6">
              <div className="space-y-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Describe your coding challenge
                </label>
                
                <Textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="Tell us what you're building or the problem you're solving..."
                  className="min-h-[120px] resize-none modern-focus border-gray-300 dark:border-gray-600"
                  disabled={!canGenerate}
                />

                {/* Quick Suggestions */}
                <div className="space-y-2">
                  <p className="text-xs text-gray-500 dark:text-gray-400">Quick suggestions:</p>
                  <div className="flex flex-wrap gap-2">
                    {promptSuggestions.map((suggestion, index) => (
                      <Button
                        key={index}
                        variant="outline"
                        size="sm"
                        className="text-xs h-7 px-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
                        onClick={() => setPrompt(suggestion)}
                      >
                        {suggestion}
                      </Button>
                    ))}
                  </div>
                </div>

                {/* Generation Buttons */}
                <div className="flex gap-3 pt-4">
                  <AppleStyleButton
                    variant="consciousness"
                    className="flex-1"
                    onClick={handleGenerate}
                    disabled={!canGenerate || !prompt.trim()}
                    icon={<Brain className="w-4 h-4" />}
                  >
                    Council Generation
                  </AppleStyleButton>
                  
                  <AppleStyleButton
                    variant="primary"
                    className="flex-1"
                    onClick={handleStreamingGenerate}
                    disabled={!canGenerate || !prompt.trim()}
                    icon={<Zap className="w-4 h-4" />}
                  >
                    Live Streaming
                  </AppleStyleButton>
                </div>

                {/* Help Text */}
                {!prompt.trim() && (
                  <p className="text-sm text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-900/20 p-3 rounded-lg">
                    Describe your coding challenge to get started
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Recent Activity */}
          <Card className="modern-card">
            <CardContent className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Recent Activity
              </h3>
              <div className="space-y-3">
                <div className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-800">
                  <div className="w-8 h-8 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center">
                    <Sparkles className="w-4 h-4 text-green-600 dark:text-green-400" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      Synthesis completed
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Combined 5 voice perspectives into final solution
                    </p>
                  </div>
                  <Button variant="ghost" size="sm" className="h-8 px-2">
                    <MessageSquare className="w-3 h-3" />
                  </Button>
                </div>

                <div className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-800">
                  <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                    <Brain className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      Voice council session
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Explorer, Analyzer & Developer collaborated
                    </p>
                  </div>
                  <Button variant="ghost" size="sm" className="h-8 px-2">
                    <MessageSquare className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}