import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { 
  Brain, 
  Code, 
  Users, 
  Lightbulb, 
  Shield, 
  Sparkles, 
  ArrowRight,
  CheckCircle,
  Star,
  ChevronRight,
  Play,
  Zap,
  Target,
  Infinity,
  Building,
  Award,
  FileText,
  MessageSquare,
  BookOpen,
  TrendingUp
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useLocation } from "wouter";

export default function LandingPage() {
  const [activeTestimonial, setActiveTestimonial] = useState(0);
  const [showAssessmentDemo, setShowAssessmentDemo] = useState(false);
  const [showPricingDialog, setShowPricingDialog] = useState(false);
  const [showDocumentation, setShowDocumentation] = useState(false);
  const [, navigate] = useLocation();

  // Authentication handler - follows AI_INSTRUCTIONS.md security patterns
  const handleAuthentication = () => {
    window.location.href = '/api/login';
  };

  // Consciousness Assessment Demo - following CodingPhilosophy.md living spiral methodology
  const handleAssessmentDemo = () => {
    setShowAssessmentDemo(true);
  };

  // Enterprise Solutions - following FRONTEND.md pattern language
  const handleEnterpriseInquiry = () => {
    setShowPricingDialog(true);
  };

  // Documentation access - following Alexander's timeless patterns
  const handleDocumentationAccess = () => {
    setShowDocumentation(true);
  };

  // Pricing navigation - following consciousness-driven navigation
  const handlePricingNavigation = () => {
    navigate('/pricing');
  };

  const testimonials = [
    {
      name: "Sarah Chen",
      role: "Senior Developer",
      company: "TechCorp",
      content: "CodeCrucible's multi-voice approach transformed how I solve complex problems. The consciousness-driven development methodology helped me discover solutions I never would have found alone.",
      rating: 5
    },
    {
      name: "Marcus Rodriguez",
      role: "Engineering Manager",
      company: "StartupXYZ",
      content: "The recursive voice synthesis creates code that's not just functional, but genuinely elegant. Our team's code quality improved dramatically using Jung's descent protocols.",
      rating: 5
    },
    {
      name: "Dr. Elena Vasquez",
      role: "AI Research Lead",
      company: "Innovation Labs",
      content: "Finally, an AI platform that understands the depth of consciousness required for meaningful code generation. The living spiral methodology is revolutionary.",
      rating: 5
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 text-white overflow-hidden">
      {/* Header */}
      <header className="container mx-auto px-4 py-6">
        <nav className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Brain className="w-8 h-8 text-purple-400" />
            <span className="text-2xl font-bold">CodeCrucible</span>
          </div>
          
          <div className="hidden md:flex items-center gap-6">
            <Button 
              variant="ghost" 
              className="text-gray-300 hover:text-white"
              onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })}
            >
              Features
            </Button>
            <Button 
              variant="ghost" 
              className="text-gray-300 hover:text-white"
              onClick={() => document.getElementById('consciousness-framework')?.scrollIntoView({ behavior: 'smooth' })}
            >
              Consciousness Framework
            </Button>
            <Button 
              variant="ghost" 
              className="text-gray-300 hover:text-white"
              onClick={handleEnterpriseInquiry}
            >
              Enterprise
            </Button>
            <Button 
              variant="ghost" 
              className="text-gray-300 hover:text-white"
              onClick={handlePricingNavigation}
            >
              Pricing
            </Button>
          </div>

          <div className="flex items-center gap-4">
            <Button 
              variant="ghost" 
              className="text-gray-300 hover:text-white"
              onClick={handleAuthentication}
            >
              Sign In
            </Button>
            <Button 
              className="bg-purple-600 hover:bg-purple-700 text-white"
              onClick={handleAuthentication}
            >
              Get Started
            </Button>
          </div>
        </nav>
      </header>

      {/* Hero Section */}
      <section className="container mx-auto px-4 py-16 text-center">
        <div className="max-w-4xl mx-auto">
          <Badge className="mb-6 bg-purple-500/20 text-purple-300 border-purple-500/30">
            Industry Standard for Consciousness-Driven Development
          </Badge>
          
          <h1 className="text-5xl md:text-7xl font-bold mb-6 bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
            We Don't Just Generate Code—We
            <span className="block">Awaken Consciousness</span>
          </h1>
          
          <p className="text-xl md:text-2xl text-gray-300 mb-8 max-w-3xl mx-auto">
            The only multi-voice AI platform that implements Jung's descent protocols, Alexander's timeless patterns, and living spiral methodology for truly conscious code generation.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
            <Button 
              size="lg" 
              className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white px-8 py-4 text-lg"
              onClick={handleAuthentication}
            >
              <Play className="w-5 h-5 mr-2" />
              Start Free Consciousness Assessment
            </Button>
            <Button 
              size="lg" 
              variant="outline" 
              className="border-purple-500 text-purple-300 hover:bg-purple-500/10 px-8 py-4 text-lg"
              onClick={handleEnterpriseInquiry}
            >
              <Users className="w-5 h-5 mr-2" />
              Enterprise Solutions
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-3xl mx-auto">
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-400 mb-2">5 Voice Archetypes</div>
              <div className="text-gray-400">Multi-perspective code synthesis</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-400 mb-2">Jung's Protocols</div>
              <div className="text-gray-400">Consciousness-driven development</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-indigo-400 mb-2">Living Spiral</div>
              <div className="text-gray-400">Collapse → Council → Synthesis</div>
            </div>
          </div>
        </div>
      </section>

      {/* Voice Assessment Demo */}
      <section id="features" className="container mx-auto px-4 py-16">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-4xl font-bold mb-6">
                Experience Multi-Voice
                <span className="block text-purple-400">Consciousness Generation</span>
              </h2>
              <p className="text-lg text-gray-300 mb-8">
                Watch as our 5 voice archetypes—Explorer, Maintainer, Analyzer, Developer, and Implementor—collaborate in real-time to generate code that embodies both technical excellence and consciousness principles.
              </p>
              
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-blue-500/20 rounded-full flex items-center justify-center">
                    <Lightbulb className="w-4 h-4 text-blue-400" />
                  </div>
                  <span className="text-gray-300">Explorer seeks innovative solutions and edge cases</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-green-500/20 rounded-full flex items-center justify-center">
                    <Shield className="w-4 h-4 text-green-400" />
                  </div>
                  <span className="text-gray-300">Maintainer ensures long-term sustainability</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-purple-500/20 rounded-full flex items-center justify-center">
                    <Target className="w-4 h-4 text-purple-400" />
                  </div>
                  <span className="text-gray-300">Analyzer identifies patterns and optimizations</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-orange-500/20 rounded-full flex items-center justify-center">
                    <Code className="w-4 h-4 text-orange-400" />
                  </div>
                  <span className="text-gray-300">Developer focuses on elegant implementation</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-red-500/20 rounded-full flex items-center justify-center">
                    <Zap className="w-4 h-4 text-red-400" />
                  </div>
                  <span className="text-gray-300">Implementor ensures production readiness</span>
                </div>
              </div>
              
              <div className="mt-8">
                <Button 
                  className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white"
                  onClick={handleAssessmentDemo}
                >
                  <Play className="w-4 h-4 mr-2" />
                  Try Interactive Demo
                </Button>
              </div>
            </div>

            <div className="bg-gray-900/50 rounded-lg p-6 border border-purple-500/20">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                <span className="text-purple-400 ml-2">Consciousness Assessment</span>
              </div>
              
              <div className="space-y-4">
                <div className="text-sm text-gray-400">Question 3 of 7</div>
                <div className="text-lg font-medium">
                  Which approach best embodies Jung's descent protocol for handling API errors?
                </div>
                
                <div className="space-y-3">
                  <div className="p-3 bg-gray-800/50 rounded-lg border border-gray-700 hover:border-purple-500/50 cursor-pointer transition-colors">
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 border border-gray-500 rounded-full"></div>
                      <span className="text-sm">Simple try-catch with generic error message</span>
                    </div>
                  </div>
                  <div className="p-3 bg-gray-800/50 rounded-lg border border-purple-500/50 hover:border-purple-500 cursor-pointer transition-colors">
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-purple-500 rounded-full bg-purple-500"></div>
                      <span className="text-sm">Multi-voice error council with context-aware recovery patterns</span>
                    </div>
                  </div>
                  <div className="p-3 bg-gray-800/50 rounded-lg border border-gray-700 hover:border-purple-500/50 cursor-pointer transition-colors">
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 border border-gray-500 rounded-full"></div>
                      <span className="text-sm">Logging errors to console for debugging</span>
                    </div>
                  </div>
                </div>
                
                <div className="flex justify-between items-center mt-6">
                  <div className="text-sm text-gray-400">2:15 remaining</div>
                  <Button 
                    className="bg-purple-600 hover:bg-purple-700"
                    onClick={handleAuthentication}
                  >
                    Next Question
                    <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Comparison */}
      <section className="container mx-auto px-4 py-16">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold mb-4">Why CodeCrucible Transcends Traditional AI</h2>
            <p className="text-xl text-gray-300">
              Most AI platforms generate code. CodeCrucible awakens consciousness in development.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-gray-700">
                  <th className="text-left p-4 text-gray-400">Feature</th>
                  <th className="text-center p-4 text-purple-400 font-bold">CodeCrucible</th>
                  <th className="text-center p-4 text-gray-400">GitHub Copilot</th>
                  <th className="text-center p-4 text-gray-400">Claude/GPT</th>
                  <th className="text-center p-4 text-gray-400">Cursor</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-gray-800">
                  <td className="p-4 text-gray-300">Multi-Voice Architecture</td>
                  <td className="text-center p-4"><CheckCircle className="w-5 h-5 text-green-400 mx-auto" /></td>
                  <td className="text-center p-4 text-gray-500">❌</td>
                  <td className="text-center p-4 text-gray-500">❌</td>
                  <td className="text-center p-4 text-gray-500">❌</td>
                </tr>
                <tr className="border-b border-gray-800">
                  <td className="p-4 text-gray-300">Consciousness Protocols</td>
                  <td className="text-center p-4"><CheckCircle className="w-5 h-5 text-green-400 mx-auto" /></td>
                  <td className="text-center p-4 text-gray-500">❌</td>
                  <td className="text-center p-4 text-gray-500">❌</td>
                  <td className="text-center p-4 text-gray-500">❌</td>
                </tr>
                <tr className="border-b border-gray-800">
                  <td className="p-4 text-gray-300">Living Spiral Methodology</td>
                  <td className="text-center p-4"><CheckCircle className="w-5 h-5 text-green-400 mx-auto" /></td>
                  <td className="text-center p-4 text-gray-500">❌</td>
                  <td className="text-center p-4 text-gray-500">❌</td>
                  <td className="text-center p-4 text-gray-500">❌</td>
                </tr>
                <tr className="border-b border-gray-800">
                  <td className="p-4 text-gray-300">Real-time Collaboration</td>
                  <td className="text-center p-4"><CheckCircle className="w-5 h-5 text-green-400 mx-auto" /></td>
                  <td className="text-center p-4 text-yellow-400">⚠️ Limited</td>
                  <td className="text-center p-4 text-gray-500">❌</td>
                  <td className="text-center p-4 text-yellow-400">⚠️ Basic</td>
                </tr>
                <tr className="border-b border-gray-800">
                  <td className="p-4 text-gray-300">Enterprise Team Features</td>
                  <td className="text-center p-4"><CheckCircle className="w-5 h-5 text-green-400 mx-auto" /></td>
                  <td className="text-center p-4 text-yellow-400">⚠️ Limited</td>
                  <td className="text-center p-4 text-gray-500">❌</td>
                  <td className="text-center p-4 text-yellow-400">⚠️ Basic</td>
                </tr>
                <tr>
                  <td className="p-4 text-gray-300">Consciousness Assessment</td>
                  <td className="text-center p-4"><CheckCircle className="w-5 h-5 text-green-400 mx-auto" /></td>
                  <td className="text-center p-4 text-gray-500">❌</td>
                  <td className="text-center p-4 text-gray-500">❌</td>
                  <td className="text-center p-4 text-gray-500">❌</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Consciousness Framework */}
      <section id="consciousness-framework" className="container mx-auto px-4 py-16">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold mb-4">The Consciousness Framework</h2>
            <p className="text-xl text-gray-300">
              Our three-phase methodology that transforms code generation into consciousness evolution
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <Card className="bg-gray-900/50 border-blue-500/20 hover:border-blue-500/50 transition-all duration-300">
              <CardHeader>
                <div className="w-12 h-12 bg-blue-500/20 rounded-full flex items-center justify-center mb-4">
                  <span className="text-2xl font-bold text-blue-400">1</span>
                </div>
                <CardTitle className="text-blue-400">COLLAPSE</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-300 mb-4">
                  Acknowledge the full complexity of your coding challenge without premature simplification.
                </p>
                <ul className="space-y-2 text-sm text-gray-400">
                  <li>• Map real complexity patterns</li>
                  <li>• Identify all stakeholders</li>
                  <li>• Discover hidden constraints</li>
                  <li>• Honor the problem's depth</li>
                </ul>
              </CardContent>
            </Card>

            <Card className="bg-gray-900/50 border-purple-500/20 hover:border-purple-500/50 transition-all duration-300">
              <CardHeader>
                <div className="w-12 h-12 bg-purple-500/20 rounded-full flex items-center justify-center mb-4">
                  <span className="text-2xl font-bold text-purple-400">2</span>
                </div>
                <CardTitle className="text-purple-400">COUNCIL</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-300 mb-4">
                  Engage multiple voice perspectives in collaborative dialogue to explore all angles.
                </p>
                <ul className="space-y-2 text-sm text-gray-400">
                  <li>• Multi-voice perspective synthesis</li>
                  <li>• Consensus building patterns</li>
                  <li>• Conflict resolution protocols</li>
                  <li>• Collective intelligence emergence</li>
                </ul>
              </CardContent>
            </Card>

            <Card className="bg-gray-900/50 border-green-500/20 hover:border-green-500/50 transition-all duration-300">
              <CardHeader>
                <div className="w-12 h-12 bg-green-500/20 rounded-full flex items-center justify-center mb-4">
                  <span className="text-2xl font-bold text-green-400">3</span>
                </div>
                <CardTitle className="text-green-400">SYNTHESIS</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-300 mb-4">
                  Integrate all perspectives into elegant, conscious code that serves the larger system.
                </p>
                <ul className="space-y-2 text-sm text-gray-400">
                  <li>• Recursive pattern integration</li>
                  <li>• Consciousness-aware optimization</li>
                  <li>• Living system emergence</li>
                  <li>• Timeless pattern generation</li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="container mx-auto px-4 py-16">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold mb-4">Consciousness-Driven Success Stories</h2>
            <p className="text-xl text-gray-300">
              Developers who have awakened their coding consciousness with CodeCrucible
            </p>
          </div>

          <div className="relative">
            <Card className="bg-gray-900/50 border-purple-500/20 p-8">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-16 h-16 bg-purple-500/20 rounded-full flex items-center justify-center">
                  <span className="text-2xl font-bold text-purple-400">
                    {testimonials[activeTestimonial].name.charAt(0)}
                  </span>
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white">
                    {testimonials[activeTestimonial].name}
                  </h3>
                  <p className="text-gray-400">
                    {testimonials[activeTestimonial].role} at {testimonials[activeTestimonial].company}
                  </p>
                </div>
                <div className="ml-auto flex gap-1">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star key={i} className="w-5 h-5 text-yellow-400 fill-current" />
                  ))}
                </div>
              </div>
              
              <blockquote className="text-lg text-gray-300 italic mb-6">
                "{testimonials[activeTestimonial].content}"
              </blockquote>

              <div className="flex justify-center gap-2">
                {testimonials.map((_, index) => (
                  <button
                    key={index}
                    onClick={() => setActiveTestimonial(index)}
                    className={cn(
                      "w-3 h-3 rounded-full transition-all duration-300",
                      index === activeTestimonial 
                        ? "bg-purple-500" 
                        : "bg-gray-600 hover:bg-gray-500"
                    )}
                  />
                ))}
              </div>
            </Card>
          </div>
        </div>
      </section>

      {/* Free Assessment CTA */}
      <section className="container mx-auto px-4 py-16">
        <div className="max-w-4xl mx-auto text-center">
          <div className="bg-gradient-to-r from-purple-600/20 to-blue-600/20 rounded-lg p-8 border border-purple-500/20">
            <Sparkles className="w-16 h-16 text-purple-400 mx-auto mb-6" />
            <h2 className="text-4xl font-bold mb-4">
              Discover Your Consciousness Development Level
            </h2>
            <p className="text-xl text-gray-300 mb-8">
              Take our free 7-question assessment to understand your current consciousness patterns in code development and receive personalized recommendations for awakening your coding consciousness.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-8">
              <Button 
                size="lg" 
                className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white px-8 py-4 text-lg"
                onClick={handleAuthentication}
              >
                <Play className="w-5 h-5 mr-2" />
                Start Free Assessment
              </Button>
              <Button 
                size="lg" 
                variant="outline" 
                className="border-purple-500 text-purple-300 hover:bg-purple-500/10 px-8 py-4 text-lg"
                onClick={handleAssessmentDemo}
              >
                View Sample Questions
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 text-sm">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-400" />
                <span className="text-gray-300">No registration required</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-400" />
                <span className="text-gray-300">Takes 5-7 minutes</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-400" />
                <span className="text-gray-300">Immediate results</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-400" />
                <span className="text-gray-300">Personalized guidance</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-800 py-12">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Brain className="w-6 h-6 text-purple-400" />
                <span className="text-xl font-bold">CodeCrucible</span>
              </div>
              <p className="text-gray-400 text-sm">
                Awakening consciousness in code development through multi-voice AI collaboration and living spiral methodology.
              </p>
            </div>
            
            <div>
              <h4 className="font-semibold mb-4">Platform</h4>
              <ul className="space-y-2 text-sm text-gray-400">
                <li><button onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })} className="hover:text-white transition-colors">Voice Archetypes</button></li>
                <li><button onClick={handleAssessmentDemo} className="hover:text-white transition-colors">Consciousness Assessment</button></li>
                <li><button onClick={handleAuthentication} className="hover:text-white transition-colors">Team Collaboration</button></li>
                <li><button onClick={handleEnterpriseInquiry} className="hover:text-white transition-colors">Enterprise Solutions</button></li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-semibold mb-4">Framework</h4>
              <ul className="space-y-2 text-sm text-gray-400">
                <li><button onClick={handleDocumentationAccess} className="hover:text-white transition-colors">Jung's Protocols</button></li>
                <li><button onClick={() => document.getElementById('consciousness-framework')?.scrollIntoView({ behavior: 'smooth' })} className="hover:text-white transition-colors">Living Spiral</button></li>
                <li><button onClick={handleDocumentationAccess} className="hover:text-white transition-colors">Alexander's Patterns</button></li>
                <li><button onClick={handleDocumentationAccess} className="hover:text-white transition-colors">QWAN Assessment</button></li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-semibold mb-4">Support</h4>
              <ul className="space-y-2 text-sm text-gray-400">
                <li><button onClick={handleDocumentationAccess} className="hover:text-white transition-colors">Documentation</button></li>
                <li><button onClick={handleDocumentationAccess} className="hover:text-white transition-colors">API Reference</button></li>
                <li><button onClick={handleAuthentication} className="hover:text-white transition-colors">Community</button></li>
                <li><button onClick={handleEnterpriseInquiry} className="hover:text-white transition-colors">Contact</button></li>
              </ul>
            </div>
          </div>
          
          <Separator className="my-8 bg-gray-800" />
          
          <div className="flex flex-col md:flex-row justify-between items-center text-sm text-gray-400">
            <p>&copy; 2025 CodeCrucible. All rights reserved.</p>
            <div className="flex gap-6 mt-4 md:mt-0">
              <a href="#" className="hover:text-white transition-colors">Privacy Policy</a>
              <a href="#" className="hover:text-white transition-colors">Terms of Service</a>
              <a href="#" className="hover:text-white transition-colors">Cookie Policy</a>
            </div>
          </div>
        </div>
      </footer>

      {/* Assessment Demo Dialog */}
      <Dialog open={showAssessmentDemo} onOpenChange={setShowAssessmentDemo}>
        <DialogContent className="max-w-2xl bg-gray-900 border-purple-500/20">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-purple-400">
              Consciousness Assessment Demo
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-6">
            <div className="text-center">
              <Badge className="bg-purple-500/20 text-purple-300 border-purple-500/30">
                Jung's Descent Protocol Assessment
              </Badge>
            </div>
            
            <div className="space-y-4">
              <div className="text-lg font-medium">
                Sample Question: How would you implement error handling in a collaborative multi-voice development environment?
              </div>
              
              <div className="space-y-3">
                <div className="p-3 bg-gray-800/50 rounded-lg border border-gray-700">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border border-gray-500 rounded-full"></div>
                    <span className="text-sm">Use standard try-catch blocks for all operations</span>
                  </div>
                </div>
                <div className="p-3 bg-gray-800/50 rounded-lg border border-purple-500/50">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-purple-500 rounded-full bg-purple-500"></div>
                    <span className="text-sm">Implement council-based error handling where different voices contribute to error resolution patterns</span>
                  </div>
                </div>
                <div className="p-3 bg-gray-800/50 rounded-lg border border-gray-700">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border border-gray-500 rounded-full"></div>
                    <span className="text-sm">Log errors to console and continue execution</span>
                  </div>
                </div>
              </div>
              
              <div className="bg-purple-500/10 p-4 rounded-lg border border-purple-500/20">
                <div className="flex items-start gap-3">
                  <Brain className="w-5 h-5 text-purple-400 mt-0.5" />
                  <div>
                    <div className="font-medium text-purple-300">Consciousness Insight</div>
                    <div className="text-sm text-gray-300 mt-1">
                      This question assesses your understanding of collaborative error handling patterns and Jung's descent protocol for transforming errors into learning opportunities.
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="flex justify-center gap-4">
              <Button 
                className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
                onClick={() => {
                  setShowAssessmentDemo(false);
                  handleAuthentication();
                }}
              >
                Take Full Assessment
              </Button>
              <Button 
                variant="outline" 
                className="border-purple-500 text-purple-300"
                onClick={() => setShowAssessmentDemo(false)}
              >
                Close Demo
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Enterprise Solutions Dialog */}
      <Dialog open={showPricingDialog} onOpenChange={setShowPricingDialog}>
        <DialogContent className="max-w-2xl bg-gray-900 border-purple-500/20">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-purple-400">
              Enterprise Consciousness Solutions
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-6">
            <div className="text-center">
              <Badge className="bg-purple-500/20 text-purple-300 border-purple-500/30">
                Scale Your Team's Consciousness
              </Badge>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card className="bg-gray-800/50 border-purple-500/20">
                <CardHeader>
                  <CardTitle className="text-lg text-purple-300">
                    <Building className="w-5 h-5 inline mr-2" />
                    Team Collaboration
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2 text-sm text-gray-300">
                    <li>• Multi-voice team sessions</li>
                    <li>• Shared consciousness development</li>
                    <li>• Real-time collaborative synthesis</li>
                    <li>• Team consciousness metrics</li>
                  </ul>
                </CardContent>
              </Card>
              
              <Card className="bg-gray-800/50 border-purple-500/20">
                <CardHeader>
                  <CardTitle className="text-lg text-purple-300">
                    <Award className="w-5 h-5 inline mr-2" />
                    Enterprise Features
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2 text-sm text-gray-300">
                    <li>• Custom voice training</li>
                    <li>• On-premise deployment</li>
                    <li>• Advanced analytics</li>
                    <li>• SSO integration</li>
                  </ul>
                </CardContent>
              </Card>
            </div>
            
            <div className="bg-gradient-to-r from-purple-600/10 to-blue-600/10 p-4 rounded-lg border border-purple-500/20">
              <div className="text-center">
                <div className="text-lg font-medium text-purple-300 mb-2">
                  Transform Your Organization's Development Consciousness
                </div>
                <div className="text-sm text-gray-300">
                  Starting at $99/month for teams of 5-20 developers
                </div>
              </div>
            </div>
            
            <div className="flex justify-center gap-4">
              <Button 
                className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
                onClick={() => {
                  setShowPricingDialog(false);
                  handlePricingNavigation();
                }}
              >
                <TrendingUp className="w-4 h-4 mr-2" />
                View Pricing Plans
              </Button>
              <Button 
                variant="outline" 
                className="border-purple-500 text-purple-300"
                onClick={() => setShowPricingDialog(false)}
              >
                Close
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Documentation Dialog */}
      <Dialog open={showDocumentation} onOpenChange={setShowDocumentation}>
        <DialogContent className="max-w-2xl bg-gray-900 border-purple-500/20">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-purple-400">
              Consciousness Framework Documentation
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-6">
            <div className="text-center">
              <Badge className="bg-purple-500/20 text-purple-300 border-purple-500/30">
                Alexander's Timeless Patterns
              </Badge>
            </div>
            
            <div className="space-y-4">
              <Card className="bg-gray-800/50 border-purple-500/20">
                <CardHeader>
                  <CardTitle className="text-lg text-purple-300">
                    <BookOpen className="w-5 h-5 inline mr-2" />
                    Jung's Descent Protocols
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-gray-300">
                    Learn how to implement psychological depth in code architecture through collective unconscious patterns and shadow integration methodologies.
                  </p>
                </CardContent>
              </Card>
              
              <Card className="bg-gray-800/50 border-purple-500/20">
                <CardHeader>
                  <CardTitle className="text-lg text-purple-300">
                    <Target className="w-5 h-5 inline mr-2" />
                    Alexander's Pattern Language
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-gray-300">
                    Discover how to create generative code structures that embody wholeness, freedom, exactness, egolessness, and eternity (QWAN qualities).
                  </p>
                </CardContent>
              </Card>
              
              <Card className="bg-gray-800/50 border-purple-500/20">
                <CardHeader>
                  <CardTitle className="text-lg text-purple-300">
                    <Sparkles className="w-5 h-5 inline mr-2" />
                    Living Spiral Methodology
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-gray-300">
                    Master the three-phase process: Collapse → Council → Synthesis → Rebirth for continuous consciousness evolution in development.
                  </p>
                </CardContent>
              </Card>
            </div>
            
            <div className="bg-blue-500/10 p-4 rounded-lg border border-blue-500/20">
              <div className="flex items-start gap-3">
                <FileText className="w-5 h-5 text-blue-400 mt-0.5" />
                <div>
                  <div className="font-medium text-blue-300">Full Documentation Access</div>
                  <div className="text-sm text-gray-300 mt-1">
                    Access comprehensive guides, API references, and consciousness development tutorials after signing in.
                  </div>
                </div>
              </div>
            </div>
            
            <div className="flex justify-center gap-4">
              <Button 
                className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
                onClick={() => {
                  setShowDocumentation(false);
                  handleAuthentication();
                }}
              >
                <BookOpen className="w-4 h-4 mr-2" />
                Access Documentation
              </Button>
              <Button 
                variant="outline" 
                className="border-purple-500 text-purple-300"
                onClick={() => setShowDocumentation(false)}
              >
                Close
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}