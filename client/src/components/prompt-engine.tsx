import { Terminal, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Card } from "@/components/ui/card";
import { usePerspectiveSelection } from "@/hooks/use-voice-selection";
import { useSolutionGeneration } from "@/hooks/use-solution-generation";
import { QUICK_PROMPTS, CODE_PERSPECTIVES, DEVELOPMENT_ROLES } from "@/types/voices";

interface PromptEngineProps {
  onSolutionsGenerated: (sessionId: number) => void;
}

export function PromptEngine({ onSolutionsGenerated }: PromptEngineProps) {
  const { 
    state, 
    setPrompt, 
    setAnalysisDepth, 
    setMergeStrategy, 
    toggleQualityFiltering,
    getActiveCount,
    getSelectedItems
  } = usePerspectiveSelection();

  const { generateSession, isGenerating } = useSolutionGeneration();

  const handleGenerateSolutions = async () => {
    if (!state.prompt.trim() || state.selectedPerspectives.length === 0 || state.selectedRoles.length === 0) return;

    try {
      console.log('Starting OpenAI solution generation with:', {
        perspectives: state.selectedPerspectives,
        roles: state.selectedRoles,
        prompt: state.prompt.substring(0, 100) + '...'
      });

      const result = await generateSession.mutateAsync({
        prompt: state.prompt,
        selectedVoices: {
          perspectives: state.selectedPerspectives,
          roles: state.selectedRoles
        },
        recursionDepth: state.analysisDepth,
        synthesisMode: state.mergeStrategy,
        ethicalFiltering: state.qualityFiltering
      });
      
      console.log('OpenAI generation completed, session:', result.session.id);
      onSolutionsGenerated(result.session.id);
    } catch (error) {
      console.error("OpenAI generation failed:", error);
    }
  };

  const getActiveItemsSummary = () => {
    const selectedPerspectives = CODE_PERSPECTIVES.filter(p => 
      state.selectedPerspectives.includes(p.id)
    );
    const selectedRoles = DEVELOPMENT_ROLES.filter(r => 
      state.selectedRoles.includes(r.id)
    );

    return [...selectedPerspectives, ...selectedRoles].slice(0, 3);
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
            <label className="text-sm text-gray-600 dark:text-gray-400">Analysis Depth</label>
            <Select 
              value={state.analysisDepth.toString()} 
              onValueChange={(value) => setAnalysisDepth(parseInt(value) as 1 | 2 | 3)}
            >
              <SelectTrigger className="w-24">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">Quick</SelectItem>
                <SelectItem value="2">Deep</SelectItem>
                <SelectItem value="3">Thorough</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="flex items-center justify-between">
            <label className="text-sm text-gray-600 dark:text-gray-400">Merge Strategy</label>
            <Select value={state.mergeStrategy} onValueChange={setMergeStrategy}>
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
            <label className="text-sm text-gray-600 dark:text-gray-400">Quality Filtering</label>
            <Switch
              checked={state.qualityFiltering}
              onCheckedChange={toggleQualityFiltering}
            />
          </div>
        </div>
      </div>

      {/* Generate Button */}
      <Button
        className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-medium py-3 px-4 rounded-lg transition-all transform hover:scale-[1.02] flex items-center justify-center space-x-2"
        onClick={handleGenerateSolutions}
        disabled={isGenerating || !state.prompt.trim() || getSelectedItems().length === 0}
      >
        <Play className="w-4 h-4" />
        <span>{isGenerating ? "Generating..." : "Generate Solutions"}</span>
      </Button>

      {/* Active Configuration Summary */}
      <Card className="mt-6 p-4 bg-gray-50 dark:bg-gray-700/50">
        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Active Configuration
        </h4>
        <div className="space-y-1 text-xs">
          {getActiveItemsSummary().map((item, index) => (
            <div key={item.id} className="flex items-center space-x-2">
              <div className={`w-2 h-2 bg-${item.color} rounded-full`} />
              <span className={`text-${item.color}`}>{item.name}</span>
              {index === 0 && getActiveCount() > 3 && <span className="text-gray-500">+ others</span>}
            </div>
          ))}
          {getActiveCount() === 0 && (
            <p className="text-gray-500">No perspectives selected</p>
          )}
        </div>
      </Card>
    </div>
  );
}
