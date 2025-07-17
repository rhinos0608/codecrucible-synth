// Enhanced Voice Recommender - Following CrewAI patterns and OpenAI Realtime API research
// Implements AI multi-agent role-based voice selection with consciousness-driven recommendations

import { useState, useEffect, useCallback } from "react";
import { Brain, Zap, Users, Target, Lightbulb, AlertTriangle, TrendingUp, Star } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

// Voice archetypes based on CrewAI role patterns and Jung's individuation
interface VoiceArchetype {
  id: string;
  name: string;
  role: 'researcher' | 'analyst' | 'developer' | 'reviewer' | 'synthesizer';
  personality: string;
  strengths: string[];
  idealFor: string[];
  consciousness: number;
  collaborationStyle: 'independent' | 'supportive' | 'challenging' | 'integrative';
  expertise: string[];
  decisionPattern: 'rapid' | 'deliberate' | 'consensus' | 'innovative';
}

interface VoiceRecommendation {
  archetype: VoiceArchetype;
  confidence: number;
  reasoning: string;
  contextMatch: number;
  collaborationPotential: number;
  noveltyScore: number;
  synergyWith: string[];
}

interface ProjectContext {
  type: 'frontend' | 'backend' | 'fullstack' | 'devops' | 'design' | 'research';
  complexity: number;
  timeline: 'urgent' | 'normal' | 'exploratory';
  teamSize: number;
  existingVoices: string[];
  requirements: string[];
  successCriteria: string[];
}

interface EnhancedVoiceRecommenderProps {
  projectContext?: ProjectContext;
  currentVoices: string[];
  onVoiceRecommended: (recommendation: VoiceRecommendation) => void;
  isOpen: boolean;
}

export function EnhancedVoiceRecommender({
  projectContext,
  currentVoices = [],
  onVoiceRecommended,
  isOpen
}: EnhancedVoiceRecommenderProps) {
  const { toast } = useToast();
  const [recommendations, setRecommendations] = useState<VoiceRecommendation[]>([]);
  const [analysisMode, setAnalysisMode] = useState<'adaptive' | 'strategic' | 'experimental'>('adaptive');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [selectedRecommendation, setSelectedRecommendation] = useState<VoiceRecommendation | null>(null);

  // Voice archetypes based on research findings
  const voiceArchetypes: VoiceArchetype[] = [
    {
      id: 'explorer',
      name: 'Explorer',
      role: 'researcher',
      personality: 'Curious, experimental, boundary-pushing',
      strengths: ['Innovation', 'Problem discovery', 'Creative solutions', 'Risk tolerance'],
      idealFor: ['New projects', 'Proof of concepts', 'Research phases', 'Breakthrough thinking'],
      consciousness: 8,
      collaborationStyle: 'independent',
      expertise: ['Emerging technologies', 'Experimental patterns', 'Innovation methods'],
      decisionPattern: 'innovative'
    },
    {
      id: 'maintainer',
      name: 'Maintainer',
      role: 'reviewer',
      personality: 'Stable, reliable, quality-focused',
      strengths: ['Code quality', 'Best practices', 'Documentation', 'Long-term thinking'],
      idealFor: ['Production systems', 'Refactoring', 'Documentation', 'Quality assurance'],
      consciousness: 6,
      collaborationStyle: 'supportive',
      expertise: ['Code review', 'Architecture patterns', 'Testing strategies'],
      decisionPattern: 'deliberate'
    },
    {
      id: 'analyzer',
      name: 'Analyzer',
      role: 'analyst',
      personality: 'Logical, systematic, detail-oriented',
      strengths: ['Data analysis', 'Performance optimization', 'Debugging', 'Pattern recognition'],
      idealFor: ['Optimization tasks', 'Bug fixing', 'Performance tuning', 'Data processing'],
      consciousness: 7,
      collaborationStyle: 'challenging',
      expertise: ['Performance analysis', 'Debugging techniques', 'Data structures'],
      decisionPattern: 'deliberate'
    },
    {
      id: 'developer',
      name: 'Developer',
      role: 'developer',
      personality: 'Practical, efficient, solution-oriented',
      strengths: ['Rapid development', 'Implementation', 'User experience', 'Feature completion'],
      idealFor: ['Feature development', 'UI/UX work', 'API integration', 'Rapid prototyping'],
      consciousness: 6,
      collaborationStyle: 'supportive',
      expertise: ['Frontend frameworks', 'API design', 'User interfaces'],
      decisionPattern: 'rapid'
    },
    {
      id: 'implementor',
      name: 'Implementor',
      role: 'developer',
      personality: 'Action-oriented, pragmatic, delivery-focused',
      strengths: ['Execution', 'Deployment', 'Integration', 'Workflow optimization'],
      idealFor: ['Sprint completion', 'Integration tasks', 'Deployment', 'Process improvement'],
      consciousness: 5,
      collaborationStyle: 'supportive',
      expertise: ['DevOps', 'CI/CD', 'System integration'],
      decisionPattern: 'rapid'
    },
    {
      id: 'synthesizer',
      name: 'Synthesizer',
      role: 'synthesizer',
      personality: 'Holistic, integrative, pattern-seeking',
      strengths: ['Big picture thinking', 'Integration', 'Conflict resolution', 'Vision alignment'],
      idealFor: ['Architecture decisions', 'Team coordination', 'Complex integration', 'Strategic planning'],
      consciousness: 9,
      collaborationStyle: 'integrative',
      expertise: ['System architecture', 'Team dynamics', 'Strategic thinking'],
      decisionPattern: 'consensus'
    }
  ];

  // Intelligent voice recommendation based on context and research patterns
  const generateRecommendations = useCallback(async () => {
    if (!projectContext) return;

    setIsAnalyzing(true);
    
    try {
      // Phase 1: Context Analysis (following CrewAI research patterns)
      const contextScore = analyzeProjectContext(projectContext);
      
      // Phase 2: Voice Synergy Analysis
      const synergyMatrix = calculateVoiceSynergy(currentVoices);
      
      // Phase 3: Consciousness-Driven Scoring
      const consciousnessScores = assessConsciousnessAlignment(projectContext, analysisMode);
      
      // Phase 4: Generate Recommendations
      const newRecommendations = voiceArchetypes
        .filter(archetype => !currentVoices.includes(archetype.id))
        .map(archetype => {
          const confidence = calculateConfidence(archetype, contextScore, synergyMatrix, consciousnessScores);
          const reasoning = generateReasoning(archetype, projectContext, confidence);
          const collaborationPotential = assessCollaborationPotential(archetype, currentVoices);
          const noveltyScore = calculateNoveltyScore(archetype, currentVoices);
          
          return {
            archetype,
            confidence,
            reasoning,
            contextMatch: contextScore[archetype.id] || 0,
            collaborationPotential,
            noveltyScore,
            synergyWith: findSynergyPartners(archetype, currentVoices, synergyMatrix)
          };
        })
        .sort((a, b) => b.confidence - a.confidence)
        .slice(0, 3);

      setRecommendations(newRecommendations);
      
      if (newRecommendations.length > 0) {
        toast({
          title: "Voice Recommendations Ready",
          description: `Found ${newRecommendations.length} optimal voice matches for your project`,
        });
      }
      
    } catch (error) {
      console.error('Voice recommendation error:', error);
      toast({
        title: "Recommendation Error",
        description: "Failed to generate voice recommendations. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsAnalyzing(false);
    }
  }, [projectContext, currentVoices, analysisMode, toast]);

  // Context analysis following AutoGen conversational patterns
  const analyzeProjectContext = (context: ProjectContext): Record<string, number> => {
    const scores: Record<string, number> = {};
    
    voiceArchetypes.forEach(archetype => {
      let score = 50; // Base score
      
      // Complexity alignment
      if (context.complexity > 7 && archetype.consciousness > 7) score += 20;
      if (context.complexity < 4 && archetype.decisionPattern === 'rapid') score += 15;
      
      // Timeline alignment
      if (context.timeline === 'urgent' && archetype.decisionPattern === 'rapid') score += 25;
      if (context.timeline === 'exploratory' && archetype.role === 'researcher') score += 20;
      
      // Project type alignment
      const typeMapping = {
        frontend: ['developer', 'implementor'],
        backend: ['developer', 'analyst'],
        fullstack: ['synthesizer', 'developer'],
        devops: ['implementor', 'maintainer'],
        design: ['developer', 'explorer'],
        research: ['explorer', 'researcher']
      };
      
      if (typeMapping[context.type]?.includes(archetype.role)) score += 30;
      
      // Team size considerations
      if (context.teamSize === 1 && archetype.collaborationStyle === 'independent') score += 10;
      if (context.teamSize > 3 && archetype.collaborationStyle === 'integrative') score += 15;
      
      scores[archetype.id] = Math.min(100, Math.max(0, score));
    });
    
    return scores;
  };

  // Calculate voice synergy matrix based on LangGraph patterns
  const calculateVoiceSynergy = (voices: string[]): Record<string, Record<string, number>> => {
    const matrix: Record<string, Record<string, number>> = {};
    
    // Synergy patterns based on research
    const synergyRules = {
      explorer: { maintainer: 0.8, synthesizer: 0.9, analyzer: 0.6 },
      maintainer: { developer: 0.9, implementor: 0.8, analyzer: 0.7 },
      analyzer: { developer: 0.8, explorer: 0.6, synthesizer: 0.7 },
      developer: { implementor: 0.9, maintainer: 0.8, synthesizer: 0.7 },
      implementor: { developer: 0.9, maintainer: 0.8, analyzer: 0.6 },
      synthesizer: { explorer: 0.9, analyzer: 0.7, maintainer: 0.6 }
    };
    
    voiceArchetypes.forEach(archetype => {
      matrix[archetype.id] = synergyRules[archetype.id] || {};
    });
    
    return matrix;
  };

  // Consciousness alignment assessment
  const assessConsciousnessAlignment = (context: ProjectContext, mode: string): Record<string, number> => {
    const scores: Record<string, number> = {};
    
    voiceArchetypes.forEach(archetype => {
      let alignmentScore = archetype.consciousness * 10;
      
      // Mode-specific adjustments
      switch (mode) {
        case 'adaptive':
          alignmentScore += archetype.collaborationStyle === 'supportive' ? 15 : 0;
          break;
        case 'strategic':
          alignmentScore += archetype.consciousness > 7 ? 20 : -10;
          break;
        case 'experimental':
          alignmentScore += archetype.role === 'researcher' ? 25 : 0;
          break;
      }
      
      scores[archetype.id] = alignmentScore;
    });
    
    return scores;
  };

  // Calculate overall confidence score
  const calculateConfidence = (
    archetype: VoiceArchetype,
    contextScores: Record<string, number>,
    synergyMatrix: Record<string, Record<string, number>>,
    consciousnessScores: Record<string, number>
  ): number => {
    const contextScore = contextScores[archetype.id] || 0;
    const consciousnessScore = consciousnessScores[archetype.id] || 0;
    
    // Calculate synergy bonus
    let synergyBonus = 0;
    currentVoices.forEach(voiceId => {
      synergyBonus += (synergyMatrix[archetype.id]?.[voiceId] || 0) * 10;
    });
    
    // Weighted confidence calculation
    const confidence = Math.round(
      (contextScore * 0.4) +
      (consciousnessScore * 0.3) +
      (synergyBonus * 0.2) +
      (archetype.consciousness * 0.1)
    );
    
    return Math.min(100, Math.max(0, confidence));
  };

  // Generate human-readable reasoning
  const generateReasoning = (
    archetype: VoiceArchetype,
    context: ProjectContext,
    confidence: number
  ): string => {
    const reasons = [];
    
    if (confidence > 80) {
      reasons.push(`${archetype.name} is highly suited for ${context.type} projects`);
    }
    
    if (context.timeline === 'urgent' && archetype.decisionPattern === 'rapid') {
      reasons.push('Excellent for urgent timeline with rapid decision-making');
    }
    
    if (context.complexity > 7 && archetype.consciousness > 7) {
      reasons.push('High consciousness level matches project complexity');
    }
    
    if (currentVoices.length > 0) {
      reasons.push(`Strong collaboration potential with existing team`);
    }
    
    return reasons.length > 0 ? reasons.join('. ') : `${archetype.name} brings valuable ${archetype.strengths[0].toLowerCase()} capabilities`;
  };

  // Assess collaboration potential
  const assessCollaborationPotential = (archetype: VoiceArchetype, existingVoices: string[]): number => {
    if (existingVoices.length === 0) return 100;
    
    let potential = 0;
    existingVoices.forEach(voiceId => {
      const existingArchetype = voiceArchetypes.find(a => a.id === voiceId);
      if (existingArchetype) {
        // Calculate compatibility based on collaboration styles
        const styleCompatibility = {
          independent: { supportive: 0.8, challenging: 0.6, integrative: 0.7 },
          supportive: { independent: 0.8, challenging: 0.5, integrative: 0.9 },
          challenging: { independent: 0.6, supportive: 0.5, integrative: 0.8 },
          integrative: { independent: 0.7, supportive: 0.9, challenging: 0.8 }
        };
        
        potential += (styleCompatibility[archetype.collaborationStyle]?.[existingArchetype.collaborationStyle] || 0.5) * 100;
      }
    });
    
    return Math.round(potential / existingVoices.length);
  };

  // Calculate novelty score
  const calculateNoveltyScore = (archetype: VoiceArchetype, existingVoices: string[]): number => {
    const existingRoles = existingVoices.map(voiceId => 
      voiceArchetypes.find(a => a.id === voiceId)?.role
    ).filter(Boolean);
    
    const roleNovelty = existingRoles.includes(archetype.role) ? 20 : 80;
    const consciousnessNovelty = Math.abs(archetype.consciousness - 6) * 10;
    
    return Math.round((roleNovelty + consciousnessNovelty) / 2);
  };

  // Find synergy partners
  const findSynergyPartners = (
    archetype: VoiceArchetype,
    existingVoices: string[],
    synergyMatrix: Record<string, Record<string, number>>
  ): string[] => {
    return existingVoices.filter(voiceId => 
      (synergyMatrix[archetype.id]?.[voiceId] || 0) > 0.7
    );
  };

  // Auto-generate recommendations when context changes
  useEffect(() => {
    if (isOpen && projectContext) {
      generateRecommendations();
    }
  }, [isOpen, projectContext, generateRecommendations]);

  const handleAcceptRecommendation = (recommendation: VoiceRecommendation) => {
    onVoiceRecommended(recommendation);
    toast({
      title: "Voice Added",
      description: `${recommendation.archetype.name} has been added to your project team`,
    });
  };

  if (!isOpen || !projectContext) return null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="border-blue-500/20 bg-gradient-to-r from-blue-500/5 to-purple-500/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-blue-500 to-purple-500 rounded-lg">
              <Brain className="w-5 h-5 text-white" />
            </div>
            <div>
              <span className="text-lg font-semibold">Enhanced Voice Recommender</span>
              <p className="text-sm text-gray-600 dark:text-gray-400 font-normal">
                AI-powered voice selection based on project context and team dynamics
              </p>
            </div>
          </CardTitle>
        </CardHeader>
      </Card>

      {/* Analysis Mode Selector */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Analysis Mode</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            {[
              { id: 'adaptive', name: 'Adaptive', desc: 'Balanced recommendations' },
              { id: 'strategic', name: 'Strategic', desc: 'Long-term focused' },
              { id: 'experimental', name: 'Experimental', desc: 'Innovation focused' }
            ].map(mode => (
              <Button
                key={mode.id}
                variant={analysisMode === mode.id ? "default" : "outline"}
                size="sm"
                onClick={() => setAnalysisMode(mode.id as any)}
                className="flex-1"
              >
                <div className="text-center">
                  <div className="font-medium">{mode.name}</div>
                  <div className="text-xs opacity-70">{mode.desc}</div>
                </div>
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Recommendations */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Voice Recommendations</h3>
          <Button
            onClick={generateRecommendations}
            disabled={isAnalyzing}
            variant="outline"
            size="sm"
          >
            {isAnalyzing ? (
              <>
                <Brain className="w-4 h-4 mr-2 animate-pulse" />
                Analyzing...
              </>
            ) : (
              <>
                <TrendingUp className="w-4 h-4 mr-2" />
                Refresh
              </>
            )}
          </Button>
        </div>

        {recommendations.map((recommendation, index) => (
          <Card key={recommendation.archetype.id} className="hover:shadow-md transition-shadow">
            <CardContent className="p-6">
              <div className="space-y-4">
                {/* Header */}
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-500 rounded-lg flex items-center justify-center">
                      <span className="text-white font-bold text-lg">
                        {recommendation.archetype.name.charAt(0)}
                      </span>
                    </div>
                    <div>
                      <h4 className="text-lg font-semibold">{recommendation.archetype.name}</h4>
                      <p className="text-sm text-gray-600 dark:text-gray-400 capitalize">
                        {recommendation.archetype.role} • {recommendation.archetype.collaborationStyle}
                      </p>
                    </div>
                  </div>
                  
                  <div className="text-right">
                    <div className="flex items-center gap-1 mb-1">
                      <Star className="w-4 h-4 text-yellow-500" />
                      <span className="font-semibold">{recommendation.confidence}%</span>
                    </div>
                    <Badge variant={recommendation.confidence > 80 ? "default" : "secondary"}>
                      {index === 0 ? "Top Pick" : `Rank #${index + 1}`}
                    </Badge>
                  </div>
                </div>

                {/* Scores */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span>Context Match</span>
                      <span>{recommendation.contextMatch}%</span>
                    </div>
                    <Progress value={recommendation.contextMatch} className="h-1" />
                  </div>
                  
                  <div className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span>Team Synergy</span>
                      <span>{recommendation.collaborationPotential}%</span>
                    </div>
                    <Progress value={recommendation.collaborationPotential} className="h-1" />
                  </div>
                  
                  <div className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span>Novelty</span>
                      <span>{recommendation.noveltyScore}%</span>
                    </div>
                    <Progress value={recommendation.noveltyScore} className="h-1" />
                  </div>
                </div>

                {/* Reasoning */}
                <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded text-sm">
                  <p className="font-medium mb-1">Why this voice?</p>
                  <p>{recommendation.reasoning}</p>
                </div>

                {/* Strengths */}
                <div className="space-y-2">
                  <span className="text-sm font-medium">Key Strengths</span>
                  <div className="flex flex-wrap gap-1">
                    {recommendation.archetype.strengths.slice(0, 4).map(strength => (
                      <Badge key={strength} variant="outline" className="text-xs">
                        {strength}
                      </Badge>
                    ))}
                  </div>
                </div>

                {/* Synergy Partners */}
                {recommendation.synergyWith.length > 0 && (
                  <div className="space-y-2">
                    <span className="text-sm font-medium">Works well with</span>
                    <div className="flex flex-wrap gap-1">
                      {recommendation.synergyWith.map(voiceId => {
                        const partner = voiceArchetypes.find(a => a.id === voiceId);
                        return partner ? (
                          <Badge key={voiceId} variant="secondary" className="text-xs">
                            {partner.name}
                          </Badge>
                        ) : null;
                      })}
                    </div>
                  </div>
                )}

                {/* Action */}
                <div className="flex gap-2 pt-2">
                  <Button
                    onClick={() => handleAcceptRecommendation(recommendation)}
                    className="flex-1"
                    variant={index === 0 ? "default" : "outline"}
                  >
                    <Users className="w-4 h-4 mr-2" />
                    Add to Team
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedRecommendation(recommendation)}
                  >
                    Details
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}

        {recommendations.length === 0 && !isAnalyzing && (
          <Card>
            <CardContent className="p-6 text-center">
              <AlertTriangle className="w-8 h-8 mx-auto mb-3 text-gray-400" />
              <h4 className="font-medium mb-2">No Recommendations Available</h4>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                All suitable voices are already part of your team, or project context needs more information.
              </p>
              <Button onClick={generateRecommendations} variant="outline" size="sm">
                <Brain className="w-4 h-4 mr-2" />
                Regenerate Recommendations
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}