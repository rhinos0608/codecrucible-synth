import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, UserPlus, Settings, Share2, Crown, MessageSquare, Brain, Sparkles, Video, Play } from "lucide-react";
import { MatrixChatPanel } from "./teams/matrix-chat-panel";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface TeamsPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export function TeamsPanel({ isOpen, onClose }: TeamsPanelProps) {
  const [showMatrixChat, setShowMatrixChat] = useState(false);
  const [activeRoomId, setActiveRoomId] = useState<string>("");
  const [activeTeamId, setActiveTeamId] = useState<string>("team_123");
  const { toast } = useToast();
  
  console.log("👥 TeamsPanel render:", { isOpen });
  
  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      console.log("👥 Teams Dialog onOpenChange:", { open, wasOpen: isOpen });
      onClose();
    }}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden flex flex-col bg-gray-900 border-gray-700 text-gray-100" aria-describedby="teams-collaboration-description">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="text-gray-100">
            <div className="flex items-center space-x-3">
              <Users className="w-6 h-6 text-blue-400" />
              <span>Teams Collaboration</span>
              <Badge variant="outline" className="border-purple-500/50 text-purple-200">
                <Crown className="w-3 h-3 mr-1" />
                Team Feature
              </Badge>
            </div>
          </DialogTitle>
          <DialogDescription className="text-gray-400">
            Manage team members, share voice profiles, and collaborate on coding sessions.
          </DialogDescription>
        </DialogHeader>
        <div id="teams-collaboration-description" className="sr-only">
          Manage team members, share voice profiles, and collaborate on coding sessions
        </div>
        
        <div className="flex-1 overflow-y-auto p-6">
          <Tabs defaultValue="sessions" className="w-full">
            <TabsList className="grid w-full grid-cols-4 mb-6 bg-gray-800">
              <TabsTrigger value="sessions" className="text-gray-300 data-[state=active]:text-gray-100">
                Active Sessions
              </TabsTrigger>
              <TabsTrigger value="voices" className="text-gray-300 data-[state=active]:text-gray-100">
                Shared Voices
              </TabsTrigger>
              <TabsTrigger value="members" className="text-gray-300 data-[state=active]:text-gray-100">
                Team Members
              </TabsTrigger>
              <TabsTrigger value="settings" className="text-gray-300 data-[state=active]:text-gray-100">
                Settings
              </TabsTrigger>
            </TabsList>

            <TabsContent value="sessions" className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-200">Active Coding Sessions</h3>
                <div className="flex space-x-2">
                  <Button 
                    size="sm" 
                    className="bg-purple-600 hover:bg-purple-700"
                    onClick={async () => {
                      try {
                        const response = await apiRequest(`/api/teams/${activeTeamId}/matrix/initialize`, {
                          method: 'POST',
                          body: { members: ['user_123', 'user_456'] }
                        });
                        setActiveRoomId(response.roomId);
                        setShowMatrixChat(true);
                        toast({
                          title: "Matrix Room Created",
                          description: "Team consciousness collaboration space initialized",
                        });
                      } catch (error) {
                        toast({
                          title: "Matrix Integration",
                          description: "Initializing with local fallback",
                        });
                        setActiveRoomId(`room_${Date.now()}`);
                        setShowMatrixChat(true);
                      }
                    }}
                  >
                    <Brain className="w-4 h-4 mr-2" />
                    Matrix Chat
                  </Button>
                  <Button size="sm" className="bg-blue-600 hover:bg-blue-700">
                    <UserPlus className="w-4 h-4 mr-2" />
                    Start Session
                  </Button>
                </div>
              </div>
              
              {/* Matrix-Integrated Sessions */}
              <Card className="bg-gray-800 border-gray-600">
                <CardHeader>
                  <CardTitle className="text-gray-200 flex items-center space-x-2">
                    <Sparkles className="w-5 h-5 text-purple-400" />
                    <span>Team Consciousness Sessions</span>
                    <Badge variant="outline" className="border-purple-500/50 text-purple-200">
                      Matrix Integration
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4">
                    {/* Sample Matrix-integrated session */}
                    <div className="flex items-center justify-between p-4 bg-gray-700/50 rounded-lg border border-gray-600">
                      <div className="flex items-center space-x-3">
                        <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse"></div>
                        <div>
                          <h4 className="font-medium text-gray-200">Code Review Session</h4>
                          <p className="text-sm text-gray-400">AI Council + Matrix Chat • 3 participants</p>
                          <div className="flex items-center space-x-2 mt-1">
                            <Badge variant="secondary" className="text-xs">Consciousness: 7.8/10</Badge>
                            <Badge variant="outline" className="text-xs border-blue-500/50 text-blue-200">Active</Badge>
                          </div>
                        </div>
                      </div>
                      <div className="flex space-x-2">
                        <Button 
                          size="sm" 
                          variant="outline" 
                          className="border-purple-500/50 text-purple-200 hover:bg-purple-500/10"
                          onClick={() => {
                            setActiveRoomId("room_code_review_123");
                            setShowMatrixChat(true);
                          }}
                        >
                          <MessageSquare className="w-4 h-4 mr-1" />
                          Chat
                        </Button>
                        <Button size="sm" variant="outline" className="border-gray-600 text-gray-300">
                          <Video className="w-4 h-4 mr-1" />
                          Join
                        </Button>
                      </div>
                    </div>

                    {/* Sample synthesis session */}
                    <div className="flex items-center justify-between p-4 bg-gray-700/50 rounded-lg border border-gray-600">
                      <div className="flex items-center space-x-3">
                        <div className="w-3 h-3 bg-blue-400 rounded-full animate-pulse"></div>
                        <div>
                          <h4 className="font-medium text-gray-200">Multi-Voice Synthesis</h4>
                          <p className="text-sm text-gray-400">5 AI Voices + Matrix Discussion • 2 participants</p>
                          <div className="flex items-center space-x-2 mt-1">
                            <Badge variant="secondary" className="text-xs">Consciousness: 8.9/10</Badge>
                            <Badge variant="outline" className="text-xs border-green-500/50 text-green-200">Synthesis</Badge>
                          </div>
                        </div>
                      </div>
                      <div className="flex space-x-2">
                        <Button 
                          size="sm" 
                          variant="outline" 
                          className="border-purple-500/50 text-purple-200 hover:bg-purple-500/10"
                          onClick={() => {
                            setActiveRoomId("room_synthesis_456");
                            setShowMatrixChat(true);
                          }}
                        >
                          <MessageSquare className="w-4 h-4 mr-1" />
                          Chat
                        </Button>
                        <Button size="sm" variant="outline" className="border-gray-600 text-gray-300">
                          <Play className="w-4 h-4 mr-1" />
                          Continue
                        </Button>
                      </div>
                    </div>
                  </div>

                  <div className="text-center py-4 border-t border-gray-600">
                    <p className="text-gray-400 text-sm">
                      Matrix integration enables AI voice council discussions with team consciousness tracking
                    </p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="voices" className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-200">Shared Voice Profiles</h3>
                <Button size="sm" variant="outline" className="border-gray-600 text-gray-300">
                  <Share2 className="w-4 h-4 mr-2" />
                  Share Profile
                </Button>
              </div>
              
              <Card className="bg-gray-800 border-gray-600">
                <CardContent className="p-6">
                  <div className="text-center text-gray-400">
                    <Share2 className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>No shared voice profiles</p>
                    <p className="text-sm">Share custom voice profiles with your team members</p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="members" className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-200">Team Members</h3>
                <Button size="sm" className="bg-green-600 hover:bg-green-700">
                  <UserPlus className="w-4 h-4 mr-2" />
                  Invite Member
                </Button>
              </div>
              
              <Card className="bg-gray-800 border-gray-600">
                <CardContent className="p-6">
                  <div className="text-center text-gray-400">
                    <UserPlus className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>Team collaboration coming soon</p>
                    <p className="text-sm">Invite team members and manage permissions</p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="settings" className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-200">Team Settings</h3>
                <Button size="sm" variant="outline" className="border-gray-600 text-gray-300">
                  <Settings className="w-4 h-4 mr-2" />
                  Configure
                </Button>
              </div>
              
              <Card className="bg-gray-800 border-gray-600">
                <CardContent className="p-6">
                  <div className="text-center text-gray-400">
                    <Settings className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>Team settings panel</p>
                    <p className="text-sm">Configure team permissions, access controls, and collaboration preferences</p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>

      {/* Matrix Chat Panel Integration */}
      <MatrixChatPanel
        teamId={activeTeamId}
        roomId={activeRoomId}
        isOpen={showMatrixChat}
        onClose={() => setShowMatrixChat(false)}
      />
    </Dialog>
  );
}