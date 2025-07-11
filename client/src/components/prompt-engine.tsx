import { Terminal, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Card } from "@/components/ui/card";
import { useVoiceSelection } from "@/hooks/use-voice-selection";
import { useSolutionGeneration } from "@/hooks/use-solution-generation";
import { QUICK_PROMPTS, TRANSISTHESIS_ARCHETYPES, ENHANCED_CODING_VOICES } from "@/types/voices";

interface PromptEngineProps {
  onSolutionsGenerated: (sessionId: number) => void;
}

export function PromptEngine({ onSolutionsGenerated }: PromptEngineProps) {
  const { 
    state, 
    setPrompt, 
    setRecursionDepth, 
    setSynthesisMode, 
    toggleEthicalFiltering,
    getActiveVoiceCount,
    getSelectedVoices
  } = useVoiceSelection();

  const { generateSession, isGenerating } = useSolutionGeneration();

  const handleGenerateSolutions = async () => {
    if (!state.prompt.trim() || getSelectedVoices().length === 0) return;

    try {
      const result = await generateSession.mutateAsync({
        prompt: state.prompt,
        selectedVoices: getSelectedVoices(),
        recursionDepth: state.recursionDepth,
        synthesisMode: state.synthesisMode,
        ethicalFiltering: state.ethicalFiltering
      });
      
      onSolutionsGenerated(result.session.id);
    } catch (error) {
      console.error("Failed to generate solutions:", error);
    }
  };

  const getActiveVoicesSummary = () => {
    const selectedArchetypes = TRANSISTHESIS_ARCHETYPES.filter(a => 
      state.selectedArchetypes.includes(a.id)
    );
    const selectedCodingVoices = ENHANCED_CODING_VOICES.filter(v => 
      state.selectedCodingVoices.includes(v.id)
    );

    return [...selectedArchetypes, ...selectedCodingVoices].slice(0, 3);
  };

  return (
    <div className="w-1/2 p-6">
      <h3 className="text-lg font-semibold mb-4 flex items-center">
        <Terminal className="w-5 h-5 mr-2 text-gray-600 dark:text-gray-400" />
        Prompt Engine
      </h3>

      {/* Quick Prompts */}
      <div className="mb-6">
        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Quick Prompts</h4>
        <div className="grid grid-cols-1 gap-2">
          {QUICK_PROMPTS.map((prompt, index) => (
            <Button
              key={index}
              variant="ghost"
              className="text-left p-3 text-sm bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 rounded-lg transition-colors h-auto whitespace-normal"
              onClick={() => setPrompt(prompt)}
            >
              {prompt}
            </Button>
          ))}
        </div>
      </div>

      {/* Custom Prompt Input */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Custom Coding Request
        </label>
        <Textarea
          className="w-full h-32 resize-none"
          placeholder="Describe your coding challenge or request..."
          value={state.prompt}
          onChange={(e) => setPrompt(e.target.value)}
        />
      </div>

      {/* Generation Settings */}
      <div className="mb-6">
        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Generation Settings</h4>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-sm text-gray-600 dark:text-gray-400">Recursion Depth</label>
            <Select 
              value={state.recursionDepth.toString()} 
              onValueChange={(value) => setRecursionDepth(parseInt(value) as 1 | 2 | 3)}
            >
              <SelectTrigger className="w-24">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">1 Layer</SelectItem>
                <SelectItem value="2">2 Layers</SelectItem>
                <SelectItem value="3">3 Layers</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="flex items-center justify-between">
            <label className="text-sm text-gray-600 dark:text-gray-400">Synthesis Mode</label>
            <Select value={state.synthesisMode} onValueChange={setSynthesisMode}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="consensus">Consensus</SelectItem>
                <SelectItem value="competitive">Competitive</SelectItem>
                <SelectItem value="collaborative">Collaborative</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="flex items-center justify-between">
            <label className="text-sm text-gray-600 dark:text-gray-400">Ethical Filtering</label>
            <Switch
              checked={state.ethicalFiltering}
              onCheckedChange={toggleEthicalFiltering}
            />
          </div>
        </div>
      </div>

      {/* Generate Button */}
      <Button
        className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-medium py-3 px-4 rounded-lg transition-all transform hover:scale-[1.02] flex items-center justify-center space-x-2"
        onClick={handleGenerateSolutions}
        disabled={isGenerating || !state.prompt.trim() || getSelectedVoices().length === 0}
      >
        <Play className="w-4 h-4" />
        <span>{isGenerating ? "Generating..." : "Generate Multi-Voice Solutions"}</span>
      </Button>

      {/* Active Voice Summary */}
      <Card className="mt-6 p-4 bg-gray-50 dark:bg-gray-700/50">
        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Active Voice Configuration
        </h4>
        <div className="space-y-1 text-xs">
          {getActiveVoicesSummary().map((voice, index) => (
            <div key={voice.id} className="flex items-center space-x-2">
              <div className={`w-2 h-2 bg-${voice.color} rounded-full`} />
              <span className={`text-${voice.color}`}>{voice.name}</span>
              {index === 0 && <span className="text-gray-500">+ others</span>}
            </div>
          ))}
          {getActiveVoiceCount() === 0 && (
            <p className="text-gray-500">No voices selected</p>
          )}
        </div>
      </Card>
    </div>
  );
}
