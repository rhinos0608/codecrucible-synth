// AI-Powered Dropdown Selector - Jung's Descent Protocol Integration
import { useState, useEffect } from "react";
import { ChevronDown, Sparkles, Brain } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Card, CardContent } from "@/components/ui/card";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

interface AISuggestion {
  value: string;
  consciousness: number;
  qwan: number;
  reasoning: string;
}

interface AIDropdownSelectorProps {
  field: string;
  placeholder: string;
  value: string;
  onValueChange: (value: string) => void;
  context?: string;
  examples?: string[];
  className?: string;
}

export function AIDropdownSelector({
  field,
  placeholder,
  value,
  onValueChange,
  context,
  examples = [],
  className = ""
}: AIDropdownSelectorProps) {
  const [suggestions, setSuggestions] = useState<AISuggestion[]>([]);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // OpenAI AI-powered suggestions following CodingPhilosophy.md consciousness principles
  const generateSuggestions = useMutation({
    mutationFn: async (requestData: { field: string; context: string }) => {
      console.log('🤖 Generating AI suggestions for:', requestData);
      const response = await apiRequest('/api/ai/dropdown-suggestions', {
        method: 'POST',
        body: requestData
      });
      return response.suggestions || [];
    },
    onSuccess: (data: AISuggestion[]) => {
      setSuggestions(data);
      setShowSuggestions(true);
    },
    onError: (error) => {
      console.error('AI suggestion generation failed:', error);
      // Fallback to examples if OpenAI fails
      if (examples.length > 0) {
        const fallbackSuggestions = examples.slice(0, 4).map(example => ({
          value: example,
          consciousness: 5,
          qwan: 7,
          reasoning: "Predefined example with proven effectiveness"
        }));
        setSuggestions(fallbackSuggestions);
        setShowSuggestions(true);
      }
    }
  });

  const handleGenerateSuggestions = () => {
    if (!context) return;
    
    setIsLoadingSuggestions(true);
    generateSuggestions.mutate({
      field,
      context: context || `Field: ${field}`
    });
  };

  const handleSelectSuggestion = (suggestion: AISuggestion) => {
    onValueChange(suggestion.value);
    setShowSuggestions(false);
  };

  const getConsciousnessColor = (level: number) => {
    if (level >= 8) return "text-purple-600 dark:text-purple-400";
    if (level >= 6) return "text-blue-600 dark:text-blue-400";
    if (level >= 4) return "text-green-600 dark:text-green-400";
    return "text-yellow-600 dark:text-yellow-400";
  };

  const getQwanColor = (score: number) => {
    if (score >= 8) return "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300";
    if (score >= 6) return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300";
    if (score >= 4) return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300";
    return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300";
  };

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="flex items-center gap-2">
        <Input
          value={value}
          onChange={(e) => onValueChange(e.target.value)}
          placeholder={placeholder}
          className="flex-1 bg-gray-50 dark:bg-gray-800"
        />
        <Popover open={showSuggestions} onOpenChange={setShowSuggestions}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              onClick={handleGenerateSuggestions}
              disabled={!context || isLoadingSuggestions}
              className="shrink-0"
            >
              {isLoadingSuggestions ? (
                <Brain className="w-4 h-4 animate-pulse" />
              ) : (
                <Sparkles className="w-4 h-4" />
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-96 p-0" align="end">
            <div className="p-4 border-b">
              <div className="flex items-center gap-2">
                <Brain className="w-4 h-4 text-purple-600" />
                <span className="text-sm font-medium">AI Consciousness Suggestions</span>
                <Badge variant="secondary" className="text-xs">Jung's Descent</Badge>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Generated using multi-layered consciousness analysis
              </p>
            </div>
            <div className="max-h-80 overflow-y-auto">
              {suggestions.map((suggestion, index) => (
                <Card
                  key={index}
                  className="m-2 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                  onClick={() => handleSelectSuggestion(suggestion)}
                >
                  <CardContent className="p-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <p className="text-sm font-medium">{suggestion.value}</p>
                        <p className="text-xs text-gray-500 mt-1">{suggestion.reasoning}</p>
                        <div className="flex items-center gap-2 mt-2">
                          <Badge
                            variant="outline"
                            className={`text-xs ${getConsciousnessColor(suggestion.consciousness)}`}
                          >
                            C: {suggestion.consciousness}/10
                          </Badge>
                          <Badge
                            variant="secondary"
                            className={`text-xs ${getQwanColor(suggestion.qwan)}`}
                          >
                            QWAN: {suggestion.qwan}/10
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
              
              {suggestions.length === 0 && !isLoadingSuggestions && (
                <div className="p-4 text-center text-gray-500">
                  <Brain className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Click the sparkles button to generate AI suggestions</p>
                </div>
              )}
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {examples.length > 0 && (
        <div className="space-y-2">
          <Label className="text-xs text-gray-500">Quick Examples:</Label>
          <Select onValueChange={onValueChange}>
            <SelectTrigger className="bg-gray-50 dark:bg-gray-800 text-sm">
              <SelectValue placeholder="Choose from examples" />
            </SelectTrigger>
            <SelectContent>
              {examples.map((example, index) => (
                <SelectItem key={index} value={example} className="text-sm">
                  {example}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  );
}