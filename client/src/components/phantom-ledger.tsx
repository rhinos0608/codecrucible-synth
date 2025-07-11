import { X, BookOpen, CheckCircle } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { usePhantomLedger, useAnalytics } from "@/hooks/use-solution-generation";
import { format } from "date-fns";

interface DecisionHistoryProps {
  isOpen: boolean;
  onClose: () => void;
}

export function DecisionHistory({ isOpen, onClose }: DecisionHistoryProps) {
  const { data: entries = [], isLoading } = usePhantomLedger();
  const { data: analytics } = useAnalytics();

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle>
            <div>
              <h3 className="text-xl font-semibold">Decision History</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">Code generation decisions and AI engine convergence analysis</p>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="overflow-y-auto max-h-[calc(90vh-120px)] p-1">
          {/* Recent Entries */}
          <div className="mb-6">
            <h4 className="text-lg font-semibold mb-4">Recent Entries</h4>
            <div className="space-y-4">
              {isLoading ? (
                <div className="text-center py-8 text-gray-500">Loading entries...</div>
              ) : entries.length === 0 ? (
                <div className="text-center py-8 text-gray-500">No entries yet. Generate some solutions to start tracking!</div>
              ) : (
                entries.map((entry) => (
                  <Card key={entry.id} className="border border-gray-200 dark:border-gray-700 p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg flex items-center justify-center">
                          <BookOpen className="w-5 h-5 text-white" />
                        </div>
                        <div>
                          <h5 className="font-medium">{entry.title}</h5>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {entry.createdAt ? format(new Date(entry.createdAt), "PPp") : "Today"}
                          </p>
                        </div>
                      </div>
                      <Badge className="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300">
                        Ethical: {entry.ethicalScore}%
                      </Badge>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3">
                      <div>
                        <h6 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Voices Engaged</h6>
                        <div className="flex flex-wrap gap-1">
                          {(entry.voicesEngaged as string[]).map((voice) => (
                            <Badge key={voice} variant="secondary" className="text-xs">
                              {voice}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      <div>
                        <h6 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Decision Outcome</h6>
                        <p className="text-xs text-gray-600 dark:text-gray-400">{entry.decisionOutcome}</p>
                      </div>
                    </div>

                    <div>
                      <h6 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Key Learnings</h6>
                      <ul className="text-xs text-gray-600 dark:text-gray-400 space-y-1">
                        {(entry.keyLearnings as string[]).map((learning, idx) => (
                          <li key={idx}>• {learning}</li>
                        ))}
                      </ul>
                    </div>
                  </Card>
                ))
              )}
            </div>
          </div>

          {/* Analytics Summary */}
          {analytics && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card className="bg-gray-50 dark:bg-gray-700/50 p-4 text-center">
                <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                  {analytics.totalSessions || 0}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Total Sessions</div>
              </Card>
              
              <Card className="bg-gray-50 dark:bg-gray-700/50 p-4 text-center">
                <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                  {Math.round(analytics.averageEthicalScore || 0)}%
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Avg Ethical Score</div>
              </Card>
              
              <Card className="bg-gray-50 dark:bg-gray-700/50 p-4 text-center">
                <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                  {analytics.averageVoicesPerSession?.toFixed(1) || "0.0"}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Avg Voices/Session</div>
              </Card>
              
              <Card className="bg-gray-50 dark:bg-gray-700/50 p-4 text-center">
                <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                  {analytics.learningInsights || 0}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Learning Insights</div>
              </Card>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
