import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BarChart3, TrendingUp, Users, Clock } from "lucide-react";

interface AnalyticsPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AnalyticsPanel({ isOpen, onClose }: AnalyticsPanelProps) {
  console.log("📊 AnalyticsPanel render:", { isOpen });
  
  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      console.log("📊 Analytics Dialog onOpenChange:", { open, wasOpen: isOpen });
      onClose();
    }}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden flex flex-col bg-gray-900 border-gray-700 text-gray-100" aria-describedby="analytics-dashboard-description">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="text-gray-100">
            <div className="flex items-center space-x-3">
              <BarChart3 className="w-6 h-6 text-blue-400" />
              <span>Analytics Dashboard</span>
              <Badge variant="outline" className="border-blue-500/50 text-blue-200">
                Pro Feature
              </Badge>
            </div>
          </DialogTitle>
        </DialogHeader>
        <div id="analytics-dashboard-description" className="sr-only">
          View your voice usage statistics, generation metrics, and performance analytics
        </div>
        
        <div className="flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Usage Metrics */}
            <Card className="bg-gray-800 border-gray-600">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-gray-200">
                  Generation Count
                </CardTitle>
                <TrendingUp className="h-4 w-4 text-blue-400" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-gray-100">24</div>
                <p className="text-xs text-gray-400">
                  +12% from last week
                </p>
              </CardContent>
            </Card>

            {/* Voice Usage */}
            <Card className="bg-gray-800 border-gray-600">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-gray-200">
                  Active Voices
                </CardTitle>
                <Users className="h-4 w-4 text-green-400" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-gray-100">5</div>
                <p className="text-xs text-gray-400">
                  Explorer, Analyzer most used
                </p>
              </CardContent>
            </Card>

            {/* Average Time */}
            <Card className="bg-gray-800 border-gray-600">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-gray-200">
                  Avg. Generation Time
                </CardTitle>
                <Clock className="h-4 w-4 text-orange-400" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-gray-100">1.2s</div>
                <p className="text-xs text-gray-400">
                  -0.3s improvement
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="mt-8">
            <h3 className="text-lg font-semibold text-gray-200 mb-4">Voice Performance Analysis</h3>
            <Card className="bg-gray-800 border-gray-600">
              <CardContent className="p-6">
                <div className="space-y-4">
                  <div className="text-center text-gray-400">
                    <BarChart3 className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>Detailed analytics coming soon</p>
                    <p className="text-sm">Track voice effectiveness, generation patterns, and optimization insights</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}