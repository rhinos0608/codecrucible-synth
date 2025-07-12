import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  ArrowRight, 
  ArrowLeft, 
  X, 
  Lightbulb, 
  Target, 
  Users, 
  Code,
  Save,
  Play,
  BookOpen,
  CheckCircle,
  ChevronRight,
  Sparkles
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useToast } from "@/hooks/use-toast";

// Following AI_INSTRUCTIONS.md: Strict TypeScript and security patterns
interface TourStep {
  id: string;
  title: string;
  description: string;
  target: string; // CSS selector for highlighting
  position: 'top' | 'bottom' | 'left' | 'right' | 'center';
  page: 'dashboard' | 'onboarding' | 'teams' | 'analytics';
  category: 'navigation' | 'voice-selection' | 'generation' | 'projects' | 'collaboration';
  aiInstructionsPattern?: string;
  codingPhilosophyPrinciple?: string;
  interactionRequired?: boolean;
  nextStepCondition?: () => boolean;
}

// Following CodingPhilosophy.md: Council-based learning journey
const TOUR_STEPS: TourStep[] = [
  // Dashboard Introduction - Following mythic journey structure
  {
    id: 'welcome',
    title: 'Welcome to CodeCrucible',
    description: 'Transform from single-voice AI prompting to council-based collaborative development. This guided tour will show you how to harness multiple AI voices for superior code generation.',
    target: 'body',
    position: 'center',
    page: 'dashboard',
    category: 'navigation',
    codingPhilosophyPrinciple: 'Jung\'s Descent Protocol - Beginning the hero\'s journey into conscious development',
  },
  
  // Navigation Overview
  {
    id: 'navigation-overview',
    title: 'Platform Navigation',
    description: 'These buttons give you access to different areas: Learning for onboarding, Projects for code management, Teams for collaboration, Premium for advanced features, and Analytics for insights.',
    target: 'header .flex.items-center.space-x-3',
    position: 'bottom',
    page: 'dashboard',
    category: 'navigation',
    aiInstructionsPattern: 'Accessibility compliance with clear navigation patterns',
  },

  // Voice Selection - Core Council Assembly
  {
    id: 'voice-selection-intro',
    title: 'Voice Council Assembly',
    description: 'Instead of asking "AI, write me code," you\'ll assemble a council of specialized voices. Each voice brings unique perspectives - analytical, creative, security-focused, performance-oriented.',
    target: '[data-tour="voice-selector"]',
    position: 'right',
    page: 'dashboard',
    category: 'voice-selection',
    codingPhilosophyPrinciple: 'Alexander\'s Pattern Language - Multiple perspectives create living solutions',
  },

  {
    id: 'perspective-selection',
    title: 'Choose Analysis Engines',
    description: 'Select Code Analysis Engines that will examine your request from different angles. Try selecting "Explorer" and "Maintainer" - the Explorer seeks alternatives while the Maintainer ensures long-term quality.',
    target: '[data-tour="perspectives-tab"]',
    position: 'right',
    page: 'dashboard',
    category: 'voice-selection',
    interactionRequired: true,
    nextStepCondition: () => {
      // Check if user has selected at least 2 perspectives
      return document.querySelectorAll('[data-tour="perspective-button"][data-selected="true"]').length >= 2;
    },
  },

  {
    id: 'role-selection',
    title: 'Add Specialization Engines',
    description: 'Now add Code Specialization Engines for technical expertise. Try "Systems Architect" for structure and "UI/UX Engineer" for user experience. This creates a council with both analytical and technical voices.',
    target: '[data-tour="roles-tab"]',
    position: 'right',
    page: 'dashboard',
    category: 'voice-selection',
    interactionRequired: true,
    nextStepCondition: () => {
      return document.querySelectorAll('[data-tour="role-button"][data-selected="true"]').length >= 1;
    },
  },

  // Prompt Engineering
  {
    id: 'prompt-creation',
    title: 'Craft Your Request',
    description: 'Write a specific coding request in the text area below. Try: "Create a responsive navigation component with dark mode toggle and mobile menu." Be specific about requirements and constraints.',
    target: '[data-tour="prompt-textarea"]',
    position: 'top',
    page: 'dashboard',
    category: 'generation',
    aiInstructionsPattern: 'Input validation with proper error handling',
    interactionRequired: true,
    nextStepCondition: () => {
      const textarea = document.querySelector('[data-tour="prompt-textarea"]') as HTMLTextAreaElement;
      return textarea?.value.length > 20;
    },
  },

  // Council Generation Process
  {
    id: 'generation-process',
    title: 'Generate Council Solutions',
    description: 'Click "Generate Solutions" to see your council in action. Each voice will approach your request differently, creating multiple solutions that you can compare and synthesize.',
    target: '[data-tour="generate-button"]',
    position: 'top',
    page: 'dashboard',
    category: 'generation',
    codingPhilosophyPrinciple: 'Campbell\'s Mythic Structure - Multiple voices create transformation',
    interactionRequired: true,
    nextStepCondition: () => {
      return document.querySelector('[data-tour="solution-stack"]')?.classList.contains('visible') || false;
    },
  },

  // Solution Analysis
  {
    id: 'solution-analysis',
    title: 'Examine Multiple Perspectives',
    description: 'Review the different solutions generated by your council. Notice how each voice approached the problem differently - some focus on performance, others on maintainability or user experience.',
    target: '[data-tour="solution-stack"]',
    position: 'left',
    page: 'dashboard',
    category: 'generation',
    codingPhilosophyPrinciple: 'Spiral Dynamics - Each perspective reveals different patterns',
  },

  // Synthesis Process
  {
    id: 'synthesis-introduction',
    title: 'Synthesize Solutions',
    description: 'Don\'t just pick one solution - synthesize them! Click "Synthesize Solutions" to combine the best aspects of multiple perspectives into a unified, superior solution.',
    target: '[data-tour="synthesis-button"]',
    position: 'top',
    page: 'dashboard',
    category: 'generation',
    codingPhilosophyPrinciple: 'Jung\'s Descent Protocol - Synthesis transcends individual perspectives',
    interactionRequired: true,
    nextStepCondition: () => {
      return document.querySelector('[data-tour="synthesis-panel"]')?.classList.contains('visible') || false;
    },
  },

  // Project Management
  {
    id: 'save-to-projects',
    title: 'Save to Projects',
    description: 'Save your synthesized solution to Projects for future reference and iteration. This builds your personal library of council-generated solutions.',
    target: '[data-tour="save-project-button"]',
    position: 'top',
    page: 'dashboard',
    category: 'projects',
    aiInstructionsPattern: 'Data persistence with proper user ownership validation',
    interactionRequired: true,
    nextStepCondition: () => {
      return document.querySelector('[data-tour="projects-panel"]')?.classList.contains('visible') || false;
    },
  },

  // Project Context Usage
  {
    id: 'project-context',
    title: 'Use Project Context',
    description: 'Click "Use as Context" on any saved project to provide background information for future generations. This helps your council understand existing code patterns.',
    target: '[data-tour="projects-panel"]',
    position: 'left',
    page: 'dashboard',
    category: 'projects',
    codingPhilosophyPrinciple: 'Pattern Language - Building on existing patterns creates coherence',
  },

  // Advanced Features
  {
    id: 'learning-path',
    title: 'Deepen Your Practice',
    description: 'Click "Learning" to access the comprehensive onboarding system. This includes Voice Council Simulator, Spiral Pattern training, and QWAN code assessment.',
    target: '[data-tour="learning-button"]',
    position: 'bottom',
    page: 'dashboard',
    category: 'navigation',
    codingPhilosophyPrinciple: 'Consciousness Integration - Continuous evolution of development practice',
  },

  {
    id: 'collaboration-features',
    title: 'Team Collaboration',
    description: 'Visit "Teams" to collaborate with others in real-time council sessions, share voice profiles, and participate in collective code creation.',
    target: '[data-tour="teams-button"]',
    position: 'bottom',
    page: 'dashboard',
    category: 'collaboration',
    aiInstructionsPattern: 'Real-time collaboration with proper authentication',
  },

  // Completion
  {
    id: 'journey-complete',
    title: 'Council Mastery Begins',
    description: 'You\'ve learned the fundamentals of council-based development! Continue practicing with different voice combinations to develop your intuition for conscious code creation.',
    target: 'body',
    position: 'center',
    page: 'dashboard',
    category: 'navigation',
    codingPhilosophyPrinciple: 'Rebirth - Beginning continuous practice of living development',
  },
];

interface GuidedTourProps {
  isNewUser: boolean;
  onComplete: () => void;
  onSkip: () => void;
}

export function GuidedTour({ isNewUser, onComplete, onSkip }: GuidedTourProps) {
  const { toast } = useToast();
  const [currentStep, setCurrentStep] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const [highlightedElement, setHighlightedElement] = useState<Element | null>(null);
  const [tourProgress, setTourProgress] = useState(0);

  const currentStepData = TOUR_STEPS[currentStep];
  const totalSteps = TOUR_STEPS.length;

  // Initialize tour for new users
  useEffect(() => {
    if (isNewUser) {
      // Small delay to ensure page is fully loaded
      setTimeout(() => {
        setIsVisible(true);
        highlightCurrentTarget();
      }, 1000);
    }
  }, [isNewUser]);

  // Update progress when step changes
  useEffect(() => {
    setTourProgress((currentStep / totalSteps) * 100);
    highlightCurrentTarget();
  }, [currentStep, totalSteps]);

  // Following AI_INSTRUCTIONS.md: Performance optimization with useCallback
  const highlightCurrentTarget = useCallback(() => {
    // Remove previous highlight
    if (highlightedElement) {
      highlightedElement.classList.remove('tour-highlight');
    }

    if (!currentStepData) return;

    // Add highlight to current target
    const targetElement = document.querySelector(currentStepData.target);
    if (targetElement) {
      targetElement.classList.add('tour-highlight');
      setHighlightedElement(targetElement);
      
      // Scroll element into view
      targetElement.scrollIntoView({ 
        behavior: 'smooth', 
        block: 'center' 
      });
    }
  }, [currentStepData, highlightedElement]);

  // Check if step condition is met for interactive steps
  const checkStepCondition = useCallback(() => {
    if (!currentStepData?.nextStepCondition) return true;
    return currentStepData.nextStepCondition();
  }, [currentStepData]);

  // Navigation functions
  const nextStep = useCallback(() => {
    if (currentStepData?.interactionRequired && !checkStepCondition()) {
      toast({
        title: "Complete the interaction",
        description: "Please follow the step instructions before continuing",
        variant: "destructive",
      });
      return;
    }

    if (currentStep < totalSteps - 1) {
      setCurrentStep(prev => prev + 1);
    } else {
      completeTour();
    }
  }, [currentStep, totalSteps, currentStepData, checkStepCondition, toast]);

  const previousStep = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  }, [currentStep]);

  const completeTour = useCallback(() => {
    // Remove highlight
    if (highlightedElement) {
      highlightedElement.classList.remove('tour-highlight');
    }
    
    setIsVisible(false);
    onComplete();
    
    toast({
      title: "Tour Complete!",
      description: "You're ready to master council-based development",
    });
  }, [highlightedElement, onComplete, toast]);

  const skipTour = useCallback(() => {
    // Remove highlight
    if (highlightedElement) {
      highlightedElement.classList.remove('tour-highlight');
    }
    
    setIsVisible(false);
    onSkip();
  }, [highlightedElement, onSkip]);

  if (!isVisible || !currentStepData) return null;

  return (
    <>
      {/* Backdrop overlay */}
      <div className="fixed inset-0 bg-black/50 z-40" />
      
      {/* Tour tooltip */}
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          className={`fixed z-50 max-w-md ${
            currentStepData.position === 'center' 
              ? 'top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2'
              : 'top-4 right-4'
          }`}
        >
          <Card className="border-purple-200 bg-white dark:bg-gray-900 shadow-xl">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-purple-600">
                    Step {currentStep + 1} of {totalSteps}
                  </Badge>
                  {currentStepData.interactionRequired && (
                    <Badge variant="outline" className="text-orange-600">
                      <Target className="w-3 h-3 mr-1" />
                      Interactive
                    </Badge>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={skipTour}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
              
              <CardTitle className="text-lg flex items-center gap-2">
                {currentStepData.category === 'voice-selection' && <Users className="w-5 h-5 text-blue-500" />}
                {currentStepData.category === 'generation' && <Code className="w-5 h-5 text-green-500" />}
                {currentStepData.category === 'projects' && <Save className="w-5 h-5 text-purple-500" />}
                {currentStepData.category === 'navigation' && <BookOpen className="w-5 h-5 text-orange-500" />}
                {currentStepData.category === 'collaboration' && <Sparkles className="w-5 h-5 text-pink-500" />}
                {currentStepData.title}
              </CardTitle>
              
              <Progress value={tourProgress} className="h-2 mt-2" />
            </CardHeader>
            
            <CardContent className="space-y-4">
              <p className="text-sm text-gray-600 dark:text-gray-300">
                {currentStepData.description}
              </p>

              {/* Philosophy/Pattern Integration */}
              {currentStepData.codingPhilosophyPrinciple && (
                <div className="bg-purple-50 dark:bg-purple-950 border border-purple-200 dark:border-purple-800 rounded-lg p-3">
                  <div className="flex items-start gap-2">
                    <Lightbulb className="w-4 h-4 text-purple-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <h4 className="text-sm font-medium text-purple-800 dark:text-purple-200">
                        Coding Philosophy
                      </h4>
                      <p className="text-xs text-purple-700 dark:text-purple-300 mt-1">
                        {currentStepData.codingPhilosophyPrinciple}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {currentStepData.aiInstructionsPattern && (
                <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                  <div className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <h4 className="text-sm font-medium text-blue-800 dark:text-blue-200">
                        Technical Pattern
                      </h4>
                      <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
                        {currentStepData.aiInstructionsPattern}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Navigation */}
              <div className="flex items-center justify-between pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={previousStep}
                  disabled={currentStep === 0}
                  className="flex items-center gap-2"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Previous
                </Button>

                <Button
                  onClick={nextStep}
                  size="sm"
                  className="flex items-center gap-2"
                  disabled={currentStepData.interactionRequired && !checkStepCondition()}
                >
                  {currentStep === totalSteps - 1 ? 'Complete' : 'Next'}
                  {currentStep === totalSteps - 1 ? (
                    <CheckCircle className="w-4 h-4" />
                  ) : (
                    <ArrowRight className="w-4 h-4" />
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </AnimatePresence>

      {/* CSS for highlighting */}
      <style>{`
        .tour-highlight {
          position: relative;
          z-index: 45;
          box-shadow: 0 0 0 4px rgba(147, 51, 234, 0.5), 0 0 20px rgba(147, 51, 234, 0.3);
          border-radius: 8px;
          animation: pulse-highlight 2s infinite;
        }
        
        @keyframes pulse-highlight {
          0%, 100% { 
            box-shadow: 0 0 0 4px rgba(147, 51, 234, 0.5), 0 0 20px rgba(147, 51, 234, 0.3);
          }
          50% { 
            box-shadow: 0 0 0 6px rgba(147, 51, 234, 0.7), 0 0 30px rgba(147, 51, 234, 0.5);
          }
        }
      `}</style>
    </>
  );
}