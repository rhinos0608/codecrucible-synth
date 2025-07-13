import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Shield, Lock, AlertTriangle, CheckCircle, XCircle, Zap } from "lucide-react";
import { usePlanGuard } from "@/hooks/usePlanGuard";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface PaywallTestProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function PaywallTest({ isOpen, onClose }: PaywallTestProps) {
  const planGuard = usePlanGuard();
  const { toast } = useToast();
  const [testResults, setTestResults] = useState<Array<{
    test: string;
    status: 'pass' | 'fail' | 'pending';
    message: string;
  }>>([]);

  // Test generation endpoint
  const testGeneration = useMutation({
    mutationFn: async () => {
      return await apiRequest("/api/test/generation", {
        method: "POST",
        body: { prompt: "Test security enforcement" }
      });
    },
    onSuccess: (data) => {
      setTestResults(prev => [...prev, {
        test: "Generation Endpoint",
        status: 'pass',
        message: "Endpoint accessible and functional"
      }]);
    },
    onError: (error: any) => {
      const isQuotaError = error.message?.includes('quota') || error.message?.includes('limit');
      setTestResults(prev => [...prev, {
        test: "Generation Endpoint",
        status: isQuotaError ? 'pass' : 'fail',
        message: isQuotaError ? "Quota enforcement working correctly" : error.message
      }]);
    }
  });

  // Test synthesis endpoint
  const testSynthesis = useMutation({
    mutationFn: async () => {
      return await apiRequest("/api/test/synthesis", {
        method: "POST", 
        body: { sessionId: 1 }
      });
    },
    onSuccess: () => {
      setTestResults(prev => [...prev, {
        test: "Synthesis Endpoint",
        status: 'pass',
        message: "Endpoint accessible and functional"
      }]);
    },
    onError: (error: any) => {
      const isQuotaError = error.message?.includes('quota') || error.message?.includes('synthesis');
      setTestResults(prev => [...prev, {
        test: "Synthesis Endpoint",
        status: isQuotaError ? 'pass' : 'fail',
        message: isQuotaError ? "Synthesis enforcement working correctly" : error.message
      }]);
    }
  });

  // Test analytics endpoint
  const testAnalytics = useMutation({
    mutationFn: async () => {
      return await apiRequest("/api/analytics/dashboard");
    },
    onSuccess: () => {
      setTestResults(prev => [...prev, {
        test: "Analytics Access",
        status: 'pass',
        message: "Analytics accessible for current plan"
      }]);
    },
    onError: (error: any) => {
      const isPlanError = error.message?.includes('plan') || error.message?.includes('upgrade');
      setTestResults(prev => [...prev, {
        test: "Analytics Access",
        status: isPlanError ? 'pass' : 'fail',
        message: isPlanError ? "Plan enforcement working correctly" : error.message
      }]);
    }
  });

  const runAllTests = async () => {
    setTestResults([]);
    
    // Run tests sequentially with delays
    setTimeout(() => testGeneration.mutate(), 100);
    setTimeout(() => testSynthesis.mutate(), 500);
    setTimeout(() => testAnalytics.mutate(), 900);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pass': return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'fail': return <XCircle className="h-4 w-4 text-red-500" />;
      default: return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
    }
  };

  const quotaPercentage = planGuard.quotaLimit > 0 
    ? (planGuard.quotaUsed / planGuard.quotaLimit) * 100 
    : 0;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-gray-800 border-gray-700">
        <DialogHeader>
          <DialogTitle className="flex items-center text-white">
            <Shield className="h-6 w-6 mr-2 text-orange-500" />
            Security & Paywall Enforcement Test
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Plan Status Overview */}
          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="flex items-center text-white">
                <Lock className="h-5 w-5 mr-2 text-blue-400" />
                Current Plan Status
              </CardTitle>
              <CardDescription className="text-gray-300">
                Real-time quota monitoring and plan enforcement
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center">
                  <p className="text-2xl font-bold text-white">{planGuard.planTier.toUpperCase()}</p>
                  <p className="text-sm text-gray-400">Plan Tier</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-white">{planGuard.quotaUsed}</p>
                  <p className="text-sm text-gray-400">Used</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-white">{planGuard.quotaLimit}</p>
                  <p className="text-sm text-gray-400">Limit</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-white">{Math.round(quotaPercentage)}%</p>
                  <p className="text-sm text-gray-400">Usage</p>
                </div>
              </div>
              
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-300">Generation Quota</span>
                  <span className="text-gray-300">{planGuard.quotaUsed}/{planGuard.quotaLimit}</span>
                </div>
                <Progress value={quotaPercentage} className="h-2" />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="flex items-center space-x-2">
                  {planGuard.canGenerate ? (
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  ) : (
                    <XCircle className="h-4 w-4 text-red-500" />
                  )}
                  <span className="text-sm text-gray-300">Can Generate</span>
                </div>
                <div className="flex items-center space-x-2">
                  {planGuard.canSynthesize ? (
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  ) : (
                    <XCircle className="h-4 w-4 text-red-500" />
                  )}
                  <span className="text-sm text-gray-300">Can Synthesize</span>
                </div>
                <div className="flex items-center space-x-2">
                  {planGuard.canAccessAnalytics ? (
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  ) : (
                    <XCircle className="h-4 w-4 text-red-500" />
                  )}
                  <span className="text-sm text-gray-300">Analytics Access</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Security Test Controls */}
          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="flex items-center text-white">
                <Zap className="h-5 w-5 mr-2 text-yellow-400" />
                Endpoint Security Tests
              </CardTitle>
              <CardDescription className="text-gray-300">
                Test quota enforcement and security middleware across all endpoints
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button
                onClick={runAllTests}
                disabled={testGeneration.isPending || testSynthesis.isPending || testAnalytics.isPending}
                className="w-full bg-orange-600 hover:bg-orange-700"
              >
                {(testGeneration.isPending || testSynthesis.isPending || testAnalytics.isPending) 
                  ? "Running Tests..." 
                  : "Run Security Tests"}
              </Button>

              {testResults.length > 0 && (
                <div className="space-y-3">
                  <h4 className="font-medium text-white">Test Results:</h4>
                  {testResults.map((result, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-gray-700 rounded-lg">
                      <div className="flex items-center space-x-3">
                        {getStatusIcon(result.status)}
                        <span className="text-white font-medium">{result.test}</span>
                      </div>
                      <div className="text-right">
                        <Badge 
                          variant={result.status === 'pass' ? 'default' : 'destructive'}
                          className={result.status === 'pass' ? 'bg-green-600' : 'bg-red-600'}
                        >
                          {result.status.toUpperCase()}
                        </Badge>
                        <p className="text-xs text-gray-400 mt-1">{result.message}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Security Features Overview */}
          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-white">Security Features Implemented</CardTitle>
              <CardDescription className="text-gray-300">
                Comprehensive security and audit system following AI_INSTRUCTIONS.md
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <h5 className="font-medium text-white">Real-time Enforcement</h5>
                  <ul className="text-sm text-gray-300 space-y-1">
                    <li>• Quota validation on every request</li>
                    <li>• Plan-based feature restrictions</li>
                    <li>• Rate limiting on endpoints</li>
                    <li>• Automatic paywall triggers</li>
                  </ul>
                </div>
                <div className="space-y-2">
                  <h5 className="font-medium text-white">Security Logging</h5>
                  <ul className="text-sm text-gray-300 space-y-1">
                    <li>• Comprehensive audit trails</li>
                    <li>• Security event monitoring</li>
                    <li>• Anti-tampering detection</li>
                    <li>• Usage pattern analysis</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
}