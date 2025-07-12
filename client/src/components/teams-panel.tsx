import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, UserPlus, Settings, Share2, Crown } from "lucide-react";

interface TeamsPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export function TeamsPanel({ isOpen, onClose }: TeamsPanelProps) {
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
                <Button size="sm" className="bg-blue-600 hover:bg-blue-700">
                  <UserPlus className="w-4 h-4 mr-2" />
                  Start Session
                </Button>
              </div>
              
              <Card className="bg-gray-800 border-gray-600">
                <CardContent className="p-6">
                  <div className="text-center text-gray-400">
                    <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>No active sessions</p>
                    <p className="text-sm">Start a collaborative coding session to work together in real-time</p>
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
    </Dialog>
  );
}