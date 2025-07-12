import { useState, useCallback, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Brain, Users, Lightbulb, Target, CheckCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { CODE_PERSPECTIVES, DEVELOPMENT_ROLES } from "@/types/voices";
import { motion, AnimatePresence } from "framer-motion";

// Following AI_INSTRUCTIONS.md: Strict TypeScript, proper error handling
interface VoiceProfile {
  id: string;
  name: string;
  description: string;
  philosophy: string;
  approach: string;
  example: string;
}

interface CouncilStep {
  phase: 'introduction' | 'voice-gathering' | 'dialogue' | 'synthesis' | 'celebration';
  progress: number;
  completed: boolean;
}

// Following CodingPhilosophy.md: Living spiral patterns
const COUNCIL_PHASES = [
  { name: 'Collapse Recognition', description: 'Acknowledge the complexity' },
  { name: 'Voice Assembly', description: 'Gather relevant perspectives' },
  { name: 'Council Dialogue', description: 'Multi-voice collaboration' },
  { name: 'Synthesis Creation', description: 'Emerge unified solution' },
  { name: 'Rebirth Celebration', description: 'Transform understanding' },
];

export function VoiceCouncilSimulator() {
  const { toast } = useToast();
  const [currentStep, setCurrentStep] = useState<CouncilStep>({
    phase: 'introduction',
    progress: 0,
    completed: false,
  });
  const [selectedVoices, setSelectedVoices] = useState<string[]>([]);
  const [councilDialogue, setCouncilDialogue] = useState<Array<{
    voice: string;
    message: string;
    timestamp: Date;
  }>>([]);

  // Following AI_INSTRUCTIONS.md: Performance optimization
  const handleVoiceSelection = useCallback((voiceId: string) => {
    setSelectedVoices(prev => 
      prev.includes(voiceId) 
        ? prev.filter(id => id !== voiceId)
        : [...prev, voiceId]
    );
  }, []);

  // Following CodingPhilosophy.md: Spiral consciousness patterns
  const simulateCouncilDialogue = useCallback(async () => {
    if (selectedVoices.length < 2) {
      toast({
        title: "Council Requires Multiple Voices",
        description: "Select at least 2 voices to simulate council dialogue",
        variant: "destructive",
      });
      return;
    }

    setCurrentStep(prev => ({ ...prev, phase: 'dialogue' }));

    // Simulate council conversation following spiral patterns
    const dialogueSequence = [
      {
        voice: selectedVoices[0],
        message: "I perceive this challenge from my perspective...",
        timestamp: new Date(),
      },
      {
        voice: selectedVoices[1],
        message: "Your approach has merit, and I would add...",
        timestamp: new Date(Date.now() + 1000),
      },
      {
        voice: 'synthesis',
        message: "Emerging synthesis: Combining both perspectives reveals...",
        timestamp: new Date(Date.now() + 2000),
      },
    ];

    for (const dialogue of dialogueSequence) {
      await new Promise(resolve => setTimeout(resolve, 1500));
      setCouncilDialogue(prev => [...prev, dialogue]);
    }

    setCurrentStep(prev => ({ ...prev, phase: 'synthesis', progress: 75 }));
  }, [selectedVoices, toast]);

  // Following AI_INSTRUCTIONS.md: Accessibility compliance
  const voiceProfiles: VoiceProfile[] = [
    {
      id: 'explorer',
      name: 'Explorer',
      description: 'Seeks alternatives and investigates possibilities',
      philosophy: 'What if we approached this completely differently?',
      approach: 'Question assumptions, explore edge cases, discover new paths',
      example: 'Instead of standard auth, what about passwordless magic links?',
    },
    {
      id: 'maintainer',
      name: 'Maintainer',
      description: 'Ensures long-term sustainability and quality',
      philosophy: 'How will this feel in 6 months?',
      approach: 'Focus on maintainability, documentation, and team onboarding',
      example: 'This auth system needs clear error messages and migration paths',
    },
    {
      id: 'analyzer',
      name: 'Analyzer',
      description: 'Breaks down complexity and identifies patterns',
      philosophy: 'What are the underlying patterns here?',
      approach: 'Systematic analysis, risk assessment, pattern recognition',
      example: 'This auth flow has 3 security vectors we need to validate',
    },
  ];

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      {/* Following CodingPhilosophy.md: Mythic narrative integration */}
      <Card className="border-purple-200 bg-purple-50 dark:bg-purple-950 dark:border-purple-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="w-6 h-6 text-purple-600" />
            Voice Council Simulator
          </CardTitle>
          <p className="text-muted-foreground">
            Experience the transformation from single-voice AI prompting to council-based collaborative development
          </p>
        </CardHeader>
      </Card>

      {/* Progress Tracking */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Council Assembly Progress</h3>
            <Badge variant="outline">{currentStep.phase}</Badge>
          </div>
          <Progress value={currentStep.progress} className="mb-4" />
          <div className="grid grid-cols-5 gap-2">
            {COUNCIL_PHASES.map((phase, index) => (
              <div
                key={phase.name}
                className={`text-center p-2 rounded-lg border ${
                  index <= COUNCIL_PHASES.findIndex(p => p.name.toLowerCase().includes(currentStep.phase))
                    ? 'bg-purple-100 border-purple-300 dark:bg-purple-900'
                    : 'bg-gray-50 border-gray-200 dark:bg-gray-800'
                }`}
              >
                <div className="text-xs font-medium">{phase.name}</div>
                <div className="text-xs text-muted-foreground mt-1">{phase.description}</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="voices" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="voices">Voice Archetypes</TabsTrigger>
          <TabsTrigger value="council">Council Assembly</TabsTrigger>
          <TabsTrigger value="synthesis">Synthesis Workshop</TabsTrigger>
        </TabsList>

        {/* Voice Introduction Tab */}
        <TabsContent value="voices" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {voiceProfiles.map((voice) => (
              <motion.div
                key={voice.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
              >
                <Card 
                  className={`cursor-pointer transition-all hover:shadow-lg ${
                    selectedVoices.includes(voice.id)
                      ? 'ring-2 ring-purple-500 bg-purple-50 dark:bg-purple-950'
                      : ''
                  }`}
                  onClick={() => handleVoiceSelection(voice.id)}
                >
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      {voice.name}
                      {selectedVoices.includes(voice.id) && (
                        <CheckCircle className="w-5 h-5 text-purple-600" />
                      )}
                    </CardTitle>
                    <p className="text-sm text-muted-foreground">{voice.description}</p>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div>
                        <h4 className="text-sm font-medium mb-1">Philosophy</h4>
                        <p className="text-sm italic text-purple-700 dark:text-purple-300">
                          "{voice.philosophy}"
                        </p>
                      </div>
                      <div>
                        <h4 className="text-sm font-medium mb-1">Approach</h4>
                        <p className="text-sm">{voice.approach}</p>
                      </div>
                      <div>
                        <h4 className="text-sm font-medium mb-1">Example</h4>
                        <p className="text-sm text-blue-700 dark:text-blue-300">
                          {voice.example}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </TabsContent>

        {/* Council Assembly Tab */}
        <TabsContent value="council" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                Active Council
              </CardTitle>
            </CardHeader>
            <CardContent>
              {selectedVoices.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  Select voices from the Voice Archetypes tab to begin assembly
                </p>
              ) : (
                <div className="space-y-4">
                  <div className="flex flex-wrap gap-2">
                    {selectedVoices.map(voiceId => (
                      <Badge key={voiceId} variant="secondary">
                        {voiceProfiles.find(v => v.id === voiceId)?.name}
                      </Badge>
                    ))}
                  </div>
                  
                  <Button 
                    onClick={simulateCouncilDialogue}
                    disabled={selectedVoices.length < 2}
                    className="w-full"
                  >
                    Begin Council Dialogue
                  </Button>

                  <AnimatePresence>
                    {councilDialogue.length > 0 && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="space-y-3"
                      >
                        <h4 className="font-medium">Council Dialogue</h4>
                        {councilDialogue.map((dialogue, index) => (
                          <motion.div
                            key={index}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: index * 0.2 }}
                            className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3"
                          >
                            <div className="flex items-center gap-2 mb-1">
                              <Badge variant="outline" size="sm">
                                {dialogue.voice}
                              </Badge>
                              <span className="text-xs text-muted-foreground">
                                {dialogue.timestamp.toLocaleTimeString()}
                              </span>
                            </div>
                            <p className="text-sm">{dialogue.message}</p>
                          </motion.div>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Synthesis Tab */}
        <TabsContent value="synthesis" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lightbulb className="w-5 h-5" />
                Synthesis Workshop
              </CardTitle>
            </CardHeader>
            <CardContent>
              {currentStep.phase === 'synthesis' ? (
                <div className="space-y-4">
                  <div className="bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg p-4">
                    <h4 className="font-medium text-green-800 dark:text-green-200 mb-2">
                      Synthesis Emerging
                    </h4>
                    <p className="text-sm text-green-700 dark:text-green-300">
                      The council voices have converged into a unified understanding. 
                      This synthesis represents the wisdom of multiple perspectives 
                      integrated into actionable insight.
                    </p>
                  </div>
                  
                  <Button 
                    onClick={() => {
                      setCurrentStep(prev => ({ 
                        ...prev, 
                        phase: 'celebration', 
                        progress: 100, 
                        completed: true 
                      }));
                      toast({
                        title: "Council Assembly Complete!",
                        description: "You've experienced the power of multi-voice collaboration",
                      });
                    }}
                    className="w-full"
                  >
                    Complete Council Assembly
                  </Button>
                </div>
              ) : (
                <p className="text-muted-foreground text-center py-8">
                  Complete the council dialogue to access synthesis workshop
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Celebration Phase */}
      <AnimatePresence>
        {currentStep.phase === 'celebration' && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
          >
            <Card className="border-green-200 bg-green-50 dark:bg-green-950 dark:border-green-800">
              <CardContent className="pt-6 text-center">
                <Target className="w-12 h-12 text-green-600 mx-auto mb-4" />
                <h3 className="text-xl font-bold text-green-800 dark:text-green-200 mb-2">
                  Transformation Complete!
                </h3>
                <p className="text-green-700 dark:text-green-300 mb-4">
                  You've experienced the shift from single-voice AI prompting to 
                  council-based collaborative development. This is the foundation 
                  of conscious code creation.
                </p>
                <Button variant="outline" className="mt-2">
                  Continue to Advanced Training
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}