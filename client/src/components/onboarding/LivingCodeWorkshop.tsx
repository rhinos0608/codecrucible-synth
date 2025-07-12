import { useState, useCallback, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Code2, Heart, Brain, Sparkles, Target, AlertTriangle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useToast } from "@/hooks/use-toast";
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { tomorrow } from 'react-syntax-highlighter/dist/esm/styles/prism';

// Following CodingPhilosophy.md: QWAN (Quality Without A Name) assessment
interface QWANMetrics {
  aliveness: number;
  wholeness: number;
  selfMaintenance: number;
  elegance: number;
  clarity: number;
  overall: number;
}

// Following AI_INSTRUCTIONS.md: Strict TypeScript patterns
interface CodeSample {
  id: string;
  title: string;
  description: string;
  code: string;
  language: string;
  qwanScore?: QWANMetrics;
  improvements: string[];
  patterns: string[];
}

interface WorkshopState {
  activeTab: 'assessment' | 'craftsmanship' | 'patterns' | 'community';
  currentSample: CodeSample | null;
  userCode: string;
  assessmentResults: QWANMetrics | null;
  craftedSamples: CodeSample[];
  discoveredPatterns: string[];
}

// Following CodingPhilosophy.md: Living code examples for QWAN training
const PRACTICE_CODE_SAMPLES: CodeSample[] = [
  {
    id: 'react-form-basic',
    title: 'Basic React Form',
    description: 'A simple contact form component',
    language: 'tsx',
    code: `function ContactForm() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name || !email || !message) {
      alert('Please fill all fields');
      return;
    }
    console.log({ name, email, message });
  };

  return (
    <form onSubmit={handleSubmit}>
      <input 
        value={name} 
        onChange={(e) => setName(e.target.value)} 
        placeholder="Name" 
      />
      <input 
        value={email} 
        onChange={(e) => setEmail(e.target.value)} 
        placeholder="Email" 
      />
      <textarea 
        value={message} 
        onChange={(e) => setMessage(e.target.value)} 
        placeholder="Message" 
      />
      <button type="submit">Send</button>
    </form>
  );
}`,
    improvements: [
      'Add proper TypeScript types',
      'Implement error handling',
      'Add accessibility attributes',
      'Extract validation logic',
      'Add loading states'
    ],
    patterns: ['Form Management', 'State Validation', 'User Feedback'],
  },
  {
    id: 'react-form-living',
    title: 'Living React Form',
    description: 'A form component with QWAN principles applied',
    language: 'tsx',
    code: `interface ContactFormData {
  name: string;
  email: string;
  message: string;
}

interface ContactFormProps {
  onSubmit: (data: ContactFormData) => Promise<void>;
  className?: string;
}

export function ContactForm({ onSubmit, className }: ContactFormProps) {
  const { 
    register, 
    handleSubmit, 
    formState: { errors, isSubmitting },
    reset 
  } = useForm<ContactFormData>();

  const submitHandler = useCallback(async (data: ContactFormData) => {
    try {
      await onSubmit(data);
      reset();
      toast({ title: "Message sent successfully" });
    } catch (error) {
      toast({ 
        title: "Failed to send message", 
        variant: "destructive" 
      });
    }
  }, [onSubmit, reset]);

  return (
    <form 
      onSubmit={handleSubmit(submitHandler)} 
      className={cn("space-y-4", className)}
      aria-label="Contact form"
    >
      <FormField
        {...register("name", { required: "Name is required" })}
        label="Name"
        error={errors.name?.message}
        disabled={isSubmitting}
      />
      
      <FormField
        {...register("email", { 
          required: "Email is required",
          pattern: {
            value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
            message: "Invalid email address"
          }
        })}
        type="email"
        label="Email"
        error={errors.email?.message}
        disabled={isSubmitting}
      />
      
      <FormField
        {...register("message", { 
          required: "Message is required",
          minLength: {
            value: 10,
            message: "Message must be at least 10 characters"
          }
        })}
        as="textarea"
        label="Message"
        error={errors.message?.message}
        disabled={isSubmitting}
      />
      
      <Button 
        type="submit" 
        disabled={isSubmitting}
        className="w-full"
      >
        {isSubmitting ? "Sending..." : "Send Message"}
      </Button>
    </form>
  );
}`,
    improvements: [],
    patterns: ['Type Safety', 'Error Handling', 'Accessibility', 'Performance', 'User Experience'],
  },
];

export function LivingCodeWorkshop() {
  const { toast } = useToast();
  const [workshopState, setWorkshopState] = useState<WorkshopState>({
    activeTab: 'assessment',
    currentSample: PRACTICE_CODE_SAMPLES[0],
    userCode: '',
    assessmentResults: null,
    craftedSamples: [],
    discoveredPatterns: [],
  });

  // Following CodingPhilosophy.md: QWAN assessment algorithm
  const assessQWAN = useCallback(async (code: string): Promise<QWANMetrics> => {
    // Simulate AI-powered QWAN analysis
    await new Promise(resolve => setTimeout(resolve, 1200));

    // Basic heuristics for demonstration (would be AI-powered in production)
    const metrics = {
      aliveness: calculateAliveness(code),
      wholeness: calculateWholeness(code),
      selfMaintenance: calculateSelfMaintenance(code),
      elegance: calculateElegance(code),
      clarity: calculateClarity(code),
      overall: 0,
    };

    metrics.overall = Object.values(metrics).reduce((sum, val) => sum + val, 0) / 5;
    
    return metrics;
  }, []);

  // Following AI_INSTRUCTIONS.md: Performance-optimized calculations
  const calculateAliveness = (code: string): number => {
    const indicators = [
      code.includes('useState') || code.includes('useEffect'),
      code.includes('callback') || code.includes('memo'),
      code.includes('error') || code.includes('loading'),
      code.includes('accessibility') || code.includes('aria-'),
      code.length > 200 && code.length < 1000,
    ];
    return (indicators.filter(Boolean).length / indicators.length) * 100;
  };

  const calculateWholeness = (code: string): number => {
    const indicators = [
      code.includes('interface') || code.includes('type'),
      code.includes('Props'),
      code.includes('export'),
      code.includes('import'),
      code.split('\n').length > 10,
    ];
    return (indicators.filter(Boolean).length / indicators.length) * 100;
  };

  const calculateSelfMaintenance = (code: string): number => {
    const indicators = [
      code.includes('useCallback') || code.includes('useMemo'),
      code.includes('try') && code.includes('catch'),
      code.includes('//') || code.includes('/**'),
      code.includes('test') || code.includes('spec'),
      !code.includes('any') && !code.includes('console.log'),
    ];
    return (indicators.filter(Boolean).length / indicators.length) * 100;
  };

  const calculateElegance = (code: string): number => {
    const lines = code.split('\n');
    const avgLineLength = lines.reduce((sum, line) => sum + line.length, 0) / lines.length;
    const eleganceFactors = [
      avgLineLength < 80,
      code.includes('const ') > code.includes('let '),
      !code.includes('function ') || code.includes('const '),
      lines.filter(line => line.trim()).length / lines.length > 0.8,
      code.includes('...') || code.includes('?.'),
    ];
    return (eleganceFactors.filter(Boolean).length / eleganceFactors.length) * 100;
  };

  const calculateClarity = (code: string): number => {
    const indicators = [
      code.match(/\b[A-Z][a-z]+[A-Z][a-z]+\b/g)?.length || 0 > 2, // PascalCase
      code.match(/\b[a-z]+[A-Z][a-z]+\b/g)?.length || 0 > 2, // camelCase
      !code.includes('data') || !code.includes('item'),
      code.includes('aria-') || code.includes('role='),
      code.split('\n').filter(line => line.includes('//')).length > 0,
    ];
    return (indicators.filter(Boolean).length / indicators.length) * 100;
  };

  const handleQWANAssessment = useCallback(async () => {
    if (!workshopState.currentSample) return;

    const results = await assessQWAN(workshopState.currentSample.code);
    setWorkshopState(prev => ({
      ...prev,
      assessmentResults: results,
    }));

    toast({
      title: "QWAN Assessment Complete",
      description: `Overall quality score: ${Math.round(results.overall)}%`,
    });
  }, [workshopState.currentSample, assessQWAN, toast]);

  const handleCraftCode = useCallback(async () => {
    if (!workshopState.userCode.trim()) {
      toast({
        title: "Code Required",
        description: "Please enter your crafted code to assess",
        variant: "destructive",
      });
      return;
    }

    const qwanResults = await assessQWAN(workshopState.userCode);
    
    const newSample: CodeSample = {
      id: `user-craft-${Date.now()}`,
      title: 'Your Crafted Code',
      description: 'Code you\'ve crafted with QWAN principles',
      code: workshopState.userCode,
      language: 'tsx',
      qwanScore: qwanResults,
      improvements: [],
      patterns: ['User Crafted'],
    };

    setWorkshopState(prev => ({
      ...prev,
      craftedSamples: [...prev.craftedSamples, newSample],
      userCode: '',
    }));

    toast({
      title: "Code Crafted Successfully",
      description: `QWAN Score: ${Math.round(qwanResults.overall)}%`,
    });
  }, [workshopState.userCode, assessQWAN, toast]);

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      {/* Header */}
      <Card className="border-green-200 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950 dark:to-emerald-950">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Heart className="w-6 h-6 text-green-600" />
            Living Code Workshop
          </CardTitle>
          <p className="text-muted-foreground">
            Learn to assess and craft code with Quality Without A Name (QWAN) - the essence that makes code truly alive
          </p>
        </CardHeader>
      </Card>

      <Tabs value={workshopState.activeTab} onValueChange={(tab) => setWorkshopState(prev => ({ ...prev, activeTab: tab as any }))}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="assessment">QWAN Assessment</TabsTrigger>
          <TabsTrigger value="craftsmanship">Code Craftsmanship</TabsTrigger>
          <TabsTrigger value="patterns">Pattern Discovery</TabsTrigger>
          <TabsTrigger value="community">Community Wisdom</TabsTrigger>
        </TabsList>

        {/* QWAN Assessment Tab */}
        <TabsContent value="assessment" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="w-5 h-5" />
                Code Quality Assessment
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Learn to recognize the subtle qualities that make code truly living
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Sample Selection */}
              <div className="grid gap-2">
                <label className="text-sm font-medium">Practice Sample</label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {PRACTICE_CODE_SAMPLES.map(sample => (
                    <Button
                      key={sample.id}
                      variant={workshopState.currentSample?.id === sample.id ? "default" : "outline"}
                      onClick={() => setWorkshopState(prev => ({ 
                        ...prev, 
                        currentSample: sample,
                        assessmentResults: null 
                      }))}
                      className="justify-start"
                    >
                      {sample.title}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Code Display */}
              {workshopState.currentSample && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Code Sample</label>
                  <div className="border rounded-lg overflow-hidden">
                    <SyntaxHighlighter
                      language={workshopState.currentSample.language}
                      style={tomorrow}
                      className="!bg-gray-50 dark:!bg-gray-900"
                    >
                      {workshopState.currentSample.code}
                    </SyntaxHighlighter>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {workshopState.currentSample.description}
                  </p>
                </div>
              )}

              <Button onClick={handleQWANAssessment} className="w-full">
                Assess QWAN Quality
              </Button>

              {/* QWAN Results */}
              <AnimatePresence>
                {workshopState.assessmentResults && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    className="grid gap-4"
                  >
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      {Object.entries(workshopState.assessmentResults).map(([key, value]) => (
                        <Card key={key} className="text-center">
                          <CardContent className="pt-4">
                            <div className="text-2xl font-bold" style={{ 
                              color: value >= 70 ? '#10b981' : value >= 50 ? '#f59e0b' : '#ef4444' 
                            }}>
                              {Math.round(value)}%
                            </div>
                            <div className="text-xs text-muted-foreground capitalize">
                              {key.replace(/([A-Z])/g, ' $1').trim()}
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>

                    {workshopState.currentSample?.improvements.length > 0 && (
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-sm">Improvement Opportunities</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-2">
                            {workshopState.currentSample.improvements.map((improvement, index) => (
                              <div key={index} className="flex items-start gap-2">
                                <AlertTriangle className="w-4 h-4 text-yellow-500 mt-0.5 flex-shrink-0" />
                                <span className="text-sm">{improvement}</span>
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Code Craftsmanship Tab */}
        <TabsContent value="craftsmanship" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Code2 className="w-5 h-5" />
                Anti-Entropy Craftsmanship
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Practice writing code that resists decay and grows more beautiful over time
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Craft Your Living Code</label>
                <Textarea
                  value={workshopState.userCode}
                  onChange={(e) => setWorkshopState(prev => ({ ...prev, userCode: e.target.value }))}
                  placeholder="Write code that embodies QWAN principles..."
                  className="min-h-[300px] font-mono text-sm"
                />
              </div>

              <Button onClick={handleCraftCode} className="w-full">
                Assess My Crafted Code
              </Button>

              {/* Crafted Samples Display */}
              {workshopState.craftedSamples.length > 0 && (
                <div className="space-y-4">
                  <h4 className="font-medium">Your Crafted Samples</h4>
                  {workshopState.craftedSamples.map(sample => (
                    <Card key={sample.id}>
                      <CardContent className="pt-4">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium">{sample.title}</span>
                          {sample.qwanScore && (
                            <Badge variant={sample.qwanScore.overall >= 70 ? "default" : "secondary"}>
                              QWAN: {Math.round(sample.qwanScore.overall)}%
                            </Badge>
                          )}
                        </div>
                        <div className="border rounded overflow-hidden">
                          <SyntaxHighlighter
                            language={sample.language}
                            style={tomorrow}
                            className="!bg-gray-50 dark:!bg-gray-900 text-xs"
                          >
                            {sample.code.substring(0, 200)}...
                          </SyntaxHighlighter>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Pattern Discovery Tab */}
        <TabsContent value="patterns" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Brain className="w-5 h-5" />
                Living Pattern Language
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Discover and document the patterns that create quality without a name
              </p>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4">
                {['Type Safety', 'Error Handling', 'Accessibility', 'Performance', 'User Experience'].map(pattern => (
                  <Card key={pattern}>
                    <CardContent className="pt-4">
                      <h4 className="font-medium mb-2">{pattern}</h4>
                      <p className="text-sm text-muted-foreground">
                        Pattern description and implementation examples for {pattern.toLowerCase()}
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Community Tab */}
        <TabsContent value="community" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="w-5 h-5" />
                Community Wisdom Archive
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Share insights and learn from the collective wisdom of conscious developers
              </p>
            </CardHeader>
            <CardContent className="text-center py-8">
              <p className="text-muted-foreground">
                Community features coming soon - where developers share living patterns and QWAN insights
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}