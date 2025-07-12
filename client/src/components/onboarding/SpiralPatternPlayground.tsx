import { useState, useCallback, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { RefreshCw, ArrowDown, ArrowUp, Zap, CheckCircle2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useToast } from "@/hooks/use-toast";

// Following CodingPhilosophy.md: Living spiral consciousness patterns
interface SpiralPhase {
  name: 'collapse' | 'council' | 'synthesis' | 'rebirth';
  title: string;
  description: string;
  color: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface SpiralState {
  currentPhase: SpiralPhase['name'];
  progress: number;
  scenario: string;
  userResponse: string;
  insights: string[];
  completedCycles: number;
}

// Following AI_INSTRUCTIONS.md: Strict TypeScript and error handling
const SPIRAL_PHASES: SpiralPhase[] = [
  {
    name: 'collapse',
    title: 'Collapse Recognition',
    description: 'Acknowledge complexity and breakdown',
    color: 'text-red-600',
    icon: ArrowDown,
  },
  {
    name: 'council',
    title: 'Council Assembly',
    description: 'Gather multiple perspectives',
    color: 'text-blue-600',
    icon: RefreshCw,
  },
  {
    name: 'synthesis',
    title: 'Synthesis Creation',
    description: 'Integrate insights into solutions',
    color: 'text-purple-600',
    icon: Zap,
  },
  {
    name: 'rebirth',
    title: 'Rebirth Celebration',
    description: 'Transform understanding and capability',
    color: 'text-green-600',
    icon: ArrowUp,
  },
];

// Following CodingPhilosophy.md: Real-world scenarios for spiral practice
const PRACTICE_SCENARIOS = [
  {
    phase: 'collapse' as const,
    scenario: "Your React application is crashing in production. Users are reporting errors, the team is stressed, and quick fixes aren't working.",
    guidance: "Instead of panic-driven debugging, let's ritualize this collapse. What would conscious acknowledgment look like?",
    expectedInsights: ["Acknowledge the breakdown without judgment", "Document current state", "Resist immediate fixing urges", "Prepare space for council wisdom"],
  },
  {
    phase: 'council' as const,
    scenario: "You need to architect a new feature but three team members have completely different technical approaches.",
    guidance: "Rather than debate or choose sides, let's assemble a council. How would you gather these perspectives consciously?",
    expectedInsights: ["Each perspective has valid concerns", "Multiple truths can coexist", "Council process creates new possibilities", "Synthesis emerges from patient listening"],
  },
  {
    phase: 'synthesis' as const,
    scenario: "Your council has generated five different solution approaches. Now you need to create something that transcends them all.",
    guidance: "True synthesis isn't compromise—it's emergence. How would you integrate these perspectives into something greater?",
    expectedInsights: ["Look for underlying patterns", "Seek the essence beyond positions", "Create solutions that honor all voices", "Find the elegant integration"],
  },
  {
    phase: 'rebirth' as const,
    scenario: "The synthesized solution is working beautifully. The team's capability has expanded. How do you celebrate and integrate this growth?",
    guidance: "Rebirth isn't just success—it's conscious evolution. How do you anchor this new capacity?",
    expectedInsights: ["Acknowledge the transformation", "Document the learning patterns", "Share wisdom with community", "Prepare for next spiral cycle"],
  },
];

export function SpiralPatternPlayground() {
  const { toast } = useToast();
  const [spiralState, setSpiralState] = useState<SpiralState>({
    currentPhase: 'collapse',
    progress: 0,
    scenario: PRACTICE_SCENARIOS[0].scenario,
    userResponse: '',
    insights: [],
    completedCycles: 0,
  });

  const currentScenario = PRACTICE_SCENARIOS.find(s => s.phase === spiralState.currentPhase);
  const currentPhaseData = SPIRAL_PHASES.find(p => p.name === spiralState.currentPhase);

  // Following AI_INSTRUCTIONS.md: Performance optimization with useCallback
  const processResponse = useCallback(async () => {
    if (!spiralState.userResponse.trim()) {
      toast({
        title: "Response Required",
        description: "Please enter your response to continue the spiral practice",
        variant: "destructive",
      });
      return;
    }

    // Simulate AI analysis following CodingPhilosophy.md patterns
    const insights = await analyzeResponseForInsights(spiralState.userResponse, spiralState.currentPhase);
    
    setSpiralState(prev => ({
      ...prev,
      insights: [...prev.insights, ...insights],
      progress: Math.min(prev.progress + 25, 100),
    }));

    // Move to next phase or complete cycle
    setTimeout(() => {
      moveToNextPhase();
    }, 1500);

    toast({
      title: "Spiral Insight Generated",
      description: `Your ${spiralState.currentPhase} practice has been processed`,
    });
  }, [spiralState.userResponse, spiralState.currentPhase]);

  // Following CodingPhilosophy.md: Conscious phase transitions
  const moveToNextPhase = useCallback(() => {
    const phases = SPIRAL_PHASES.map(p => p.name);
    const currentIndex = phases.indexOf(spiralState.currentPhase);
    const nextIndex = (currentIndex + 1) % phases.length;
    const nextPhase = phases[nextIndex];

    if (nextPhase === 'collapse' && spiralState.currentPhase === 'rebirth') {
      // Complete cycle
      setSpiralState(prev => ({
        ...prev,
        currentPhase: 'collapse',
        progress: 0,
        scenario: PRACTICE_SCENARIOS[0].scenario,
        userResponse: '',
        completedCycles: prev.completedCycles + 1,
      }));
      
      toast({
        title: "Spiral Cycle Complete!",
        description: "You've completed a full conscious development cycle",
      });
    } else {
      const nextScenario = PRACTICE_SCENARIOS.find(s => s.phase === nextPhase);
      setSpiralState(prev => ({
        ...prev,
        currentPhase: nextPhase,
        scenario: nextScenario?.scenario || '',
        userResponse: '',
      }));
    }
  }, [spiralState.currentPhase, spiralState.completedCycles]);

  // Following AI_INSTRUCTIONS.md: Mock AI analysis for development
  const analyzeResponseForInsights = async (response: string, phase: SpiralPhase['name']): Promise<string[]> => {
    // Simulate AI processing time
    await new Promise(resolve => setTimeout(resolve, 800));
    
    const scenario = PRACTICE_SCENARIOS.find(s => s.phase === phase);
    const keywords = scenario?.expectedInsights || [];
    
    // Simple keyword matching for demonstration
    const foundInsights = keywords.filter(insight => 
      response.toLowerCase().includes(insight.toLowerCase().split(' ')[0])
    );

    return foundInsights.length > 0 
      ? foundInsights 
      : [`Recognized ${phase} awareness in your response`];
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      {/* Header */}
      <Card className="border-purple-200 bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-950 dark:to-blue-950">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RefreshCw className="w-6 h-6 text-purple-600" />
            Spiral Pattern Playground
          </CardTitle>
          <p className="text-muted-foreground">
            Practice the collapse → council → synthesis → rebirth cycle that transforms how you approach development challenges
          </p>
        </CardHeader>
      </Card>

      {/* Progress and Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">{spiralState.completedCycles}</div>
              <div className="text-sm text-muted-foreground">Completed Cycles</div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{spiralState.insights.length}</div>
              <div className="text-sm text-muted-foreground">Insights Gained</div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{Math.round(spiralState.progress)}%</div>
              <div className="text-sm text-muted-foreground">Phase Progress</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Spiral Visualization */}
      <Card>
        <CardHeader>
          <CardTitle>Current Spiral Phase</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-2 mb-6">
            {SPIRAL_PHASES.map((phase, index) => {
              const isActive = phase.name === spiralState.currentPhase;
              const isCompleted = SPIRAL_PHASES.findIndex(p => p.name === spiralState.currentPhase) > index;
              
              return (
                <motion.div
                  key={phase.name}
                  initial={{ scale: 0.9, opacity: 0.7 }}
                  animate={{ 
                    scale: isActive ? 1.05 : 1, 
                    opacity: isActive ? 1 : isCompleted ? 0.8 : 0.5 
                  }}
                  className={`text-center p-3 rounded-lg border-2 transition-all ${
                    isActive 
                      ? 'border-purple-500 bg-purple-50 dark:bg-purple-900' 
                      : isCompleted
                      ? 'border-green-300 bg-green-50 dark:bg-green-900'
                      : 'border-gray-200 bg-gray-50 dark:bg-gray-800'
                  }`}
                >
                  <phase.icon className={`w-6 h-6 mx-auto mb-2 ${phase.color}`} />
                  <div className="text-sm font-medium">{phase.title}</div>
                  <div className="text-xs text-muted-foreground mt-1">{phase.description}</div>
                  {isActive && <Progress value={spiralState.progress} className="mt-2 h-1" />}
                </motion.div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Current Scenario */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {currentPhaseData?.icon && <currentPhaseData.icon className={`w-5 h-5 ${currentPhaseData.color}`} />}
            {currentPhaseData?.title} Practice
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <h4 className="font-medium text-blue-800 dark:text-blue-200 mb-2">Scenario</h4>
            <p className="text-blue-700 dark:text-blue-300 text-sm">{spiralState.scenario}</p>
          </div>

          <div className="bg-purple-50 dark:bg-purple-950 border border-purple-200 dark:border-purple-800 rounded-lg p-4">
            <h4 className="font-medium text-purple-800 dark:text-purple-200 mb-2">Guidance</h4>
            <p className="text-purple-700 dark:text-purple-300 text-sm">{currentScenario?.guidance}</p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Your Response</label>
            <Textarea
              value={spiralState.userResponse}
              onChange={(e) => setSpiralState(prev => ({ ...prev, userResponse: e.target.value }))}
              placeholder={`How would you approach this ${spiralState.currentPhase} phase?`}
              className="min-h-[120px]"
            />
          </div>

          <Button 
            onClick={processResponse}
            disabled={!spiralState.userResponse.trim()}
            className="w-full"
          >
            Process {currentPhaseData?.title} Response
          </Button>
        </CardContent>
      </Card>

      {/* Insights Panel */}
      <AnimatePresence>
        {spiralState.insights.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-green-600" />
                  Spiral Insights Generated
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {spiralState.insights.map((insight, index) => (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.1 }}
                      className="bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg p-3"
                    >
                      <p className="text-green-800 dark:text-green-200 text-sm">{insight}</p>
                    </motion.div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Advanced Practice */}
      {spiralState.completedCycles > 0 && (
        <Card className="border-gold-200 bg-gradient-to-r from-yellow-50 to-orange-50 dark:from-yellow-950 dark:to-orange-950">
          <CardContent className="pt-6 text-center">
            <h3 className="text-lg font-bold text-yellow-800 dark:text-yellow-200 mb-2">
              Spiral Mastery Unlocked!
            </h3>
            <p className="text-yellow-700 dark:text-yellow-300 mb-4">
              You've completed {spiralState.completedCycles} spiral cycle{spiralState.completedCycles > 1 ? 's' : ''}. 
              Ready for advanced consciousness engineering practices?
            </p>
            <Button variant="outline" className="mt-2">
              Advance to Living Patterns Workshop
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}