import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function Landing() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-4">
      <div className="max-w-4xl mx-auto text-center space-y-8">
        <div className="space-y-4">
          <h1 className="text-5xl font-bold text-white">
            CodeCrucible
          </h1>
          <p className="text-xl text-slate-300 max-w-2xl mx-auto">
            Multi-voice AI coding assistant with advanced perspective synthesis. 
            Experience intelligent code generation through collaborative AI voices.
          </p>
        </div>

        <Card className="bg-white/10 backdrop-blur-sm border-white/20 text-white">
          <CardHeader>
            <CardTitle className="text-2xl">Welcome to the Future of Coding</CardTitle>
            <CardDescription className="text-slate-300">
              Sign in to access your personalized voice profiles and start generating code with multiple AI perspectives.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-left">
              <div className="space-y-2">
                <h3 className="font-semibold text-lg">Multiple Perspectives</h3>
                <p className="text-sm text-slate-300">
                  Generate code from different AI voice archetypes and specialist roles
                </p>
              </div>
              <div className="space-y-2">
                <h3 className="font-semibold text-lg">Smart Synthesis</h3>
                <p className="text-sm text-slate-300">
                  Combine solutions using advanced recursive integration algorithms
                </p>
              </div>
              <div className="space-y-2">
                <h3 className="font-semibold text-lg">Ethical Tracking</h3>
                <p className="text-sm text-slate-300">
                  Monitor decision patterns and learning insights through the Phantom Ledger
                </p>
              </div>
            </div>
            
            <Button 
              size="lg" 
              className="bg-purple-600 hover:bg-purple-700 text-white px-8 py-3 text-lg"
              onClick={() => window.location.href = '/api/login'}
            >
              Sign In to Get Started
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}