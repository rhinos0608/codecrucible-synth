import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  GraduationCap, 
  Brain, 
  Compass, 
  Sparkles,
  ArrowRight,
  CheckCircle,
  Lock
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";

// Following CodeCrucible Onboarding Protocol: Multi-layered learning experience
import { VoiceCouncilSimulator } from "@/components/onboarding/VoiceCouncilSimulator";
import { SpiralPatternPlayground } from "@/components/onboarding/SpiralPatternPlayground";
import { LivingCodeWorkshop } from "@/components/onboarding/LivingCodeWorkshop";
import { MythicJourneyTracker } from "@/components/onboarding/MythicJourneyTracker";
import { useOnboardingAI } from "@/hooks/useOnboardingAI";
import { useAuthContext } from "@/components/auth/AuthProvider";
import { useToast } from "@/hooks/use-toast";

// Following AI_INSTRUCTIONS.md: Strict TypeScript and security patterns
interface OnboardingPath {
  id: string;
  name: string;
  description: string;
  duration: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced' | 'expert' | 'master';
  prerequisites: string[];
  outcomes: string[];
  component: any;
  unlocked: boolean;
}

// Following CodingPhilosophy.md: Five interconnected onboarding paths
const ONBOARDING_PATHS: OnboardingPath[] = [
  {
    id: 'quick-start',
    name: 'The Quick Start',
    description: 'For developers who want to start coding with AI voices immediately',
    duration: '5-10 minutes',
    difficulty: 'beginner',
    prerequisites: [],
    outcomes: ['Basic voice understanding', 'First AI-generated code', 'Council awareness'],
    component: VoiceCouncilSimulator,
    unlocked: true,
  },
  {
    id: 'council-initiation',
    name: 'The Council Initiation',
    description: 'Learn the mythic journey of multi-voice AI collaboration',
    duration: '15-30 minutes',
    difficulty: 'intermediate',
    prerequisites: ['Complete Quick Start'],
    outcomes: ['Voice archetype mastery', 'Council dialogue skills', 'Synthesis understanding'],
    component: VoiceCouncilSimulator,
    unlocked: false,
  },
  {
    id: 'spiral-mastery',
    name: 'The Spiral Mastery',
    description: 'Master the collapse → council → synthesis → rebirth cycle',
    duration: '30-60 minutes',
    difficulty: 'advanced',
    prerequisites: ['Complete Council Initiation', '3+ council sessions'],
    outcomes: ['Spiral pattern fluency', 'Conscious development practices', 'Anti-entropy skills'],
    component: SpiralPatternPlayground,
    unlocked: false,
  },
  {
    id: 'living-patterns',
    name: 'The Living Patterns',
    description: 'Learn to assess and craft code with Quality Without A Name',
    duration: '1-2 hours',
    difficulty: 'expert',
    prerequisites: ['Complete Spiral Mastery', '5+ spiral cycles', '80% QWAN score'],
    outcomes: ['QWAN assessment mastery', 'Pattern language fluency', 'Living code craftsmanship'],
    component: LivingCodeWorkshop,
    unlocked: false,
  },
  {
    id: 'consciousness-integration',
    name: 'The Consciousness Integration',
    description: 'Transcend traditional development through mythic consciousness',
    duration: 'Ongoing practice',
    difficulty: 'master',
    prerequisites: ['Complete Living Patterns', 'Create 3+ patterns', 'Mentor others'],
    outcomes: ['Consciousness mastery', 'Framework contribution', 'Community leadership'],
    component: MythicJourneyTracker,
    unlocked: false,
  },
];

export default function OnboardingPage() {
  const [, setLocation] = useLocation();
  const { user } = useAuthContext();
  const { toast } = useToast();
  const { 
    progress, 
    analysis, 
    generatePersonalizedPath,
    updateProgress,
    isLoading 
  } = useOnboardingAI();

  const [selectedPath, setSelectedPath] = useState<OnboardingPath | null>(ONBOARDING_PATHS[0]);
  const [activeTab, setActiveTab] = useState<'paths' | 'current' | 'journey'>('paths');
  const [onboardingPaths, setOnboardingPaths] = useState(ONBOARDING_PATHS);

  // Update path availability based on progress
  useEffect(() => {
    if (progress) {
      const updatedPaths = onboardingPaths.map(path => {
        let unlocked = path.id === 'quick-start'; // Always unlock first path
        
        switch (path.id) {
          case 'council-initiation':
            unlocked = progress.completedModules.includes('quick-start');
            break;
          case 'spiral-mastery':
            unlocked = progress.councilExperiences >= 3 && progress.completedModules.includes('council-initiation');
            break;
          case 'living-patterns':
            unlocked = progress.spiralCycles >= 5 && progress.completedModules.includes('spiral-mastery');
            break;
          case 'consciousness-integration':
            unlocked = progress.qwanAssessments >= 10 && progress.completedModules.includes('living-patterns');
            break;
        }

        return { ...path, unlocked };
      });

      setOnboardingPaths(updatedPaths);
    }
  }, [progress]);

  // Following AI_INSTRUCTIONS.md: Error handling and user feedback
  const handlePathSelection = (path: OnboardingPath) => {
    if (!path.unlocked) {
      toast({
        title: "Path Locked",
        description: `Complete prerequisites: ${path.prerequisites.join(', ')}`,
        variant: "destructive",
      });
      return;
    }

    setSelectedPath(path);
    setActiveTab('current');
    
    // Track path selection for AI analysis
    updateProgress.mutate({
      phase: path.id,
      insight: `Started ${path.name} learning path`,
    });
  };

  const handleStartPersonalizedJourney = async () => {
    if (!user) return;

    try {
      await generatePersonalizedPath.mutateAsync({
        learningStyle: 'hands-on', // Would be user-selected
        timeCommitment: 'thorough',
        primaryGoals: ['multi-voice-mastery', 'conscious-development'],
        experience: 'intermediate',
      });

      toast({
        title: "Personalized Journey Created",
        description: "AI has created your custom learning path based on your preferences",
      });
    } catch (error) {
      toast({
        title: "Failed to Create Journey",
        description: "Please try again or start with a standard path",
        variant: "destructive",
      });
    }
  };

  const getDifficultyColor = (difficulty: OnboardingPath['difficulty']) => {
    switch (difficulty) {
      case 'beginner': return 'text-green-600 bg-green-100 dark:bg-green-900';
      case 'intermediate': return 'text-blue-600 bg-blue-100 dark:bg-blue-900';
      case 'advanced': return 'text-purple-600 bg-purple-100 dark:bg-purple-900';
      case 'expert': return 'text-orange-600 bg-orange-100 dark:bg-orange-900';
      case 'master': return 'text-gold-600 bg-yellow-100 dark:bg-yellow-900';
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-muted-foreground">Initializing your consciousness transformation journey...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <Card className="border-purple-200 bg-gradient-to-r from-purple-50 via-blue-50 to-emerald-50 dark:from-purple-950 dark:via-blue-950 dark:to-emerald-950">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-2xl">
            <GraduationCap className="w-8 h-8 text-purple-600" />
            CodeCrucible Onboarding & Transformation
          </CardTitle>
          <p className="text-lg text-muted-foreground">
            Transform from traditional "single-voice AI prompting" to council-based collaborative AI development
          </p>
          <div className="flex items-center gap-4 mt-4">
            <Badge variant="outline" className="text-purple-600">
              Transisthesis Framework
            </Badge>
            <Badge variant="outline" className="text-blue-600">
              Living Spiral Engine
            </Badge>
            <Badge variant="outline" className="text-green-600">
              QWAN Assessment
            </Badge>
          </div>
        </CardHeader>
      </Card>

      {/* Welcome Message for New Users */}
      {!progress?.completedModules.length && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-4"
        >
          <Card className="border-blue-200 bg-blue-50 dark:bg-blue-950 dark:border-blue-800">
            <CardContent className="pt-6">
              <div className="text-center space-y-4">
                <Brain className="w-16 h-16 text-blue-600 mx-auto" />
                <h3 className="text-xl font-bold text-blue-800 dark:text-blue-200">
                  Welcome to Conscious Development
                </h3>
                <p className="text-blue-700 dark:text-blue-300 max-w-2xl mx-auto">
                  You're about to experience a fundamental shift in how you think about AI-assisted development. 
                  This journey will transform you from asking "AI, write me code" to conducting sophisticated 
                  councils of specialized AI voices.
                </p>
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  <Button 
                    onClick={() => handlePathSelection(ONBOARDING_PATHS[0])}
                    className="gap-2"
                  >
                    <Compass className="w-4 h-4" />
                    Start Quick Journey (5 min)
                  </Button>
                  <Button 
                    variant="outline"
                    onClick={handleStartPersonalizedJourney}
                    disabled={generatePersonalizedPath.isPending}
                    className="gap-2"
                  >
                    <Sparkles className="w-4 h-4" />
                    Create Personal Path
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab as any} className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="paths">Learning Paths</TabsTrigger>
          <TabsTrigger value="current">Current Experience</TabsTrigger>
          <TabsTrigger value="journey">Journey Progress</TabsTrigger>
        </TabsList>

        {/* Learning Paths Tab */}
        <TabsContent value="paths" className="space-y-4">
          <div className="grid gap-4">
            {onboardingPaths.map((path, index) => (
              <motion.div
                key={path.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <Card 
                  className={`cursor-pointer transition-all hover:shadow-lg ${
                    path.unlocked 
                      ? 'hover:border-purple-300' 
                      : 'opacity-50 cursor-not-allowed'
                  } ${selectedPath?.id === path.id ? 'ring-2 ring-purple-500' : ''}`}
                  onClick={() => handlePathSelection(path)}
                >
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-lg font-semibold">{path.name}</h3>
                          {!path.unlocked && <Lock className="w-4 h-4 text-gray-400" />}
                          {progress?.completedModules.includes(path.id) && (
                            <CheckCircle className="w-5 h-5 text-green-600" />
                          )}
                        </div>
                        <p className="text-muted-foreground text-sm mb-3">
                          {path.description}
                        </p>
                        <div className="flex items-center gap-4 text-sm">
                          <span className="text-muted-foreground">Duration: {path.duration}</span>
                          <Badge className={getDifficultyColor(path.difficulty)}>
                            {path.difficulty}
                          </Badge>
                        </div>
                      </div>
                      <ArrowRight className="w-5 h-5 text-gray-400 flex-shrink-0" />
                    </div>

                    <div className="grid md:grid-cols-2 gap-4 text-sm">
                      <div>
                        <h4 className="font-medium mb-2">Prerequisites</h4>
                        {path.prerequisites.length === 0 ? (
                          <p className="text-muted-foreground">None</p>
                        ) : (
                          <ul className="space-y-1">
                            {path.prerequisites.map((prereq, i) => (
                              <li key={i} className="text-muted-foreground">• {prereq}</li>
                            ))}
                          </ul>
                        )}
                      </div>
                      
                      <div>
                        <h4 className="font-medium mb-2">Learning Outcomes</h4>
                        <ul className="space-y-1">
                          {path.outcomes.slice(0, 3).map((outcome, i) => (
                            <li key={i} className="text-muted-foreground">• {outcome}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </TabsContent>

        {/* Current Experience Tab */}
        <TabsContent value="current" className="space-y-4">
          {selectedPath ? (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    {selectedPath.name}
                    <Badge className={getDifficultyColor(selectedPath.difficulty)}>
                      {selectedPath.difficulty}
                    </Badge>
                  </CardTitle>
                  <p className="text-muted-foreground">{selectedPath.description}</p>
                </CardHeader>
              </Card>

              {/* Render the selected onboarding component */}
              <AnimatePresence mode="wait">
                <motion.div
                  key={selectedPath.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.3 }}
                >
                  <selectedPath.component />
                </motion.div>
              </AnimatePresence>
            </div>
          ) : (
            <Card>
              <CardContent className="pt-6 text-center">
                <p className="text-muted-foreground">
                  Select a learning path to begin your transformation journey
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Journey Progress Tab */}
        <TabsContent value="journey" className="space-y-4">
          <MythicJourneyTracker />
        </TabsContent>
      </Tabs>

      {/* Progress Summary */}
      {progress && (
        <Card className="border-green-200 bg-green-50 dark:bg-green-950 dark:border-green-800">
          <CardContent className="pt-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold text-green-600">
                  {progress.completedModules.length}
                </div>
                <div className="text-sm text-muted-foreground">Paths Completed</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-blue-600">
                  {progress.spiralCycles}
                </div>
                <div className="text-sm text-muted-foreground">Spiral Cycles</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-purple-600">
                  {progress.councilExperiences}
                </div>
                <div className="text-sm text-muted-foreground">Council Sessions</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-orange-600">
                  {progress.masteryLevel}%
                </div>
                <div className="text-sm text-muted-foreground">Mastery Level</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}