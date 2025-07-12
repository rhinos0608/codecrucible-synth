import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Map, 
  Star, 
  Crown, 
  Compass, 
  BookOpen,
  Trophy,
  Zap,
  Heart,
  Brain,
  Users
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useOnboardingAI } from "@/hooks/useOnboardingAI";
import { useToast } from "@/hooks/use-toast";

// Following CodingPhilosophy.md: Mythic journey structure
interface JourneyStage {
  id: string;
  name: string;
  mythicPhase: 'call' | 'descent' | 'initiation' | 'return' | 'mastery';
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  requirements: string[];
  rewards: string[];
  unlocked: boolean;
  completed: boolean;
  progress: number;
}

interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  unlockedAt?: Date;
}

// Following AI_INSTRUCTIONS.md: Comprehensive journey mapping
const JOURNEY_STAGES: JourneyStage[] = [
  {
    id: 'quick-start',
    name: 'The Call to Adventure',
    mythicPhase: 'call',
    description: 'First encounter with multi-voice AI development',
    icon: Compass,
    color: 'text-blue-600',
    requirements: ['Complete first voice selection', 'Generate first code'],
    rewards: ['Voice awareness badge', 'Basic council access'],
    unlocked: true,
    completed: false,
    progress: 0,
  },
  {
    id: 'council-initiation',
    name: 'Descent into Complexity',
    mythicPhase: 'descent',
    description: 'Learning to navigate the challenges of conscious coding',
    icon: BookOpen,
    color: 'text-purple-600',
    requirements: ['Complete 3 voice combinations', 'Experience first synthesis'],
    rewards: ['Council initiate badge', 'Advanced voice access'],
    unlocked: false,
    completed: false,
    progress: 0,
  },
  {
    id: 'spiral-mastery',
    name: 'The Spiral Trials',
    mythicPhase: 'initiation',
    description: 'Mastering the collapse → council → synthesis → rebirth cycle',
    icon: Zap,
    color: 'text-orange-600',
    requirements: ['Complete 5 spiral cycles', 'Achieve 80% QWAN score'],
    rewards: ['Spiral master badge', 'Custom voice creation'],
    unlocked: false,
    completed: false,
    progress: 0,
  },
  {
    id: 'living-patterns',
    name: 'Return with Wisdom',
    mythicPhase: 'return',
    description: 'Contributing to the living pattern library',
    icon: Heart,
    color: 'text-green-600',
    requirements: ['Create 3 living patterns', 'Mentor another developer'],
    rewards: ['Pattern weaver badge', 'Community recognition'],
    unlocked: false,
    completed: false,
    progress: 0,
  },
  {
    id: 'consciousness-integration',
    name: 'Master of Consciousness',
    mythicPhase: 'mastery',
    description: 'Transcending traditional development paradigms',
    icon: Crown,
    color: 'text-gold-600',
    requirements: ['Lead 10 council sessions', 'Create framework patterns'],
    rewards: ['Consciousness master', 'Framework contributor'],
    unlocked: false,
    completed: false,
    progress: 0,
  },
];

export function MythicJourneyTracker() {
  const { toast } = useToast();
  const { 
    progress, 
    consciousness, 
    analysis,
    isLoading,
    updateProgress 
  } = useOnboardingAI();

  const [selectedStage, setSelectedStage] = useState<JourneyStage | null>(JOURNEY_STAGES[0]);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [journeyStages, setJourneyStages] = useState(JOURNEY_STAGES);

  // Update journey progress based on AI analysis
  useEffect(() => {
    if (progress && consciousness) {
      const updatedStages = journeyStages.map(stage => {
        let stageProgress = 0;
        let completed = false;

        switch (stage.id) {
          case 'quick-start':
            stageProgress = progress.completedModules.length * 25;
            completed = progress.completedModules.length >= 2;
            break;
          case 'council-initiation':
            stageProgress = progress.councilExperiences * 20;
            completed = progress.councilExperiences >= 5;
            break;
          case 'spiral-mastery':
            stageProgress = (progress.spiralCycles * 20) + (consciousness.linearToSpiral);
            completed = progress.spiralCycles >= 5 && consciousness.linearToSpiral >= 80;
            break;
          case 'living-patterns':
            stageProgress = progress.qwanAssessments * 10;
            completed = progress.qwanAssessments >= 10;
            break;
          case 'consciousness-integration':
            stageProgress = consciousness.overall;
            completed = consciousness.overall >= 90;
            break;
        }

        return {
          ...stage,
          progress: Math.min(stageProgress, 100),
          completed,
          unlocked: completed || stageProgress > 0 || stage.id === 'quick-start',
        };
      });

      setJourneyStages(updatedStages);
    }
  }, [progress, consciousness]);

  // Generate achievements based on progress
  useEffect(() => {
    if (progress) {
      const newAchievements: Achievement[] = [];

      if (progress.spiralCycles >= 1) {
        newAchievements.push({
          id: 'first-spiral',
          title: 'First Spiral Complete',
          description: 'Completed your first conscious development cycle',
          icon: Zap,
          rarity: 'common',
          unlockedAt: new Date(),
        });
      }

      if (progress.councilExperiences >= 3) {
        newAchievements.push({
          id: 'council-apprentice',
          title: 'Council Apprentice',
          description: 'Successfully facilitated multiple voice councils',
          icon: Users,
          rarity: 'rare',
          unlockedAt: new Date(),
        });
      }

      if (consciousness?.overall >= 70) {
        newAchievements.push({
          id: 'consciousness-awakening',
          title: 'Consciousness Awakening',
          description: 'Achieved significant consciousness evolution',
          icon: Brain,
          rarity: 'epic',
          unlockedAt: new Date(),
        });
      }

      setAchievements(newAchievements);
    }
  }, [progress, consciousness]);

  const handleStageSelect = (stage: JourneyStage) => {
    if (!stage.unlocked) {
      toast({
        title: "Stage Locked",
        description: "Complete previous stages to unlock this journey phase",
        variant: "destructive",
      });
      return;
    }
    setSelectedStage(stage);
  };

  const getRarityColor = (rarity: Achievement['rarity']) => {
    switch (rarity) {
      case 'common': return 'text-gray-600 border-gray-300';
      case 'rare': return 'text-blue-600 border-blue-300';
      case 'epic': return 'text-purple-600 border-purple-300';
      case 'legendary': return 'text-yellow-600 border-yellow-300';
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-muted-foreground">Loading your mythic journey...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      {/* Header */}
      <Card className="border-gold-200 bg-gradient-to-r from-yellow-50 to-orange-50 dark:from-yellow-950 dark:to-orange-950">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Map className="w-6 h-6 text-yellow-600" />
            Mythic Journey Tracker
          </CardTitle>
          <p className="text-muted-foreground">
            Track your transformation from traditional developer to conscious code creator
          </p>
        </CardHeader>
      </Card>

      {/* Journey Overview */}
      <Card>
        <CardHeader>
          <CardTitle>Journey Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Progress Summary */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">{progress?.spiralCycles || 0}</div>
                <div className="text-sm text-muted-foreground">Spiral Cycles</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-600">{progress?.councilExperiences || 0}</div>
                <div className="text-sm text-muted-foreground">Council Sessions</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{progress?.qwanAssessments || 0}</div>
                <div className="text-sm text-muted-foreground">QWAN Assessments</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-orange-600">{Math.round(consciousness?.overall || 0)}%</div>
                <div className="text-sm text-muted-foreground">Consciousness</div>
              </div>
            </div>

            {/* Journey Path */}
            <div className="relative">
              <div className="absolute top-1/2 left-0 right-0 h-1 bg-gray-200 dark:bg-gray-700 -translate-y-1/2"></div>
              <div className="grid grid-cols-5 gap-2 relative">
                {journeyStages.map((stage, index) => {
                  const IconComponent = stage.icon;
                  return (
                    <motion.div
                      key={stage.id}
                      className={`relative cursor-pointer ${
                        stage.unlocked ? 'opacity-100' : 'opacity-50'
                      }`}
                      onClick={() => handleStageSelect(stage)}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      <div className={`w-12 h-12 rounded-full border-4 flex items-center justify-center mx-auto mb-2 ${
                        stage.completed 
                          ? 'bg-green-500 border-green-500 text-white'
                          : stage.progress > 0
                          ? 'bg-blue-500 border-blue-500 text-white'
                          : 'bg-gray-200 border-gray-300 dark:bg-gray-700 dark:border-gray-600'
                      }`}>
                        <IconComponent className="w-6 h-6" />
                      </div>
                      <div className="text-center">
                        <div className="text-xs font-medium">{stage.name}</div>
                        {stage.progress > 0 && (
                          <Progress value={stage.progress} className="w-full h-1 mt-1" />
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="current-stage" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="current-stage">Current Stage</TabsTrigger>
          <TabsTrigger value="achievements">Achievements</TabsTrigger>
          <TabsTrigger value="consciousness">Consciousness Evolution</TabsTrigger>
        </TabsList>

        {/* Current Stage Tab */}
        <TabsContent value="current-stage" className="space-y-4">
          {selectedStage && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <selectedStage.icon className={`w-6 h-6 ${selectedStage.color}`} />
                  {selectedStage.name}
                </CardTitle>
                <p className="text-muted-foreground">{selectedStage.description}</p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">Progress</span>
                    <span className="text-sm text-muted-foreground">
                      {Math.round(selectedStage.progress)}%
                    </span>
                  </div>
                  <Progress value={selectedStage.progress} />
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <h4 className="font-medium mb-2">Requirements</h4>
                    <div className="space-y-1">
                      {selectedStage.requirements.map((req, index) => (
                        <div key={index} className="flex items-center gap-2 text-sm">
                          <div className="w-2 h-2 rounded-full bg-orange-500"></div>
                          {req}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h4 className="font-medium mb-2">Rewards</h4>
                    <div className="space-y-1">
                      {selectedStage.rewards.map((reward, index) => (
                        <div key={index} className="flex items-center gap-2 text-sm">
                          <Star className="w-3 h-3 text-yellow-500" />
                          {reward}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {selectedStage.unlocked && !selectedStage.completed && (
                  <Button 
                    onClick={() => {
                      // Navigate to appropriate onboarding component
                      toast({
                        title: "Journey Continues",
                        description: `Starting ${selectedStage.name} experience`,
                      });
                    }}
                    className="w-full"
                  >
                    Continue Journey
                  </Button>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Achievements Tab */}
        <TabsContent value="achievements" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Trophy className="w-5 h-5" />
                Achievements Earned
              </CardTitle>
            </CardHeader>
            <CardContent>
              {achievements.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  No achievements yet. Start your journey to unlock them!
                </p>
              ) : (
                <div className="grid gap-4">
                  {achievements.map(achievement => {
                    const IconComponent = achievement.icon;
                    return (
                      <motion.div
                        key={achievement.id}
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className={`border rounded-lg p-4 ${getRarityColor(achievement.rarity)}`}
                      >
                        <div className="flex items-start gap-3">
                          <IconComponent className="w-8 h-8 flex-shrink-0" />
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <h4 className="font-medium">{achievement.title}</h4>
                              <Badge variant="outline" className={getRarityColor(achievement.rarity)}>
                                {achievement.rarity}
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground">{achievement.description}</p>
                            {achievement.unlockedAt && (
                              <p className="text-xs text-muted-foreground mt-1">
                                Unlocked {achievement.unlockedAt.toLocaleDateString()}
                              </p>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Consciousness Evolution Tab */}
        <TabsContent value="consciousness" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Brain className="w-5 h-5" />
                Consciousness Evolution Metrics
              </CardTitle>
            </CardHeader>
            <CardContent>
              {consciousness ? (
                <div className="space-y-4">
                  {Object.entries(consciousness)
                    .filter(([key]) => key !== 'overall')
                    .map(([key, value]) => (
                      <div key={key} className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium capitalize">
                            {key.replace(/([A-Z])/g, ' $1').trim()}
                          </span>
                          <span className="text-sm text-muted-foreground">
                            {Math.round(value)}%
                          </span>
                        </div>
                        <Progress value={value} />
                      </div>
                    ))}

                  <div className="mt-6 p-4 bg-purple-50 dark:bg-purple-950 rounded-lg">
                    <h4 className="font-medium text-purple-800 dark:text-purple-200 mb-2">
                      Overall Consciousness Level
                    </h4>
                    <div className="text-3xl font-bold text-purple-600 mb-2">
                      {Math.round(consciousness.overall)}%
                    </div>
                    <p className="text-sm text-purple-700 dark:text-purple-300">
                      {consciousness.overall >= 90 
                        ? "Master level consciousness achieved"
                        : consciousness.overall >= 70
                        ? "Advanced consciousness development"
                        : consciousness.overall >= 50
                        ? "Developing consciousness awareness"
                        : "Beginning consciousness journey"
                      }
                    </p>
                  </div>
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-8">
                  Start practicing to track your consciousness evolution
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}