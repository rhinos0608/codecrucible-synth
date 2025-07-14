import { useState, useEffect } from 'react';
import { ChevronDown, Sparkles, Loader2, Brain } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { useAIDropdownSuggestions, AIDropdownSuggestion } from '@/hooks/useAIDropdownSuggestions';

// AI-powered dropdown selector following AI_INSTRUCTIONS.md and CodingPhilosophy.md
interface AIDropdownSelectorProps {
  field: string;
  placeholder: string;
  value: string;
  onValueChange: (value: string) => void;
  context?: string;
  maxSelections?: number;
  isMultiSelect?: boolean;
  selectedValues?: string[];
  onMultiValueChange?: (values: string[]) => void;
  disabled?: boolean;
}

export function AIDropdownSelector({
  field,
  placeholder,
  value,
  onValueChange,
  context = '',
  maxSelections = 1,
  isMultiSelect = false,
  selectedValues = [],
  onMultiValueChange,
  disabled = false
}: AIDropdownSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [hasGeneratedSuggestions, setHasGeneratedSuggestions] = useState(false);
  
  const { suggestions, isLoading, error, generateSuggestions } = useAIDropdownSuggestions();

  // Generate AI suggestions when dropdown opens
  useEffect(() => {
    if (isOpen && !hasGeneratedSuggestions && !disabled) {
      console.log('🤖 Generating AI suggestions for field:', field, 'with context:', context);
      generateSuggestions(field, context);
      setHasGeneratedSuggestions(true);
    }
  }, [isOpen, field, context, hasGeneratedSuggestions, generateSuggestions, disabled]);

  // Filter suggestions based on search term
  const filteredSuggestions = suggestions.filter(suggestion =>
    suggestion.text.toLowerCase().includes(searchTerm.toLowerCase()) ||
    suggestion.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSuggestionSelect = (suggestion: AIDropdownSuggestion) => {
    if (isMultiSelect && onMultiValueChange) {
      const currentValues = selectedValues || [];
      
      if (currentValues.includes(suggestion.text)) {
        // Remove if already selected
        onMultiValueChange(currentValues.filter(v => v !== suggestion.text));
      } else if (maxSelections === -1 || currentValues.length < maxSelections) {
        // Add if under limit
        onMultiValueChange([...currentValues, suggestion.text]);
      }
    } else {
      onValueChange(suggestion.text);
      setIsOpen(false);
    }
  };

  const handleCustomValueSubmit = () => {
    if (searchTerm.trim() && !disabled) {
      if (isMultiSelect && onMultiValueChange) {
        const currentValues = selectedValues || [];
        if (!currentValues.includes(searchTerm.trim()) && 
            (maxSelections === -1 || currentValues.length < maxSelections)) {
          onMultiValueChange([...currentValues, searchTerm.trim()]);
        }
      } else {
        onValueChange(searchTerm.trim());
        setIsOpen(false);
      }
      setSearchTerm('');
    }
  };

  const getConsciousnessIcon = (level: number) => {
    if (level >= 9) return '🔮'; // Archetypal
    if (level >= 7) return '🧠'; // Wisdom
    if (level >= 5) return '💡'; // Practical
    return '⚡'; // Surface
  };

  const getPatternQualityColor = (quality: number) => {
    if (quality >= 8) return 'text-purple-400';
    if (quality >= 6) return 'text-blue-400';
    if (quality >= 4) return 'text-green-400';
    return 'text-gray-400';
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild disabled={disabled}>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={isOpen}
          className="w-full justify-between text-left font-normal"
          disabled={disabled}
        >
          <div className="flex items-center gap-2 flex-1">
            <Brain className="w-4 h-4 text-purple-400" />
            {isMultiSelect && selectedValues && selectedValues.length > 0 ? (
              <div className="flex flex-wrap gap-1">
                {selectedValues.slice(0, 2).map((val, idx) => (
                  <Badge key={idx} variant="secondary" className="text-xs">
                    {val.length > 20 ? `${val.substring(0, 20)}...` : val}
                  </Badge>
                ))}
                {selectedValues.length > 2 && (
                  <Badge variant="secondary" className="text-xs">
                    +{selectedValues.length - 2} more
                  </Badge>
                )}
              </div>
            ) : value ? (
              <span className="truncate">{value}</span>
            ) : (
              <span className="text-muted-foreground">{placeholder}</span>
            )}
          </div>
          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      
      <PopoverContent className="w-[400px] p-0" align="start">
        <div className="border-b p-3">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="w-4 h-4 text-purple-400" />
            <span className="text-sm font-medium">AI-Powered Suggestions</span>
          </div>
          <div className="flex gap-2">
            <Input
              placeholder={`Search or add custom ${field}...`}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleCustomValueSubmit();
                }
              }}
              className="flex-1"
            />
            {searchTerm.trim() && (
              <Button 
                onClick={handleCustomValueSubmit}
                size="sm"
                variant="outline"
              >
                Add
              </Button>
            )}
          </div>
        </div>

        <div className="max-h-[300px] overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center p-6">
              <Loader2 className="w-6 h-6 animate-spin text-purple-400 mr-2" />
              <span className="text-sm text-muted-foreground">
                Generating consciousness-driven suggestions...
              </span>
            </div>
          ) : error ? (
            <div className="p-4 text-center">
              <span className="text-sm text-red-400">Failed to load AI suggestions</span>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => generateSuggestions(field, context)}
                className="mt-2"
              >
                Try Again
              </Button>
            </div>
          ) : filteredSuggestions.length === 0 ? (
            <div className="p-4 text-center">
              <span className="text-sm text-muted-foreground">No suggestions found</span>
            </div>
          ) : (
            <div className="p-2">
              {filteredSuggestions.map((suggestion) => {
                const isSelected = isMultiSelect 
                  ? selectedValues?.includes(suggestion.text)
                  : value === suggestion.text;

                return (
                  <div
                    key={suggestion.id}
                    onClick={() => handleSuggestionSelect(suggestion)}
                    className={`
                      flex items-start gap-3 p-3 rounded-lg cursor-pointer transition-colors
                      hover:bg-gray-100 dark:hover:bg-gray-800
                      ${isSelected ? 'bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-700' : ''}
                    `}
                  >
                    <div className="text-lg">{getConsciousnessIcon(suggestion.consciousness_level)}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-sm truncate">
                          {suggestion.text}
                        </span>
                        <Badge 
                          variant="outline" 
                          className={`text-xs ${getPatternQualityColor(suggestion.pattern_quality)}`}
                        >
                          Q{suggestion.pattern_quality}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {suggestion.description}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="secondary" className="text-xs">
                          {suggestion.category}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          Consciousness: {suggestion.consciousness_level}/10
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {isMultiSelect && maxSelections !== -1 && (
          <div className="border-t p-2">
            <span className="text-xs text-muted-foreground">
              {selectedValues?.length || 0} / {maxSelections} selected
            </span>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}