import { useState } from "react";
import { Brain, Sparkles, Code2, Zap, Users, Settings } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ModernVoiceSelector } from "./ModernVoiceSelector";
import { AppleStyleButton } from "./AppleStyleButton";
import { cn } from "@/lib/utils";

interface ModernDashboardProps {
  className?: string;
  children?: React.ReactNode;
}

export function ModernDashboard({ className, children }: ModernDashboardProps) {
  const [activeView, setActiveView] = useState("main");

  // Mock stats - in real implementation these would come from props/hooks
  const stats = {
    sessionsToday: 12,
    solutionsGenerated: 48,
    synthesisCompleted: 8,
    averageConfidence: 92
  };

  return (
    <div className={cn("min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900", className)}>
      {/* Header Stats */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-r from-purple-500 to-blue-500 flex items-center justify-center">
                  <Brain className="w-5 h-5 text-white" />
                </div>
                Voice Council Dashboard
              </h1>
              <p className="text-gray-600 dark:text-gray-400 mt-1">
                Collaborative AI development workspace
              </p>
            </div>
            
            <div className="flex items-center gap-3">
              <Badge variant="outline" className="font-medium">
                <Zap className="w-3 h-3 mr-1" />
                Apple-Level Performance
              </Badge>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className="modern-card">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                    <Code2 className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">
                      {stats.sessionsToday}
                    </p>
                    <p className="text-xs text-gray-600 dark:text-gray-400">
                      Sessions Today
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="modern-card">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-green-100 dark:bg-green-900 flex items-center justify-center">
                    <Sparkles className="w-5 h-5 text-green-600 dark:text-green-400" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">
                      {stats.solutionsGenerated}
                    </p>
                    <p className="text-xs text-gray-600 dark:text-gray-400">
                      Solutions Generated
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="modern-card">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-purple-100 dark:bg-purple-900 flex items-center justify-center">
                    <Brain className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">
                      {stats.synthesisCompleted}
                    </p>
                    <p className="text-xs text-gray-600 dark:text-gray-400">
                      Synthesis Complete
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="modern-card">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-orange-100 dark:bg-orange-900 flex items-center justify-center">
                    <Zap className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">
                      {stats.averageConfidence}%
                    </p>
                    <p className="text-xs text-gray-600 dark:text-gray-400">
                      Avg Confidence
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto p-6">
        {children}
      </div>
    </div>
  );
}