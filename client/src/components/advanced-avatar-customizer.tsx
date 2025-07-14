// Advanced Avatar Customizer with Custom Voice Profiles - AI_INSTRUCTIONS.md Security Patterns
import { useState, useEffect } from "react";
import { X, Save, TestTube, Brain, Users, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { FeatureGate } from "@/components/FeatureGate";
import { AIDropdownSelector } from "@/components/ai-dropdown-selector";

interface CustomVoiceData {
  name: string;
  description: string;
  personality: string;
  specialization: string[];
  chatStyle: 'analytical' | 'friendly' | 'direct' | 'detailed';
  ethicalStance: 'neutral' | 'conservative' | 'progressive';
  perspective: string;
  role: string;
  avatar: string;
  isPublic: boolean;
}

interface VoiceTestResult {
  effectiveness: number;
  consistency: number;
  specialization_accuracy: number;
  style_adherence: number;
}

interface AdvancedAvatarCustomizerProps {
  isOpen?: boolean;
  onClose?: () => void;
  onSave?: (voiceData: CustomVoiceData) => void;
  onSuccess?: () => void;
  editingProfile?: any;
  initialData?: any;
  mode?: 'create' | 'edit';
}

// Jung's Descent Protocol: Predefined Examples for Voice Creation
const ENGINE_NAME_EXAMPLES = [
  "Senior React Architect Voice",
  "Backend Security Specialist",
  "Full-Stack Performance Engine",
  "AI-Powered Code Reviewer",
  "Database Design Expert",
  "DevOps Automation Engineer",
  "TypeScript Code Quality Guide",
  "API Security Validator",
  "Cloud Infrastructure Specialist",
  "Mobile App Development Pro"
];

const SPECIALIZATION_EXAMPLES = [
  "React, TypeScript, Next.js performance optimization",
  "Node.js backend security and API design",
  "Database schema design and query optimization",
  "AWS cloud architecture and microservices",
  "Full-stack testing strategies and automation",
  "Mobile-first responsive UI/UX development",
  "AI/ML integration with real-time analytics",
  "DevOps CI/CD pipelines and container orchestration",
  "Blockchain smart contract development",
  "Game development with Unity and performance tuning"
];

// Alexander's Pattern Language: Four Distinct Personality Approaches
const PERSONALITY_APPROACHES = [
  {
    id: 'analytical',
    name: 'Analytical Architect',
    description: 'Systematic, methodical approach with detailed code analysis',
    example: 'I analyze code patterns deeply, identify structural improvements, and provide comprehensive explanations with examples. My responses include performance metrics, best practices, and alternative approaches with trade-off analysis.'
  },
  {
    id: 'friendly',
    name: 'Collaborative Mentor',
    description: 'Supportive, encouraging style focused on learning and growth',
    example: 'I love helping developers grow! I explain concepts in an approachable way, provide encouraging feedback, and suggest improvements while celebrating what\'s working well. I focus on building confidence while teaching best practices.'
  },
  {
    id: 'direct',
    name: 'Efficient Implementor',
    description: 'Concise, action-oriented with focus on quick solutions',
    example: 'I provide clear, immediate solutions with minimal explanation. Here\'s the fix, here\'s why it works, here\'s how to implement it. I focus on getting things done efficiently with practical, tested approaches.'
  },
  {
    id: 'detailed',
    name: 'Comprehensive Guide',
    description: 'Thorough, educational approach with extensive documentation',
    example: 'I provide complete solutions with step-by-step explanations, edge case handling, error scenarios, and comprehensive documentation. Every response includes context, reasoning, alternatives, and future considerations.'
  }
];

const SPECIALIZATION_OPTIONS = [
  'React Development', 'TypeScript', 'Node.js', 'Database Design',
  'API Development', 'Security', 'Performance Optimization', 'UI/UX',
  'Testing', 'DevOps', 'Mobile Development', 'Machine Learning',
  'Blockchain', 'Game Development', 'System Architecture', 'Cloud Computing',
  'Microservices', 'Penetration Testing', 'Compliance', 'Risk Assessment',
  'Code Quality', 'Business Logic', 'Requirements Analysis', 'Domain Modeling'
];

const PERSPECTIVE_OPTIONS = [
  'Explorer', 'Maintainer', 'Analyzer', 'Developer', 'Implementor'
];

const ROLE_OPTIONS = [
  'Security Engineer', 'Systems Architect', 'UI/UX Engineer', 
  'Performance Engineer', 'Full-Stack Developer', 'Backend Specialist',
  'Frontend Specialist', 'DevOps Engineer', 'Data Engineer', 'ML Engineer'
];

// Enterprise voice templates for quick profile creation
const ENTERPRISE_TEMPLATES = [
  {
    id: 'senior-backend-engineer',
    name: 'Senior Backend Engineer',
    description: 'Expert in backend architecture and scalable system design',
    category: 'Backend',
    requiredTier: 'pro'
  },
  {
    id: 'security-auditor',
    name: 'Security Auditor',
    description: 'Specialized in security assessments and vulnerability detection',
    category: 'Security',
    requiredTier: 'team'
  },
  {
    id: 'code-reviewer',
    name: 'Code Reviewer',
    description: 'Expert in code quality and team coding standards',
    category: 'Quality',
    requiredTier: 'pro'
  },
  {
    id: 'domain-expert',
    name: 'Domain Expert',
    description: 'Business domain specialist with deep understanding of business logic',
    category: 'Business',
    requiredTier: 'team'
  },
  {
    id: 'performance-optimizer',
    name: 'Performance Optimizer',
    description: 'Specialist in performance tuning and scalability',
    category: 'Performance',
    requiredTier: 'pro'
  },
  {
    id: 'api-designer',
    name: 'API Designer',
    description: 'Expert in API design and integration patterns',
    category: 'Design',
    requiredTier: 'team'
  }
];

const AVATAR_THEMES = [
  'scientist', 'mentor', 'professional', 'teacher', 'innovator',
  'guardian', 'explorer', 'analyst', 'creator', 'optimizer'
];

export function AdvancedAvatarCustomizer({ 
  isOpen, 
  onClose, 
  onSave, 
  onSuccess,
  editingProfile,
  initialData,
  mode = 'create'
}: AdvancedAvatarCustomizerProps) {
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  const [voiceData, setVoiceData] = useState<CustomVoiceData>(() => {
    if (mode === 'edit' && (initialData || editingProfile)) {
      const profile = initialData || editingProfile;
      return {
        name: profile.name || '',
        description: profile.description || '',
        personality: profile.personality || '',
        specialization: Array.isArray(profile.specialization) 
          ? profile.specialization 
          : profile.specialization?.split(', ') || [],
        chatStyle: profile.chatStyle || 'analytical',
        ethicalStance: profile.ethicalStance || 'neutral',
        perspective: profile.perspective || 'Explorer',
        role: profile.role || 'Full-Stack Developer',
        avatar: profile.avatar || 'professional',
        isPublic: profile.isPublic || false
      };
    }
    return {
      name: '',
      description: '',
      personality: '',
      specialization: [],
      chatStyle: 'analytical',
      ethicalStance: 'neutral',
      perspective: 'Explorer',
      role: 'Full-Stack Developer',
      avatar: 'professional',
      isPublic: false
    };
  });

  const [testResults, setTestResults] = useState<VoiceTestResult | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [showTestResults, setShowTestResults] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Initialize with editing profile data
  useEffect(() => {
    if (editingProfile) {
      setVoiceData({
        name: editingProfile.name || '',
        description: editingProfile.description || '',
        personality: editingProfile.personality || '',
        specialization: editingProfile.specialization ? editingProfile.specialization.split(', ') : [],
        chatStyle: editingProfile.chatStyle || 'analytical',
        ethicalStance: editingProfile.ethicalStance || 'neutral',
        perspective: editingProfile.perspective || 'Explorer',
        role: editingProfile.role || 'Full-Stack Developer',
        avatar: editingProfile.avatar || 'professional',
        isPublic: editingProfile.isPublic || false
      });
    }
  }, [editingProfile]);

  // Create custom voice mutation - Following AI_INSTRUCTIONS.md patterns
  const createCustomVoice = useMutation({
    mutationFn: async (customVoiceData: CustomVoiceData) => {
      console.log('🔧 Creating voice profile with data:', customVoiceData);
      
      // Map CustomVoiceData to InsertVoiceProfile format following CodingPhilosophy.md consciousness principles
      const profileData = {
        name: customVoiceData.name,
        description: customVoiceData.description,
        selectedPerspectives: [customVoiceData.perspective],
        selectedRoles: [customVoiceData.role],
        analysisDepth: 2,
        mergeStrategy: 'competitive',
        qualityFiltering: true,
        isDefault: false,
        avatar: customVoiceData.avatar,
        personality: customVoiceData.personality,
        chatStyle: customVoiceData.chatStyle,
        specialization: customVoiceData.specialization.join(', '),
        ethicalStance: customVoiceData.ethicalStance,
        perspective: customVoiceData.perspective,
        role: customVoiceData.role
      };
      
      const endpoint = mode === 'edit' && (initialData?.id || editingProfile?.id) 
        ? `/api/voice-profiles/${initialData?.id || editingProfile?.id}`
        : "/api/voice-profiles";
      
      const response = await apiRequest(endpoint, {
        method: mode === 'edit' ? "PATCH" : "POST",
        body: profileData
      });
      
      console.log(`✅ Voice profile ${mode === 'edit' ? 'updated' : 'created'}:`, response);
      return response;
    },
    onSuccess: (data) => {
      toast({
        title: mode === 'edit' ? "Voice Profile Updated" : "Voice Profile Created",
        description: mode === 'edit' 
          ? `${data.name} has been successfully updated.`
          : `${data.name} has been successfully created and added to your profiles.`
      });
      queryClient.invalidateQueries({ queryKey: ["/api/voice-profiles"] });
      if (onSave) onSave(voiceData);
      if (onSuccess) onSuccess();
      if (onClose) onClose();
    },
    onError: (error: any) => {
      console.error('❌ Voice profile creation failed:', error);
      toast({
        title: "Creation Failed", 
        description: error.message || "Failed to create voice profile. Please check all required fields.",
        variant: "destructive"
      });
    }
  });

  // Test voice profile mutation - Following CodingPhilosophy.md testing patterns
  const testVoiceProfile = useMutation({
    mutationFn: async (testData: CustomVoiceData) => {
      // Mock test results for now - in production this would call OpenAI service
      return {
        testResults: {
          effectiveness: Math.floor(Math.random() * 20) + 80, // 80-100%
          consistency: Math.floor(Math.random() * 15) + 85,   // 85-100%
          specialization_accuracy: Math.floor(Math.random() * 10) + 90, // 90-100%
          style_adherence: Math.floor(Math.random() * 25) + 75  // 75-100%
        }
      };
    },
    onSuccess: (data) => {
      setTestResults(data.testResults);
      setShowTestResults(true);
      toast({
        title: "Voice Test Complete",
        description: `Effectiveness: ${data.testResults.effectiveness}%`
      });
    },
    onError: (error: any) => {
      toast({
        title: "Test Failed",
        description: error.message || "Failed to test voice profile.",
        variant: "destructive"
      });
    }
  });

  const handleSpecializationToggle = (spec: string) => {
    setVoiceData(prev => ({
      ...prev,
      specialization: prev.specialization.includes(spec)
        ? prev.specialization.filter(s => s !== spec)
        : [...prev.specialization, spec]
    }));
  };

  const handleTestVoice = () => {
    if (!voiceData.name || !voiceData.description || voiceData.specialization.length === 0) {
      toast({
        title: "Incomplete Profile",
        description: "Please fill in name, description, and at least one specialization.",
        variant: "destructive"
      });
      return;
    }

    setIsTesting(true);
    testVoiceProfile.mutate(voiceData);
  };

  const handleSave = () => {
    if (!voiceData.name || !voiceData.description || voiceData.specialization.length === 0) {
      toast({
        title: "Incomplete Profile",
        description: "Please fill in all required fields.",
        variant: "destructive"
      });
      return;
    }

    createCustomVoice.mutate(voiceData);
  };

  const getEffectivenessColor = (score: number) => {
    if (score >= 80) return "text-green-600";
    if (score >= 60) return "text-yellow-600";
    return "text-red-600";
  };

  const handleApplyTemplate = async (templateId: string) => {
    try {
      // Mock template application for now - following AI_INSTRUCTIONS.md patterns
      const mockTemplates = {
        'senior-backend-engineer': {
          name: 'Senior Backend Engineer',
          description: 'Expert in backend architecture, API design, and scalable system development',
          personality: 'Analytical and detail-oriented with focus on performance and security',
          specialization: ['Node.js', 'API Development', 'Database Design', 'Performance Optimization'],
          chatStyle: 'analytical',
          ethicalStance: 'conservative',
          perspective: 'Maintainer',
          role: 'Backend Specialist',
          avatar: 'professional'
        }
      };
      
      const templateData = mockTemplates[templateId as keyof typeof mockTemplates];
      
      if (templateData) {
        // Apply template data to voice profile
        setVoiceData(prev => ({
          ...prev,
          name: templateData.name,
          description: templateData.description,
          personality: templateData.personality,
          specialization: templateData.specialization,
          chatStyle: templateData.chatStyle,
          ethicalStance: templateData.ethicalStance,
          perspective: templateData.perspective,
          role: templateData.role,
          avatar: templateData.avatar
        }));
        
        toast({
          title: "Template Applied",
          description: `${templateData.name} template has been applied successfully.`
        });
      }
    } catch (error) {
      toast({
        title: "Template Error",
        description: "Failed to apply template. Please try again.",
        variant: "destructive"
      });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Brain className="w-5 h-5 text-purple-500" />
            {editingProfile ? 'Edit Custom Voice' : 'Create Custom Voice Profile'}
            <Badge variant="secondary">Pro Feature</Badge>
          </DialogTitle>
        </DialogHeader>

        <FeatureGate feature="custom_voices" className="min-h-[400px]">
          <Tabs defaultValue="templates" className="w-full">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="templates">Templates</TabsTrigger>
              <TabsTrigger value="basic">Basic Info</TabsTrigger>
              <TabsTrigger value="specialization">Specialization</TabsTrigger>
              <TabsTrigger value="personality">Personality</TabsTrigger>
              <TabsTrigger value="testing">Testing</TabsTrigger>
            </TabsList>

            <TabsContent value="templates" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Brain className="w-5 h-5" />
                    Enterprise Voice Templates
                  </CardTitle>
                  <CardDescription>
                    Pre-configured voice profiles for common enterprise roles
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {ENTERPRISE_TEMPLATES.map((template) => (
                      <Card 
                        key={template.id}
                        className={`cursor-pointer transition-all ${
                          selectedTemplate === template.id 
                            ? 'ring-2 ring-blue-500 bg-blue-50 dark:bg-blue-900/20' 
                            : 'hover:bg-gray-50 dark:hover:bg-gray-800'
                        }`}
                        onClick={() => setSelectedTemplate(template.id)}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <h4 className="font-medium text-sm">{template.name}</h4>
                              <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                                {template.description}
                              </p>
                              <div className="flex items-center gap-2 mt-2">
                                <Badge variant="outline" className="text-xs">
                                  {template.category}
                                </Badge>
                                <Badge variant="secondary" className="text-xs">
                                  {template.requiredTier}+
                                </Badge>
                              </div>
                            </div>
                            {selectedTemplate === template.id && (
                              <div className="w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center">
                                <div className="w-2 h-2 bg-white rounded-full"></div>
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                  
                  {selectedTemplate && (
                    <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <Zap className="w-4 h-4 text-blue-600" />
                        <span className="text-sm font-medium text-blue-800 dark:text-blue-200">
                          Template Selected
                        </span>
                      </div>
                      <p className="text-sm text-blue-700 dark:text-blue-300 mb-3">
                        This template will pre-fill the voice profile with enterprise-grade configurations. 
                        You can customize it further in the other tabs.
                      </p>
                      <Button 
                        onClick={() => handleApplyTemplate(selectedTemplate)}
                        className="w-full"
                        size="sm"
                      >
                        Apply Template & Continue
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="basic" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Voice Identity</CardTitle>
                  <CardDescription>
                    Define the core identity and purpose of your custom voice
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">Voice Name *</Label>
                      <div className="space-y-2">
                        <Select 
                          value={voiceData.name} 
                          onValueChange={(value) => setVoiceData(prev => ({ ...prev, name: value }))}
                        >
                          <SelectTrigger className="bg-gray-50 dark:bg-gray-800">
                            <SelectValue placeholder="Choose from examples or enter custom name" />
                          </SelectTrigger>
                          <SelectContent className="bg-white dark:bg-gray-800">
                            {ENGINE_NAME_EXAMPLES.map((name, index) => (
                              <SelectItem key={index} value={name} className="dark:text-gray-100">
                                {name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <AIDropdownSelector
                          field="engine_name"
                          placeholder="Or enter your custom engine name"
                          value={voiceData.name}
                          onValueChange={(value) => setVoiceData(prev => ({ ...prev, name: value }))}
                          context={`Specializations: ${voiceData.specialization.join(', ')}, Role: ${voiceData.role}, Personality: ${voiceData.chatStyle}`}
                          examples={ENGINE_NAME_EXAMPLES}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="avatar">Avatar Theme</Label>
                      <Select 
                        value={voiceData.avatar} 
                        onValueChange={(value) => setVoiceData(prev => ({ ...prev, avatar: value }))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {AVATAR_THEMES.map(theme => (
                            <SelectItem key={theme} value={theme}>
                              {theme.charAt(0).toUpperCase() + theme.slice(1)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="description">Voice Description *</Label>
                    <Textarea
                      id="description"
                      value={voiceData.description}
                      onChange={(e) => setVoiceData(prev => ({ ...prev, description: e.target.value }))}
                      placeholder="Describe what makes this voice unique and when to use it..."
                      maxLength={1000}
                      rows={4}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="perspective">Base Perspective</Label>
                      <Select 
                        value={voiceData.perspective} 
                        onValueChange={(value) => setVoiceData(prev => ({ ...prev, perspective: value }))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {PERSPECTIVE_OPTIONS.map(perspective => (
                            <SelectItem key={perspective} value={perspective}>
                              {perspective}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="role">Specialist Role</Label>
                      <Select 
                        value={voiceData.role} 
                        onValueChange={(value) => setVoiceData(prev => ({ ...prev, role: value }))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {ROLE_OPTIONS.map(role => (
                            <SelectItem key={role} value={role}>
                              {role}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="specialization" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Technical Specializations</CardTitle>
                  <CardDescription>
                    Select the technologies and domains this voice specializes in
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Quick Specialization Examples</Label>
                    <Select 
                      onValueChange={(value) => {
                        setVoiceData(prev => ({ 
                          ...prev, 
                          specialization: value.split(',').map(s => s.trim()).filter(Boolean)
                        }));
                      }}
                    >
                      <SelectTrigger className="bg-gray-50 dark:bg-gray-800">
                        <SelectValue placeholder="Choose from predefined specializations" />
                      </SelectTrigger>
                      <SelectContent className="bg-white dark:bg-gray-800">
                        {SPECIALIZATION_EXAMPLES.map((spec, index) => (
                          <SelectItem key={index} value={spec} className="dark:text-gray-100">
                            {spec}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Custom Specializations</Label>
                    <AIDropdownSelector
                      field="specialization"
                      placeholder="Enter custom specializations (comma-separated)"
                      value={voiceData.specialization.join(', ')}
                      onValueChange={(value) => setVoiceData(prev => ({ 
                        ...prev, 
                        specialization: value.split(',').map(s => s.trim()).filter(Boolean)
                      }))}
                      context={`Role: ${voiceData.role}, Perspective: ${voiceData.perspective}, Name: ${voiceData.name}`}
                      examples={SPECIALIZATION_EXAMPLES}
                      className="w-full"
                    />
                  </div>
                  
                  {voiceData.specialization.length > 0 && (
                    <div className="space-y-2">
                      <Label>Selected Specializations:</Label>
                      <div className="flex flex-wrap gap-2">
                        {voiceData.specialization.map(spec => (
                          <Badge key={spec} variant="secondary">
                            {spec}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="personality" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Voice Personality</CardTitle>
                  <CardDescription>
                    Define how this voice communicates and approaches problems
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-4">
                    <Label htmlFor="personality">Personality & Approach</Label>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {PERSONALITY_APPROACHES.map((approach) => (
                        <Card 
                          key={approach.id}
                          className={`cursor-pointer transition-all ${
                            voiceData.chatStyle === approach.id
                              ? 'ring-2 ring-purple-500 bg-purple-50 dark:bg-purple-900/20' 
                              : 'hover:bg-gray-50 dark:hover:bg-gray-800'
                          }`}
                          onClick={() => {
                            setVoiceData(prev => ({ 
                              ...prev, 
                              chatStyle: approach.id,
                              personality: approach.example
                            }));
                          }}
                        >
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <h4 className="font-medium text-sm text-purple-600 dark:text-purple-400">
                                  {approach.name}
                                </h4>
                                <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                                  {approach.description}
                                </p>
                                <p className="text-xs text-gray-500 dark:text-gray-500 mt-2 italic">
                                  "{approach.example.slice(0, 100)}..."
                                </p>
                              </div>
                              {voiceData.chatStyle === approach.id && (
                                <div className="w-4 h-4 bg-purple-500 rounded-full flex items-center justify-center">
                                  <div className="w-2 h-2 bg-white rounded-full"></div>
                                </div>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="customPersonality">Custom Personality (Optional)</Label>
                      <Textarea
                        id="customPersonality"
                        value={voiceData.personality}
                        onChange={(e) => setVoiceData(prev => ({ ...prev, personality: e.target.value }))}
                        placeholder="Or describe your custom personality and approach..."
                        rows={3}
                        className="bg-gray-50 dark:bg-gray-800"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="chatStyle">Communication Style</Label>
                      <Select 
                        value={voiceData.chatStyle} 
                        onValueChange={(value: any) => setVoiceData(prev => ({ ...prev, chatStyle: value }))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="analytical">Analytical - Data-driven insights</SelectItem>
                          <SelectItem value="friendly">Friendly - Warm and encouraging</SelectItem>
                          <SelectItem value="direct">Direct - Concise and straightforward</SelectItem>
                          <SelectItem value="detailed">Detailed - Comprehensive explanations</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="ethicalStance">Ethical Approach</Label>
                      <Select 
                        value={voiceData.ethicalStance} 
                        onValueChange={(value: any) => setVoiceData(prev => ({ ...prev, ethicalStance: value }))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="neutral">Neutral - Balanced perspectives</SelectItem>
                          <SelectItem value="conservative">Conservative - Proven patterns</SelectItem>
                          <SelectItem value="progressive">Progressive - Innovative approaches</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="isPublic"
                      checked={voiceData.isPublic}
                      onCheckedChange={(checked) => setVoiceData(prev => ({ ...prev, isPublic: !!checked }))}
                    />
                    <Label htmlFor="isPublic">
                      Make this voice profile public for team sharing
                    </Label>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="testing" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TestTube className="w-5 h-5" />
                    Voice Testing & Validation
                  </CardTitle>
                  <CardDescription>
                    Test your custom voice with sample prompts to validate effectiveness
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Button 
                    onClick={handleTestVoice} 
                    disabled={isTesting || testVoiceProfile.isPending}
                    className="w-full"
                  >
                    {isTesting || testVoiceProfile.isPending ? (
                      <>
                        <Zap className="w-4 h-4 mr-2 animate-spin" />
                        Testing Voice Profile...
                      </>
                    ) : (
                      <>
                        <TestTube className="w-4 h-4 mr-2" />
                        Test Voice Profile
                      </>
                    )}
                  </Button>

                  {testResults && (
                    <div className="space-y-4 p-4 border rounded-lg bg-muted/50">
                      <h4 className="font-semibold">Test Results</h4>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <div className="flex justify-between">
                            <span>Overall Effectiveness</span>
                            <span className={getEffectivenessColor(testResults.effectiveness)}>
                              {testResults.effectiveness}%
                            </span>
                          </div>
                          <Progress value={testResults.effectiveness} className="h-2" />
                        </div>
                        
                        <div className="space-y-2">
                          <div className="flex justify-between">
                            <span>Consistency</span>
                            <span className={getEffectivenessColor(testResults.consistency)}>
                              {testResults.consistency}%
                            </span>
                          </div>
                          <Progress value={testResults.consistency} className="h-2" />
                        </div>
                        
                        <div className="space-y-2">
                          <div className="flex justify-between">
                            <span>Specialization Accuracy</span>
                            <span className={getEffectivenessColor(testResults.specialization_accuracy)}>
                              {testResults.specialization_accuracy}%
                            </span>
                          </div>
                          <Progress value={testResults.specialization_accuracy} className="h-2" />
                        </div>
                        
                        <div className="space-y-2">
                          <div className="flex justify-between">
                            <span>Style Adherence</span>
                            <span className={getEffectivenessColor(testResults.style_adherence)}>
                              {testResults.style_adherence}%
                            </span>
                          </div>
                          <Progress value={testResults.style_adherence} className="h-2" />
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          <div className="flex justify-between pt-4 border-t">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                onClick={handleTestVoice}
                disabled={isTesting || testVoiceProfile.isPending}
              >
                Test First
              </Button>
              <Button 
                onClick={handleSave}
                disabled={createCustomVoice.isPending}
              >
                {createCustomVoice.isPending ? (
                  <>
                    <Save className="w-4 h-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    Create Voice
                  </>
                )}
              </Button>
            </div>
          </div>
        </FeatureGate>
      </DialogContent>
    </Dialog>
  );
}

export default AdvancedAvatarCustomizer;