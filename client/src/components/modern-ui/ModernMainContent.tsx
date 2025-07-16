import { useState } from "react";
import { Brain, Zap, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { ModernVoiceSelector } from "./ModernVoiceSelector";
import { AppleStyleButton } from "./AppleStyleButton";
// Simplified for modern layout implementation
// import { usePlanGuard } from "@/hooks/usePlanGuard";

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
  // Simplified for layout implementation
  const canGenerate = true;

  const handleGenerate = () => {
    if (onGenerate && prompt.trim()) {
      onGenerate(prompt.trim());
    }
  };

  const handleStreamingGenerate = () => {
    if (onStreamingGenerate && prompt.trim()) {
      onStreamingGenerate(prompt.trim());
    }
  };

  return (
    <div className={cn("flex flex-col h-full bg-gray-950", className)}>
      {/* Main Content - Centered vertically like ChatGPT */}
      <div className="flex-1 flex flex-col items-center justify-center px-6">
        <div className="w-full max-w-3xl mx-auto space-y-6">
          {/* Title */}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-semibold text-white mb-3">
              What's on the agenda today?
            </h1>
          </div>

          {/* Prompt Input - ChatGPT Style */}
          <div className="w-full">
            <div className="relative">
              <Textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Ask anything..."
                className="w-full min-h-[120px] resize-none bg-gray-800 border-gray-700 text-white placeholder-gray-400 rounded-xl px-4 py-3 text-base focus:border-gray-600 focus:ring-0 focus:ring-offset-0"
                disabled={!canGenerate}
              />
              
              {/* Voice Configuration Button */}
              <div className="absolute bottom-3 right-3">
                <Button
                  onClick={() => setShowVoiceSelector(!showVoiceSelector)}
                  variant="ghost"
                  size="sm"
                  className="text-gray-400 hover:text-white h-8 w-8 p-0"
                >
                  <Settings className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
          
          {/* Voice Selector - Expandable below input */}
          {showVoiceSelector && (
            <Card className="bg-gray-800 border-gray-700">
              <CardContent className="p-6">
                <ModernVoiceSelector />
              </CardContent>
            </Card>
          )}

          {/* Generation Buttons */}
          <div className="flex gap-3 w-full">
            <AppleStyleButton
              variant="consciousness"
              onClick={handleGenerate}
              disabled={!canGenerate || !prompt.trim()}
              className="flex-1"
              icon={<Brain className="w-4 h-4" />}
            >
              Council Generation
            </AppleStyleButton>
            
            <AppleStyleButton
              variant="primary"
              onClick={handleStreamingGenerate}
              disabled={!canGenerate || !prompt.trim()}
              className="flex-1"
              icon={<Zap className="w-4 h-4" />}
            >
              Live Streaming
            </AppleStyleButton>
          </div>
        </div>
      </div>
    </div>
  );
}