// Voice Profile Tutorial Component - Following AI_INSTRUCTIONS.md and CodingPhilosophy.md
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  Brain, 
  Wand2, 
  Users, 
  Sparkles, 
  ArrowRight, 
  CheckCircle, 
  Lightbulb,
  Settings,
  Code
} from "lucide-react";

interface VoiceProfileTutorialProps {
  onComplete: () => void;
  onSkip: () => void;
}

export function VoiceProfileTutorial({ onComplete, onSkip }: VoiceProfileTutorialProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);

  const tutorialSteps = [
    {
      id: 'introduction',
      title: 'Welcome to Voice Profile Customization',
      icon: Brain,
      description: 'Create personalized AI coding assistants with unique personalities and specializations',
      content: (
        <div className="space-y-4">
          <div className="text-center">
            <Brain className="w-16 h-16 mx-auto mb-4 text-blue-500" />
            <h3 className="text-lg font-semibold mb-2">Transform Your AI Experience</h3>
            <p className="text-gray-800 dark:text-gray-100">
              Voice profiles let you create custom AI personalities that understand your coding style, 
              preferences, and project needs. Each profile becomes a specialized coding partner.
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
            <div className="text-center p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <Wand2 className="w-8 h-8 mx-auto mb-2 text-blue-600" />
              <h4 className="font-medium">Personalized</h4>
              <p className="text-sm text-gray-800 dark:text-gray-100">Tailored to your style</p>
            </div>
            <div className="text-center p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
              <Code className="w-8 h-8 mx-auto mb-2 text-green-600" />
              <h4 className="font-medium">Specialized</h4>
              <p className="text-sm text-gray-800 dark:text-gray-100">Expert in your domains</p>
            </div>
            <div className="text-center p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
              <Users className="w-8 h-8 mx-auto mb-2 text-purple-600" />
              <h4 className="font-medium">Team Ready</h4>
              <p className="text-sm text-gray-800 dark:text-gray-100">Share with your team</p>
            </div>
          </div>
        </div>
      )
    },
    {
      id: 'personality',
      title: 'Personality & Communication Style',
      icon: Settings,
      description: 'Define how your AI assistant communicates and approaches problems',
      content: (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 border rounded-lg">
              <h4 className="font-medium mb-2">Personality Traits</h4>
              <div className="space-y-2">
                <Badge variant="outline">Analytical</Badge>
                <Badge variant="outline">Friendly</Badge>
                <Badge variant="outline">Direct</Badge>
                <Badge variant="outline">Detailed</Badge>
              </div>
            </div>
            <div className="p-4 border rounded-lg">
              <h4 className="font-medium mb-2">Communication Styles</h4>
              <div className="space-y-2">
                <Badge variant="outline">Step-by-step</Badge>
                <Badge variant="outline">Conversational</Badge>
                <Badge variant="outline">Bullet points</Badge>
                <Badge variant="outline">Comprehensive</Badge>
              </div>
            </div>
          </div>
          
          <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-lg">
            <div className="flex items-start space-x-3">
              <Lightbulb className="w-5 h-5 text-yellow-600 mt-0.5" />
              <div>
                <h4 className="font-medium text-yellow-800 dark:text-yellow-200">Pro Tip</h4>
                <p className="text-sm text-yellow-700 dark:text-yellow-300">
                  Match personality to your project needs. Use "Analytical" for complex algorithms, 
                  "Friendly" for team collaboration, or "Direct" for rapid prototyping.
                </p>
              </div>
            </div>
          </div>
        </div>
      )
    },
    {
      id: 'specialization',
      title: 'Technical Specializations',
      icon: Code,
      description: 'Choose domains where your AI assistant excels',
      content: (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-2">
            {[
              'React Development', 'TypeScript', 'Node.js', 'Database Design',
              'API Development', 'Security', 'Performance', 'UI/UX',
              'Testing', 'DevOps', 'Mobile', 'Machine Learning'
            ].map((spec) => (
              <Badge key={spec} variant="secondary" className="text-xs p-2">
                {spec}
              </Badge>
            ))}
          </div>
          
          <div className="border-l-4 border-blue-500 pl-4">
            <h4 className="font-medium">Multiple Specializations</h4>
            <p className="text-sm text-gray-800 dark:text-gray-100">
              Select multiple areas to create full-stack specialists. 
              Your AI will provide domain-specific insights and best practices.
            </p>
          </div>
          
          <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
            <h4 className="font-medium mb-2 text-[#484a52]">Example: React Security Specialist</h4>
            <p className="text-sm text-gray-800 dark:text-gray-100">
              Specializations: React Development + Security + Performance
            </p>
            <p className="text-sm text-gray-800 dark:text-gray-100 mt-2">
              Result: AI that generates React components with built-in security patterns 
              and performance optimizations.
            </p>
          </div>
        </div>
      )
    },
    {
      id: 'integration',
      title: 'Council Integration',
      icon: Users,
      description: 'How custom profiles work with voice councils',
      content: (
        <div className="space-y-4">
          <div className="bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 p-6 rounded-lg">
            <h4 className="font-medium mb-3 text-[#393b42]">Voice Council Assembly</h4>
            <div className="space-y-3">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-purple-100 dark:bg-purple-800 rounded-full flex items-center justify-center">
                  <span className="text-sm">1</span>
                </div>
                <div>
                  <p className="font-medium text-[#484a52]">Select Core Voices</p>
                  <p className="text-sm text-gray-800 dark:text-gray-100">
                    Choose Explorer, Maintainer, Analyzer, etc.
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-blue-100 dark:bg-blue-800 rounded-full flex items-center justify-center">
                  <span className="text-sm">2</span>
                </div>
                <div>
                  <p className="font-medium text-[#484a52]">Apply Custom Profile</p>
                  <p className="text-sm text-gray-800 dark:text-gray-100">
                    Your profile enhances the selected voice
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-green-100 dark:bg-green-800 rounded-full flex items-center justify-center">
                  <span className="text-sm">3</span>
                </div>
                <div>
                  <p className="font-medium text-[#393b42]">Enhanced Generation</p>
                  <p className="text-sm text-gray-800 dark:text-gray-100">
                    AI generates with your custom characteristics
                  </p>
                </div>
              </div>
            </div>
          </div>
          
          <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
            <div className="flex items-start space-x-3">
              <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
              <div>
                <h4 className="font-medium text-green-800 dark:text-green-200">Council Enhancement</h4>
                <p className="text-sm text-green-700 dark:text-green-300">
                  When you apply a custom profile, the selected voice retains its core identity 
                  but adapts to your custom personality, specialization, and communication style.
                </p>
              </div>
            </div>
          </div>
        </div>
      )
    },
    {
      id: 'creation',
      title: 'Creating Your First Profile',
      icon: Sparkles,
      description: 'Ready to create your personalized AI assistant',
      content: (
        <div className="space-y-4">
          <div className="text-center">
            <Sparkles className="w-16 h-16 mx-auto mb-4 text-purple-500" />
            <h3 className="text-lg font-semibold mb-2 text-[#393b42]">Let's Create Your Profile</h3>
            <p className="text-gray-800 dark:text-gray-100">
              Navigate to the Voice Profiles tab and click "Create New Profile" to start building 
              your personalized AI coding assistant.
            </p>
          </div>
          
          <div className="space-y-3">
            <div className="flex items-center space-x-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <div className="w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-sm">1</div>
              <span className="text-gray-800 dark:text-gray-100">Choose a name and description for your AI assistant</span>
            </div>
            <div className="flex items-center space-x-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <div className="w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-sm">2</div>
              <span className="text-gray-800 dark:text-gray-100">Select personality traits and communication style</span>
            </div>
            <div className="flex items-center space-x-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <div className="w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-sm">3</div>
              <span className="text-gray-800 dark:text-gray-100">Pick technical specializations and ethical stance</span>
            </div>
            <div className="flex items-center space-x-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <div className="w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-sm">4</div>
              <span className="text-gray-800 dark:text-gray-100">Test and save your custom voice profile</span>
            </div>
          </div>
          
          <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg">
            <h4 className="font-medium mb-2 text-[#484a52]">What Happens Next?</h4>
            <p className="text-sm text-gray-800 dark:text-gray-100">
              Your custom profile will appear in the "My Profiles" tab. Click "Apply" to use it 
              in council generation and live streaming for personalized AI assistance.
            </p>
          </div>
        </div>
      )
    }
  ];

  const handleNext = () => {
    if (currentStep < tutorialSteps.length - 1) {
      setCompletedSteps([...completedSteps, currentStep]);
      setCurrentStep(currentStep + 1);
    } else {
      setCompletedSteps([...completedSteps, currentStep]);
      onComplete();
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const currentStepData = tutorialSteps[currentStep];
  const IconComponent = currentStepData.icon;
  const progress = ((currentStep + 1) / tutorialSteps.length) * 100;

  return (
    <div className="max-w-4xl mx-auto p-6">
      <Card className="bg-white dark:bg-gray-900">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <IconComponent className="w-8 h-8 text-blue-600" />
              <div>
                <CardTitle className="text-xl text-[#393b42]">{currentStepData.title}</CardTitle>
                <CardDescription>{currentStepData.description}</CardDescription>
              </div>
            </div>
            <Badge variant="outline">
              Step {currentStep + 1} of {tutorialSteps.length}
            </Badge>
          </div>
          
          <div className="mt-4">
            <Progress value={progress} className="h-2" />
          </div>
        </CardHeader>
        
        <CardContent>
          <div className="mb-6">
            {currentStepData.content}
          </div>
          
          <div className="flex items-center justify-between">
            <div className="flex space-x-2">
              {currentStep > 0 && (
                <Button variant="outline" onClick={handlePrevious}>
                  Previous
                </Button>
              )}
              <Button variant="ghost" onClick={onSkip} className="text-gray-500">
                Skip Tutorial
              </Button>
            </div>
            
            <Button onClick={handleNext} className="flex items-center space-x-2">
              <span>{currentStep === tutorialSteps.length - 1 ? 'Complete Tutorial' : 'Next Step'}</span>
              <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}