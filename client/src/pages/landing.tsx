import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Brain, Users, Zap, Target, ArrowRight, Code, Lightbulb, CheckCircle, Star, Quote } from "lucide-react";
import { LivingSpiralCard } from "@/components/consciousness-driven/LivingSpiralCard";

export default function Landing() {
  const [showAssessmentDemo, setShowAssessmentDemo] = useState(false);
  const [showEnterpriseDialog, setShowEnterpriseDialog] = useState(false);

  // Voice archetypes with consciousness-driven design
  const voiceArchetypes = [
    {
      name: "Explorer",
      description: "Discovers innovative approaches and creative solutions",
      color: "from-blue-500 to-indigo-600",
      personality: "explorer" as const
    },
    {
      name: "Maintainer", 
      description: "Ensures code quality, stability, and long-term sustainability",
      color: "from-green-500 to-emerald-600",
      personality: "maintainer" as const
    },
    {
      name: "Analyzer",
      description: "Deep technical analysis and optimization strategies",
      color: "from-purple-500 to-violet-600", 
      personality: "analyzer" as const
    },
    {
      name: "Developer",
      description: "Rapid prototyping and hands-on implementation",
      color: "from-orange-500 to-red-600",
      personality: "developer" as const
    },
    {
      name: "Implementor",
      description: "Production-ready deployment and scalable architecture",
      color: "from-teal-500 to-cyan-600",
      personality: "implementor" as const
    }
  ];

  const testimonials = [
    {
      name: "Sarah Chen",
      role: "Senior Full Stack Developer",
      company: "TechFlow Inc",
      quote: "CodeCrucible's multi-voice approach revolutionized my development process. The Explorer voice helped me discover React patterns I never considered, while the Maintainer voice ensured my code was production-ready.",
      avatar: "SC"
    },
    {
      name: "Marcus Rodriguez",
      role: "Engineering Manager", 
      company: "CloudScale Solutions",
      quote: "The consciousness-driven development methodology transformed our team's collaboration. Having multiple AI perspectives working together mirrors how our best development sessions actually work.",
      avatar: "MR"
    },
    {
      name: "Dr. Elena Vasquez",
      role: "Research Scientist",
      company: "AI Innovation Labs",
      quote: "The Living Spiral methodology in CodeCrucible aligns perfectly with our research into collaborative AI systems. It's not just a tool—it's a new paradigm for human-AI collaboration.",
      avatar: "EV"
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-900 to-purple-900">
      {/* Navigation Header */}
      <nav className="bg-black/20 backdrop-blur-sm border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-3">
              <Brain className="h-8 w-8 text-purple-400" />
              <span className="text-xl font-bold text-white">CodeCrucible</span>
              <Badge variant="outline" className="border-purple-400 text-purple-400">
                Consciousness-Driven Development
              </Badge>
            </div>
            <div className="flex items-center space-x-4">
              <Button 
                variant="ghost" 
                className="text-white hover:text-purple-300"
                onClick={() => setShowEnterpriseDialog(true)}
              >
                Enterprise
              </Button>
              <Button 
                variant="outline" 
                className="border-purple-400 text-purple-400 hover:bg-purple-400 hover:text-white"
                onClick={() => window.location.href = '/api/login'}
              >
                Sign In
              </Button>
              <Button 
                className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
                onClick={() => window.location.href = '/api/login'}
              >
                Get Started Free
              </Button>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative py-20 px-4 text-center">
        <div className="max-w-6xl mx-auto">
          <Badge className="mb-6 bg-purple-600/20 border-purple-400 text-purple-300">
            <Zap className="w-4 h-4 mr-2" />
            Consciousness Standard for AI-Driven Development
          </Badge>
          
          <h1 className="text-6xl md:text-7xl font-bold text-white mb-6 leading-tight">
            We Don't Just Generate Code—
            <span className="bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
              We Awaken It
            </span>
          </h1>
          
          <p className="text-xl md:text-2xl text-slate-300 mb-8 max-w-4xl mx-auto leading-relaxed">
            The only multi-voice AI development platform that transforms coding through 
            <strong className="text-purple-300"> consciousness-driven collaboration</strong>. 
            Experience the future where AI voices work together like your best development team.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
            <Button 
              size="lg"
              className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white px-8 py-4 text-lg font-semibold"
              onClick={() => setShowAssessmentDemo(true)}
            >
              Try Interactive Demo
              <Target className="ml-2 h-5 w-5" />
            </Button>
            <Button 
              size="lg"
              variant="outline"
              className="border-purple-400 text-purple-400 hover:bg-purple-400 hover:text-white px-8 py-4 text-lg"
              onClick={() => setShowEnterpriseDialog(true)}
            >
              Enterprise Solutions
              <Users className="ml-2 h-5 w-5" />
            </Button>
          </div>

          {/* Key Value Props */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            <div className="flex flex-col items-center text-center">
              <CheckCircle className="h-6 w-6 text-green-400 mb-2" />
              <span className="text-slate-300">No technical background required</span>
            </div>
            <div className="flex flex-col items-center text-center">
              <Star className="h-6 w-6 text-yellow-400 mb-2" />
              <span className="text-slate-300">Consciousness-driven credentials</span>
            </div>
            <div className="flex flex-col items-center text-center">
              <Target className="h-6 w-6 text-blue-400 mb-2" />
              <span className="text-slate-300">Tailored to your development style</span>
            </div>
          </div>
        </div>
      </section>

      {/* Multi-Voice Assessment Preview */}
      <section className="py-16 px-4">
        <div className="max-w-5xl mx-auto">
          <Card className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur-sm border-purple-400/30">
            <CardContent className="p-8">
              <div className="grid md:grid-cols-2 gap-8 items-center">
                <div>
                  <Badge className="mb-4 bg-blue-600/20 border-blue-400 text-blue-300">
                    <Brain className="w-4 h-4 mr-2" />
                    AI Council Assessment
                  </Badge>
                  <h3 className="text-2xl font-bold text-white mb-4">
                    Voice Selection in Progress
                  </h3>
                  <p className="text-slate-300 mb-6">
                    Question 3 of 7 • 1:45 remaining
                  </p>
                  <div className="space-y-4">
                    <h4 className="text-lg font-semibold text-white">
                      Which AI voice combination best describes your development approach?
                    </h4>
                    <div className="space-y-3">
                      <div className="flex items-center space-x-3 p-3 rounded-lg bg-slate-700/50 hover:bg-slate-600/50 cursor-pointer">
                        <div className="w-4 h-4 rounded-full border-2 border-purple-400"></div>
                        <span className="text-slate-300">Explorer + Analyzer: Research-driven innovation</span>
                      </div>
                      <div className="flex items-center space-x-3 p-3 rounded-lg bg-purple-600/20 border border-purple-400">
                        <div className="w-4 h-4 rounded-full bg-purple-400"></div>
                        <span className="text-white">Maintainer + Implementor: Production-focused stability</span>
                      </div>
                      <div className="flex items-center space-x-3 p-3 rounded-lg bg-slate-700/50 hover:bg-slate-600/50 cursor-pointer">
                        <div className="w-4 h-4 rounded-full border-2 border-purple-400"></div>
                        <span className="text-slate-300">Developer + Explorer: Rapid creative prototyping</span>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="text-center">
                  <div className="mb-6">
                    <div className="inline-flex items-center space-x-2 text-sm text-slate-400 mb-2">
                      <span>Progress</span>
                    </div>
                    <div className="w-full bg-slate-700 rounded-full h-2">
                      <div className="bg-gradient-to-r from-purple-500 to-blue-500 h-2 rounded-full" style={{width: '43%'}}></div>
                    </div>
                    <span className="text-xs text-slate-400 mt-1">3/7 questions</span>
                  </div>
                  <Button className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700">
                    Next Question
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* The CodeCrucible Difference */}
      <section className="py-20 px-4">
        <div className="max-w-6xl mx-auto text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
            The CodeCrucible Difference
          </h2>
          <p className="text-xl text-slate-300 max-w-3xl mx-auto">
            Most AI coding tools are single-perspective and mechanistic. CodeCrucible is 
            <strong className="text-purple-300"> multi-dimensional, conscious, and collaborative</strong>.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          <LivingSpiralCard
            title="1. Assess Development Consciousness"
            description="Before generating code, we evaluate your project's context—architecture, team dynamics, and creative requirements."
            voicePersonality="analyzer"
            consciousnessLevel={8}
          >
            <div className="space-y-3">
              <p className="text-sm text-slate-400">
                <strong className="text-white">Why it matters:</strong><br/>
                Most AI tools offer one-size-fits-all solutions. CodeCrucible begins with conscious awareness.
              </p>
              <div className="flex items-center space-x-2 text-xs text-green-400">
                <CheckCircle className="w-4 h-4" />
                <span>Living system assessment</span>
              </div>
            </div>
          </LivingSpiralCard>

          <LivingSpiralCard
            title="2. Activate Through Multi-Voice Council"
            description="No single AI perspective. Every session assembles a council of specialized voices working in conscious collaboration."
            voicePersonality="explorer"
            consciousnessLevel={9}
          >
            <div className="space-y-3">
              <p className="text-sm text-slate-400">
                <strong className="text-white">Key principle:</strong><br/>
                Generate by collaboration. Master through synthesis. 5+ voice archetypes integrated.
              </p>
              <div className="flex items-center space-x-2 text-xs text-blue-400">
                <Brain className="w-4 h-4" />
                <span>Consciousness-driven generation</span>
              </div>
            </div>
          </LivingSpiralCard>

          <LivingSpiralCard
            title="3. Certify Living Code Mastery"
            description="Beyond static certification—your code evolves through consciousness-based feedback and recursive improvement."
            voicePersonality="implementor"
            consciousnessLevel={10}
          >
            <div className="space-y-3">
              <p className="text-sm text-slate-400">
                <strong className="text-white">The difference:</strong><br/>
                No other platform combines multi-voice AI with consciousness-driven evolution.
              </p>
              <div className="flex items-center space-x-2 text-xs text-purple-400">
                <Zap className="w-4 h-4" />
                <span>Living spiral methodology</span>
              </div>
            </div>
          </LivingSpiralCard>
        </div>
      </section>

      {/* Voice Archetypes Showcase */}
      <section className="py-20 px-4 bg-black/20">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
              Meet Your AI Development Council
            </h2>
            <p className="text-xl text-slate-300 max-w-3xl mx-auto">
              Five specialized AI voices, each embodying distinct development consciousness and expertise.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {voiceArchetypes.map((voice, index) => (
              <Card key={voice.name} className="bg-slate-800/50 backdrop-blur-sm border-slate-700 hover:border-purple-400 transition-all duration-300">
                <CardHeader>
                  <div className={`w-12 h-12 rounded-lg bg-gradient-to-r ${voice.color} flex items-center justify-center mb-3`}>
                    <Code className="w-6 h-6 text-white" />
                  </div>
                  <CardTitle className="text-white text-xl">{voice.name}</CardTitle>
                  <CardDescription className="text-slate-400">
                    {voice.description}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400">Consciousness Level</span>
                      <div className="flex space-x-1">
                        {[...Array(5)].map((_, i) => (
                          <div key={i} className={`w-2 h-2 rounded-full ${i < 4 ? 'bg-purple-400' : 'bg-slate-600'}`} />
                        ))}
                      </div>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400">Specialization</span>
                      <Badge className={`bg-gradient-to-r ${voice.color} text-white border-0`}>
                        Active
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-20 px-4">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-4xl md:text-5xl font-bold text-white text-center mb-16">
            What Conscious Developers Say
          </h2>
          
          <div className="grid md:grid-cols-3 gap-8">
            {testimonials.map((testimonial, index) => (
              <Card key={index} className="bg-slate-800/50 backdrop-blur-sm border-slate-700">
                <CardContent className="p-6">
                  <div className="flex items-center mb-4">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-r from-purple-500 to-blue-500 flex items-center justify-center text-white font-bold mr-3">
                      {testimonial.avatar}
                    </div>
                    <div>
                      <h4 className="text-white font-semibold">{testimonial.name}</h4>
                      <p className="text-slate-400 text-sm">{testimonial.role}</p>
                      <p className="text-purple-300 text-xs">{testimonial.company}</p>
                    </div>
                  </div>
                  <Quote className="w-6 h-6 text-purple-400 mb-3" />
                  <p className="text-slate-300 italic leading-relaxed">
                    "{testimonial.quote}"
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <Card className="bg-gradient-to-br from-purple-900/50 to-blue-900/50 backdrop-blur-sm border-purple-400/30">
            <CardContent className="p-12">
              <Lightbulb className="w-16 h-16 text-yellow-400 mx-auto mb-6" />
              <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">
                Ready to Experience Conscious Development?
              </h2>
              <p className="text-xl text-slate-300 mb-8 max-w-2xl mx-auto">
                Join thousands of developers who have discovered the power of multi-voice AI collaboration.
                Start your consciousness-driven development journey today.
              </p>
              
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button 
                  size="lg"
                  className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white px-8 py-4 text-lg font-semibold"
                  onClick={() => window.location.href = '/api/login'}
                >
                  Start Free Development
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
                <Button 
                  size="lg"
                  variant="outline"
                  className="border-purple-400 text-purple-400 hover:bg-purple-400 hover:text-white px-8 py-4 text-lg"
                  onClick={() => setShowAssessmentDemo(true)}
                >
                  Try Voice Assessment
                  <Brain className="ml-2 h-5 w-5" />
                </Button>
              </div>
              
              <div className="flex justify-center items-center mt-8 space-x-8 text-sm text-slate-400">
                <div className="flex items-center">
                  <CheckCircle className="w-4 h-4 mr-2 text-green-400" />
                  No credit card required
                </div>
                <div className="flex items-center">
                  <CheckCircle className="w-4 h-4 mr-2 text-green-400" />
                  Multi-voice generation included
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Assessment Demo Dialog */}
      <Dialog open={showAssessmentDemo} onOpenChange={setShowAssessmentDemo}>
        <DialogContent className="max-w-2xl bg-slate-900 border-purple-400">
          <DialogHeader>
            <DialogTitle className="text-2xl text-white flex items-center">
              <Brain className="w-6 h-6 mr-2 text-purple-400" />
              Consciousness Assessment Demo
            </DialogTitle>
            <DialogDescription className="text-slate-300">
              Experience how our multi-voice AI assessment works to understand your development consciousness.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6">
            <Card className="bg-slate-800 border-slate-700">
              <CardContent className="p-6">
                <p className="text-white mb-4">
                  This interactive demo will guide you through our consciousness-driven development assessment:
                </p>
                <ul className="space-y-2 text-slate-300">
                  <li className="flex items-center">
                    <CheckCircle className="w-4 h-4 mr-2 text-green-400" />
                    Voice archetype preference evaluation
                  </li>
                  <li className="flex items-center">
                    <CheckCircle className="w-4 h-4 mr-2 text-green-400" />
                    Development style consciousness mapping
                  </li>
                  <li className="flex items-center">
                    <CheckCircle className="w-4 h-4 mr-2 text-green-400" />
                    Multi-perspective collaboration readiness
                  </li>
                  <li className="flex items-center">
                    <CheckCircle className="w-4 h-4 mr-2 text-green-400" />
                    Personalized AI council recommendations
                  </li>
                </ul>
              </CardContent>
            </Card>
            <div className="flex justify-end space-x-3">
              <Button variant="outline" onClick={() => setShowAssessmentDemo(false)}>
                Maybe Later
              </Button>
              <Button 
                className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
                onClick={() => {
                  setShowAssessmentDemo(false);
                  window.location.href = '/api/login';
                }}
              >
                Start Assessment
                <Target className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Enterprise Dialog */}
      <Dialog open={showEnterpriseDialog} onOpenChange={setShowEnterpriseDialog}>
        <DialogContent className="max-w-2xl bg-slate-900 border-purple-400">
          <DialogHeader>
            <DialogTitle className="text-2xl text-white flex items-center">
              <Users className="w-6 h-6 mr-2 text-purple-400" />
              Enterprise Consciousness Solutions
            </DialogTitle>
            <DialogDescription className="text-slate-300">
              Transform your organization's development culture with consciousness-driven AI collaboration.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card className="bg-slate-800 border-slate-700">
                <CardContent className="p-4">
                  <h4 className="text-white font-semibold mb-2">Team Assessment</h4>
                  <p className="text-slate-300 text-sm">Consciousness-based evaluation of development teams and collaboration patterns.</p>
                </CardContent>
              </Card>
              <Card className="bg-slate-800 border-slate-700">
                <CardContent className="p-4">
                  <h4 className="text-white font-semibold mb-2">Council Training</h4>
                  <p className="text-slate-300 text-sm">Multi-voice AI integration workshops for development teams.</p>
                </CardContent>
              </Card>
              <Card className="bg-slate-800 border-slate-700">
                <CardContent className="p-4">
                  <h4 className="text-white font-semibold mb-2">Custom Voices</h4>
                  <p className="text-slate-300 text-sm">Organization-specific AI voices tailored to your development culture.</p>
                </CardContent>
              </Card>
              <Card className="bg-slate-800 border-slate-700">
                <CardContent className="p-4">
                  <h4 className="text-white font-semibold mb-2">Consciousness Analytics</h4>
                  <p className="text-slate-300 text-sm">Deep insights into team development consciousness and collaboration patterns.</p>
                </CardContent>
              </Card>
            </div>
            <div className="flex justify-end space-x-3">
              <Button variant="outline" onClick={() => setShowEnterpriseDialog(false)}>
                Learn More Later
              </Button>
              <Button 
                className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
                onClick={() => setShowEnterpriseDialog(false)}
              >
                Contact Enterprise Team
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Footer */}
      <footer className="bg-black/40 border-t border-white/10 py-8 px-4">
        <div className="max-w-6xl mx-auto text-center">
          <div className="flex items-center justify-center space-x-3 mb-4">
            <Brain className="h-6 w-6 text-purple-400" />
            <span className="text-lg font-semibold text-white">CodeCrucible</span>
          </div>
          <p className="text-slate-400 text-sm">
            Consciousness-driven development through multi-voice AI collaboration.
          </p>
        </div>
      </footer>
    </div>
  );
}