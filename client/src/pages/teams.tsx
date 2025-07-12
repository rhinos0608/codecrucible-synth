// Teams Page - Collaboration, Voice Sharing, and Team Management
import { useState } from "react";
import { Users, Plus, Settings, Crown, Share2, Bot, Code, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/hooks/useAuth";
import { FeatureGate } from "@/components/FeatureGate";
import TeamCollaborationPanel from "@/components/team-collaboration-panel";
import RealTimeCollaborationPanel from "@/components/real-time-collaboration-panel";
import AdvancedAvatarCustomizer from "@/components/advanced-avatar-customizer";

export default function Teams() {
  const [showCollaborationPanel, setShowCollaborationPanel] = useState(false);
  const [showRealTimePanel, setShowRealTimePanel] = useState(false);
  const [selectedSessionId, setSelectedSessionId] = useState<string | undefined>();
  const [showVoiceCustomizer, setShowVoiceCustomizer] = useState(false);
  const { user } = useAuth();

  // Mock team data - in production this would come from API
  const teamMembers = [
    { id: '1', name: 'Alice Chen', email: 'alice@team.com', role: 'Lead Developer', avatar: '/avatars/alice.jpg' },
    { id: '2', name: 'Bob Smith', email: 'bob@team.com', role: 'Backend Engineer', avatar: '/avatars/bob.jpg' },
    { id: '3', name: 'Carol Johnson', email: 'carol@team.com', role: 'Frontend Developer', avatar: '/avatars/carol.jpg' }
  ];

  const sharedVoiceProfiles = [
    { 
      id: '1', 
      name: 'Security-First Architect', 
      creator: 'Alice Chen', 
      specializations: ['Security', 'System Architecture'],
      usage: 24,
      effectiveness: 92
    },
    { 
      id: '2', 
      name: 'React Performance Expert', 
      creator: 'Carol Johnson', 
      specializations: ['React', 'Performance Optimization'],
      usage: 18,
      effectiveness: 87
    },
    { 
      id: '3', 
      name: 'API Design Master', 
      creator: 'Bob Smith', 
      specializations: ['API Development', 'Node.js'],
      usage: 31,
      effectiveness: 89
    }
  ];

  const collaborativeSessions = [
    {
      id: '550e8400-e29b-41d4-a716-446655440001',
      title: 'E-commerce API Refactor',
      participants: ['Alice Chen', 'Bob Smith'],
      status: 'active',
      startTime: '2 hours ago',
      voicesUsed: ['Security-First Architect', 'API Design Master']
    },
    {
      id: '2',
      title: 'Frontend Component Library',
      participants: ['Carol Johnson', 'Alice Chen'],
      status: 'completed',
      startTime: '1 day ago',
      voicesUsed: ['React Performance Expert']
    }
  ];

  const handleStartCollaboration = () => {
    setShowRealTimePanel(true);
    setSelectedSessionId(undefined); // New session
  };

  const handleJoinSession = (sessionId: string) => {
    setSelectedSessionId(sessionId);
    setShowRealTimePanel(true);
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Users className="w-8 h-8 text-blue-500" />
              Team Collaboration
            </h1>
            <p className="text-muted-foreground mt-2">
              Collaborate on code, share voice profiles, and work together in real-time
            </p>
          </div>
          <FeatureGate feature="team_collaboration">
            <Button onClick={handleStartCollaboration}>
              <Plus className="w-4 h-4 mr-2" />
              New Session
            </Button>
          </FeatureGate>
        </div>

        <FeatureGate feature="team_collaboration">
          <Tabs defaultValue="sessions" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="sessions">Active Sessions</TabsTrigger>
              <TabsTrigger value="voices">Shared Voices</TabsTrigger>
              <TabsTrigger value="members">Team Members</TabsTrigger>
              <TabsTrigger value="settings">Settings</TabsTrigger>
            </TabsList>

            <TabsContent value="sessions" className="space-y-6">
              <div className="grid gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Code className="w-5 h-5 text-green-500" />
                      Collaborative Coding Sessions
                    </CardTitle>
                    <CardDescription>
                      Real-time coding sessions where team members can collaborate with shared voice profiles
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {collaborativeSessions.map((session) => (
                        <div key={session.id} className="border rounded-lg p-4">
                          <div className="flex items-center justify-between mb-3">
                            <div>
                              <h4 className="font-semibold">{session.title}</h4>
                              <p className="text-sm text-muted-foreground">
                                Started {session.startTime} • {session.participants.join(', ')}
                              </p>
                            </div>
                            <Badge variant={session.status === 'active' ? 'default' : 'secondary'}>
                              {session.status}
                            </Badge>
                          </div>
                          
                          <div className="flex items-center gap-2 mb-3">
                            <span className="text-sm font-medium">Voice Profiles:</span>
                            {session.voicesUsed.map((voice, idx) => (
                              <Badge key={idx} variant="outline" className="text-xs">
                                <Bot className="w-3 h-3 mr-1" />
                                {voice}
                              </Badge>
                            ))}
                          </div>

                          <div className="flex gap-2">
                            {session.status === 'active' ? (
                              <>
                                <Button 
                                  size="sm" 
                                  variant="default"
                                  onClick={() => {
                                    setSelectedSessionId(session.id);
                                    setShowRealTimePanel(true);
                                  }}
                                >
                                  <MessageSquare className="w-4 h-4 mr-1" />
                                  Join Session
                                </Button>
                                <Button size="sm" variant="outline">
                                  <Share2 className="w-4 h-4 mr-1" />
                                  Share Link
                                </Button>
                              </>
                            ) : (
                              <Button 
                                size="sm" 
                                variant="outline"
                                onClick={() => {
                                  setSelectedSessionId(session.id);
                                  setShowRealTimePanel(true);
                                }}
                              >
                                View Results
                              </Button>
                            )}
                          </div>
                        </div>
                      ))}
                      
                      {collaborativeSessions.length === 0 && (
                        <div className="text-center py-8">
                          <Code className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                          <h3 className="font-semibold mb-2">No Active Sessions</h3>
                          <p className="text-muted-foreground mb-4">
                            Start a collaborative coding session to work with your team
                          </p>
                          <Button onClick={() => setShowCollaborationPanel(true)}>
                            Create Session
                          </Button>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="voices" className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold">Shared Voice Profiles</h3>
                  <p className="text-sm text-muted-foreground">
                    Custom voice profiles created and shared by team members
                  </p>
                </div>
                <FeatureGate feature="custom_voices">
                  <Button onClick={() => setShowVoiceCustomizer(true)}>
                    <Plus className="w-4 h-4 mr-2" />
                    Create Voice
                  </Button>
                </FeatureGate>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {sharedVoiceProfiles.map((profile) => (
                  <Card key={profile.id} className="hover:shadow-md transition-shadow">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base flex items-center gap-2">
                          <Bot className="w-4 h-4 text-purple-500" />
                          {profile.name}
                        </CardTitle>
                        <FeatureGate feature="custom_voices" fallback={
                          <Badge variant="outline" className="text-xs">
                            <Crown className="w-3 h-3 mr-1" />
                            Pro
                          </Badge>
                        }>
                          <Badge variant="secondary" className="text-xs">
                            {profile.effectiveness}% effective
                          </Badge>
                        </FeatureGate>
                      </div>
                      <CardDescription className="text-sm">
                        Created by {profile.creator}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="space-y-3">
                        <div className="flex flex-wrap gap-1">
                          {profile.specializations.map((spec, idx) => (
                            <Badge key={idx} variant="outline" className="text-xs">
                              {spec}
                            </Badge>
                          ))}
                        </div>
                        
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Usage:</span>
                          <span className="font-medium">{profile.usage} times</span>
                        </div>

                        <FeatureGate feature="custom_voices" fallback={
                          <Button variant="outline" size="sm" className="w-full" disabled>
                            <Crown className="w-3 h-3 mr-1" />
                            Upgrade to Use
                          </Button>
                        }>
                          <div className="flex gap-2">
                            <Button variant="outline" size="sm" className="flex-1">
                              Use Voice
                            </Button>
                            <Button variant="outline" size="sm">
                              <Share2 className="w-3 h-3" />
                            </Button>
                          </div>
                        </FeatureGate>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="members" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="w-5 h-5 text-blue-500" />
                    Team Members
                  </CardTitle>
                  <CardDescription>
                    Manage your team members and their roles
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {teamMembers.map((member) => (
                      <div key={member.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center gap-3">
                          <Avatar>
                            <AvatarImage src={member.avatar} />
                            <AvatarFallback>
                              {member.name.split(' ').map(n => n[0]).join('')}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <h4 className="font-medium">{member.name}</h4>
                            <p className="text-sm text-muted-foreground">{member.email}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">{member.role}</Badge>
                          <Button variant="outline" size="sm">
                            <Settings className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    ))}
                    
                    <Button variant="outline" className="w-full">
                      <Plus className="w-4 h-4 mr-2" />
                      Invite Team Member
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="settings" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Team Settings</CardTitle>
                  <CardDescription>
                    Configure your team's collaboration preferences
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <h4 className="font-medium">Voice Profile Sharing</h4>
                    <p className="text-sm text-muted-foreground">
                      Allow team members to share and use each other's custom voice profiles
                    </p>
                    <div className="flex items-center gap-2">
                      <input type="checkbox" id="sharing" defaultChecked />
                      <label htmlFor="sharing" className="text-sm">Enable voice profile sharing</label>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <h4 className="font-medium">Session Recording</h4>
                    <p className="text-sm text-muted-foreground">
                      Record collaborative sessions for review and learning
                    </p>
                    <div className="flex items-center gap-2">
                      <input type="checkbox" id="recording" defaultChecked />
                      <label htmlFor="recording" className="text-sm">Enable session recording</label>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </FeatureGate>

        {/* Dialogs */}
        <TeamCollaborationPanel
          isOpen={showCollaborationPanel}
          onClose={() => setShowCollaborationPanel(false)}
          teamId="team_123"
        />

        <AdvancedAvatarCustomizer
          isOpen={showVoiceCustomizer}
          onClose={() => setShowVoiceCustomizer(false)}
          onSave={() => {}}
        />

        {/* Real-Time Collaboration Panel */}
        {showRealTimePanel && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <RealTimeCollaborationPanel
              sessionId={selectedSessionId}
              onClose={() => {
                setShowRealTimePanel(false);
                setSelectedSessionId(undefined);
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}