// Teams Page - Collaboration, Voice Sharing, and Team Management
import { useState } from "react";
import { Users, Plus, Settings, Crown, Share2, Bot, Code, MessageSquare, UserMinus, UserPlus } from "lucide-react";
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
import { useTeamSessions, useCreateSession, useJoinSession } from "@/hooks/use-team-sessions";
import { useTeamMembers } from "@/hooks/use-team-members";
import { useSharedVoiceProfiles } from "@/hooks/use-shared-voices";
import { useToast } from "@/hooks/use-toast";

export default function Teams() {
  const [showCollaborationPanel, setShowCollaborationPanel] = useState(false);
  const [showRealTimePanel, setShowRealTimePanel] = useState(false);
  const [selectedSessionId, setSelectedSessionId] = useState<string | undefined>();
  const [showVoiceCustomizer, setShowVoiceCustomizer] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

  // Use real team ID - in production this would come from user's current team
  const teamId = user?.id || 'default-team';

  // Real API hooks replacing mock data
  const { data: sessionsData, isLoading: sessionsLoading, error: sessionsError } = useTeamSessions(teamId);
  const { data: membersData, isLoading: membersLoading, error: membersError } = useTeamMembers(teamId);
  const { data: voicesData, isLoading: voicesLoading, error: voicesError } = useSharedVoiceProfiles(teamId);
  
  const createSessionMutation = useCreateSession();
  const joinSessionMutation = useJoinSession();

  const collaborativeSessions = sessionsData?.sessions || [];
  const teamMembers = membersData?.members || [];
  const sharedVoiceProfiles = voicesData?.sharedProfiles || [];

  const handleStartCollaboration = async () => {
    try {
      const sessionData = {
        name: `New Collaboration Session - ${new Date().toLocaleTimeString()}`,
        prompt: 'Collaborative coding session',
        accessType: 'invite_only' as const,
        selectedVoices: ['Explorer', 'Performance Engineer']
      };
      
      const newSession = await createSessionMutation.mutateAsync(sessionData);
      setSelectedSessionId(newSession.id);
      setShowRealTimePanel(true);
      
      toast({
        title: "Session Created",
        description: "Your collaborative session is ready for team members to join.",
      });
    } catch (error) {
      toast({
        title: "Failed to Create Session",
        description: "There was an error creating the collaboration session. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleJoinSession = async (sessionId: string) => {
    try {
      await joinSessionMutation.mutateAsync({ sessionId, role: 'collaborator' });
      setSelectedSessionId(sessionId);
      setShowRealTimePanel(true);
      
      toast({
        title: "Joined Session",
        description: "You've successfully joined the collaboration session.",
      });
    } catch (error) {
      toast({
        title: "Failed to Join Session",
        description: "There was an error joining the session. Please try again.",
        variant: "destructive",
      });
    }
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
            <Button 
              onClick={handleStartCollaboration}
              disabled={createSessionMutation.isPending}
            >
              <Plus className="w-4 h-4 mr-2" />
              {createSessionMutation.isPending ? 'Creating...' : 'New Session'}
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
                    {sessionsLoading ? (
                      <div className="text-center py-8 text-muted-foreground">
                        Loading sessions...
                      </div>
                    ) : sessionsError ? (
                      <div className="text-center py-8 text-red-500">
                        Failed to load sessions. Please try again.
                      </div>
                    ) : collaborativeSessions.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        No active sessions. Create one to start collaborating!
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {collaborativeSessions.map((session: any) => (
                          <div key={session.id} className="border rounded-lg p-4">
                            <div className="flex items-center justify-between mb-3">
                              <div>
                                <h4 className="font-semibold">{session.name || session.title}</h4>
                                <p className="text-sm text-muted-foreground">
                                  Started {new Date(session.createdAt).toLocaleString()} • {
                                    Array.isArray(session.participants) 
                                      ? (typeof session.participants[0] === 'string' 
                                          ? session.participants.join(', ') 
                                          : `${session.participantCount || session.participants.length} participants`)
                                      : `${session.participantCount || 0} participants`
                                  }
                                </p>
                              </div>
                              <Badge variant={session.status === 'active' ? 'default' : 'secondary'}>
                                {session.status}
                              </Badge>
                            </div>
                            
                            <div className="flex items-center gap-2 mb-3">
                              <span className="text-sm font-medium">Voice Profiles:</span>
                              {(session.voicesUsed || []).map((voice: string, idx: number) => (
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
                                    onClick={() => handleJoinSession(session.id)}
                                    disabled={joinSessionMutation.isPending}
                                  >
                                    <MessageSquare className="w-4 h-4 mr-1" />
                                    {joinSessionMutation.isPending ? 'Joining...' : 'Join Session'}
                                  </Button>
                                  <Button 
                                    size="sm" 
                                    variant="outline"
                                    onClick={() => {
                                      if (session.shareableLink) {
                                        navigator.clipboard.writeText(session.shareableLink);
                                        toast({
                                          title: "Link Copied",
                                          description: "Session link copied to clipboard",
                                        });
                                      }
                                    }}
                                  >
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
                      </div>
                    )}
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

              {voicesLoading ? (
                <div className="text-center py-8 text-muted-foreground">
                  Loading shared voice profiles...
                </div>
              ) : voicesError ? (
                <div className="text-center py-8 text-red-500">
                  Failed to load voice profiles. Please try again.
                </div>
              ) : sharedVoiceProfiles.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No shared voice profiles yet. Create one to get started!
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {sharedVoiceProfiles.map((profile: any) => (
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
                            {(profile.specializations || []).map((spec: string, idx: number) => (
                              <Badge key={idx} variant="outline" className="text-xs">
                                {spec}
                              </Badge>
                            ))}
                          </div>
                          
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">Usage:</span>
                            <span className="font-medium">{profile.usage || 0} times</span>
                          </div>

                          <FeatureGate feature="custom_voices" fallback={
                            <Button variant="outline" size="sm" className="w-full" disabled>
                              <Crown className="w-3 h-3 mr-1" />
                              Upgrade to Use
                            </Button>
                          }>
                            <div className="flex gap-2">
                              <Button 
                                variant="outline" 
                                size="sm" 
                                className="flex-1"
                                onClick={() => {
                                  toast({
                                    title: "Voice Applied",
                                    description: `${profile.name} voice profile is now available for selection.`,
                                  });
                                }}
                              >
                                Use Voice
                              </Button>
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => {
                                  toast({
                                    title: "Voice Shared",
                                    description: `${profile.name} has been shared with the team.`,
                                  });
                                }}
                              >
                                <Share2 className="w-3 h-3" />
                              </Button>
                            </div>
                          </FeatureGate>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
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
                  {membersLoading ? (
                    <div className="text-center py-8 text-muted-foreground">
                      Loading team members...
                    </div>
                  ) : membersError ? (
                    <div className="text-center py-8 text-red-500">
                      Failed to load team members. Please try again.
                    </div>
                  ) : teamMembers.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      No team members yet. Invite colleagues to collaborate!
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {teamMembers.map((member: any) => (
                        <div key={member.id} className="flex items-center justify-between p-3 border rounded-lg">
                          <div className="flex items-center gap-3">
                            <Avatar>
                              <AvatarImage src={member.avatar} />
                              <AvatarFallback>
                                {member.name.split(' ').map((n: string) => n[0]).join('')}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <h4 className="font-medium flex items-center gap-2">
                                {member.name}
                                {member.isActive && (
                                  <Badge variant="outline" className="text-xs bg-green-50 border-green-200 text-green-700">
                                    Online
                                  </Badge>
                                )}
                              </h4>
                              <p className="text-sm text-muted-foreground">{member.email}</p>
                              <p className="text-xs text-muted-foreground">
                                Last active: {new Date(member.lastActive).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline">{member.role}</Badge>
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => {
                                toast({
                                  title: "Member Settings",
                                  description: `Configure settings for ${member.name}.`,
                                });
                              }}
                            >
                              <Settings className="w-3 h-3" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  
                  <div className="mt-4 pt-4 border-t">
                    <Button 
                      variant="outline" 
                      className="w-full"
                      onClick={() => {
                        toast({
                          title: "Team Invitation",
                          description: "Team member invitation feature coming soon!",
                        });
                      }}
                    >
                      <UserPlus className="w-4 h-4 mr-2" />
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