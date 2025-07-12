import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ArrowRight, ArrowLeft, Check, Target, Lightbulb } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { useConfirmationDialog } from '@/components/ConfirmationDialog';

interface TourStep {
  id: string;
  title: string;
  description: string;
  target: string;
  position: 'top' | 'bottom' | 'left' | 'right' | 'center';
  category: 'voice-selection' | 'generation' | 'projects' | 'navigation' | 'collaboration';
  interactionRequired?: boolean;
  nextStepCondition?: () => boolean;
  aiInsight?: string;
  codingPhilosophyPrinciple?: string;
}

const ONBOARDING_STEPS: TourStep[] = [
  {
    id: 'welcome',
    title: 'Welcome to CodeCrucible',
    description: 'Experience the future of AI-powered coding with our multi-voice council system. Each AI voice brings unique perspectives to solve your coding challenges.',
    target: '[data-tour="welcome"]',
    position: 'center',
    category: 'navigation',
    codingPhilosophyPrinciple: 'The whole is greater than the sum of its parts - council-based development'
  },
  {
    id: 'voice-selection',
    title: 'Choose Your AI Council',
    description: 'Select different AI voices to form your coding council. Each voice specializes in different aspects: architecture, security, performance, and user experience.',
    target: '[data-tour="voice-selector"]',
    position: 'left',
    category: 'voice-selection',
    interactionRequired: true,
    nextStepCondition: () => {
      // Check if at least one voice is selected
      const voices = document.querySelectorAll('[data-tour="voice-selector"] [aria-pressed="true"]');
      return voices.length > 0;
    },
    aiInsight: 'Different coding challenges require different perspectives - assemble wisely'
  },
  {
    id: 'prompt-input',
    title: 'Describe Your Challenge',
    description: 'Enter your coding challenge or project requirement. Be specific about what you want to build - the AI council will analyze and provide tailored solutions.',
    target: '[data-tour="prompt-textarea"]',
    position: 'top',
    category: 'generation',
    interactionRequired: true,
    nextStepCondition: () => {
      const textarea = document.querySelector('[data-tour="prompt-textarea"]') as HTMLTextAreaElement;
      return textarea?.value?.trim().length > 10;
    }
  },
  {
    id: 'generation-methods',
    title: 'Two Generation Modes',
    description: 'Choose between Council Generation (traditional) for complete solutions, or Live Streaming for real-time collaborative coding experience.',
    target: '[data-tour="generate-button"]',
    position: 'top',
    category: 'generation',
    codingPhilosophyPrinciple: 'Choose your consciousness mode: reflective analysis or real-time collaboration'
  },
  {
    id: 'solutions-review',
    title: 'Review Multi-Voice Solutions',
    description: 'Each AI voice provides a unique solution approach. Compare different perspectives, code styles, and architectural decisions.',
    target: '[data-tour="solution-stack"]',
    position: 'right',
    category: 'generation',
    aiInsight: 'Diversity of thought leads to robust solutions'
  },
  {
    id: 'synthesis-power',
    title: 'Synthesize Into Perfection',
    description: 'Combine the best elements from multiple solutions using our AI synthesis engine. Create the optimal solution by merging different approaches.',
    target: '[data-tour="synthesis-button"]',
    position: 'bottom',
    category: 'collaboration',
    codingPhilosophyPrinciple: 'Integration and synthesis create emergent quality'
  },
  {
    id: 'project-management',
    title: 'Save and Organize',
    description: 'Save your solutions as projects for future reference. Build a knowledge base of AI-generated solutions you can reuse and learn from.',
    target: '[data-tour="save-project"]',
    position: 'left',
    category: 'projects'
  },
  {
    id: 'learning-path',
    title: 'Continue Learning',
    description: 'Access advanced onboarding paths, team collaboration features, and consciousness-based development techniques through the Learning section.',
    target: '[data-tour="learning-button"]',
    position: 'bottom',
    category: 'navigation',
    codingPhilosophyPrinciple: 'Continuous learning and consciousness expansion'
  }
];

interface OnboardingTourProps {
  isActive: boolean;
  onComplete: () => void;
  onSkip: () => void;
}

export function OnboardingTour({ isActive, onComplete, onSkip }: OnboardingTourProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const [highlightedElement, setHighlightedElement] = useState<Element | null>(null);
  const { toast } = useToast();
  const { showConfirmation, confirmationDialog } = useConfirmationDialog();

  const currentStepData = ONBOARDING_STEPS[currentStep];
  const totalSteps = ONBOARDING_STEPS.length;
  const progress = ((currentStep + 1) / totalSteps) * 100;

  // Initialize tour
  useEffect(() => {
    if (isActive) {
      setTimeout(() => {
        setIsVisible(true);
        highlightCurrentTarget();
      }, 1000);
    } else {
      setIsVisible(false);
      if (highlightedElement) {
        highlightedElement.classList.remove('tour-highlight');
      }
    }
  }, [isActive]);

  // Update highlight when step changes
  useEffect(() => {
    if (isVisible) {
      highlightCurrentTarget();
    }
  }, [currentStep, isVisible]);

  const highlightCurrentTarget = () => {
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
        block: 'center',
        inline: 'center'
      });
    }
  };

  const checkStepCondition = () => {
    if (!currentStepData?.nextStepCondition) return true;
    return currentStepData.nextStepCondition();
  };

  const nextStep = () => {
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
  };

  const previousStep = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const completeTour = () => {
    if (highlightedElement) {
      highlightedElement.classList.remove('tour-highlight');
    }
    setIsVisible(false);
    onComplete();
    
    toast({
      title: "Onboarding Complete!",
      description: "You're ready to master AI-powered development",
    });
  };

  const handleSkip = () => {
    showConfirmation(
      {
        title: 'Skip Onboarding Tour?',
        description: 'You can always restart the tour from the Learning section. Are you sure you want to skip the guided introduction?',
        type: 'info',
        confirmText: 'Skip Tour',
        cancelText: 'Continue Tour',
        context: {
          feature: 'Onboarding Tour',
          progress: `Step ${currentStep + 1} of ${totalSteps}`,
          consequences: [
            'You may miss important features',
            'Learning curve will be steeper',
            'Can restart anytime from Learning section'
          ]
        }
      },
      () => {
        if (highlightedElement) {
          highlightedElement.classList.remove('tour-highlight');
        }
        setIsVisible(false);
        onSkip();
      }
    );
  };

  if (!isVisible || !currentStepData) return null;

  return (
    <>
      {confirmationDialog}
      
      {/* Backdrop overlay */}
      <div className="fixed inset-0 bg-black/60 z-40" />
      
      {/* Tour tooltip */}
      <AnimatePresence>
        <motion.div
          key={currentStep}
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: -20 }}
          className={`fixed z-50 max-w-md ${
            currentStepData.position === 'center' 
              ? 'top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2'
              : 'top-4 right-4'
          }`}
        >
          <Card className="border-blue-200 bg-white dark:bg-gray-900 shadow-2xl">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-blue-600">
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
                  onClick={handleSkip}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
              
              <CardTitle className="text-lg text-blue-900 dark:text-blue-100">
                {currentStepData.title}
              </CardTitle>
              
              <Progress value={progress} className="h-2 mt-2" />
            </CardHeader>
            
            <CardContent className="space-y-4">
              <p className="text-sm text-gray-600 dark:text-gray-300">
                {currentStepData.description}
              </p>

              {/* AI Insight */}
              {currentStepData.aiInsight && (
                <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                  <div className="flex items-start gap-2">
                    <Lightbulb className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <h4 className="font-semibold text-xs text-blue-800 dark:text-blue-200 mb-1">
                        AI Insight
                      </h4>
                      <p className="text-xs text-blue-700 dark:text-blue-300">
                        {currentStepData.aiInsight}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Coding Philosophy Principle */}
              {currentStepData.codingPhilosophyPrinciple && (
                <div className="bg-purple-50 dark:bg-purple-950 border border-purple-200 dark:border-purple-800 rounded-lg p-3">
                  <div className="flex items-start gap-2">
                    <Target className="w-4 h-4 text-purple-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <h4 className="font-semibold text-xs text-purple-800 dark:text-purple-200 mb-1">
                        Consciousness Principle
                      </h4>
                      <p className="text-xs text-purple-700 dark:text-purple-300">
                        {currentStepData.codingPhilosophyPrinciple}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Navigation buttons */}
              <div className="flex justify-between items-center pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={previousStep}
                  disabled={currentStep === 0}
                  className="flex items-center gap-1"
                >
                  <ArrowLeft className="w-3 h-3" />
                  Previous
                </Button>
                
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleSkip}
                    className="text-gray-600"
                  >
                    Skip Tour
                  </Button>
                  
                  <Button
                    size="sm"
                    onClick={nextStep}
                    className="bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-1"
                  >
                    {currentStep === totalSteps - 1 ? (
                      <>
                        <Check className="w-3 h-3" />
                        Complete
                      </>
                    ) : (
                      <>
                        Next
                        <ArrowRight className="w-3 h-3" />
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </AnimatePresence>

      {/* Tour highlight styles */}
      <style>{`
        .tour-highlight {
          position: relative;
          z-index: 45;
          box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.5), 0 0 0 2px rgba(59, 130, 246, 0.8);
          border-radius: 8px;
          transition: all 0.3s ease;
        }
        
        .tour-highlight::before {
          content: '';
          position: absolute;
          inset: -8px;
          border: 2px solid rgba(59, 130, 246, 0.8);
          border-radius: 12px;
          animation: pulse-border 2s infinite;
        }
        
        @keyframes pulse-border {
          0%, 100% { 
            border-color: rgba(59, 130, 246, 0.8);
            transform: scale(1);
          }
          50% { 
            border-color: rgba(59, 130, 246, 0.4);
            transform: scale(1.02);
          }
        }
      `}</style>
    </>
  );
}