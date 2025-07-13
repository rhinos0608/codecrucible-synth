// Team Collaboration Panel - AI_INSTRUCTIONS.md Security Patterns
import { useState, useEffect } from "react";
import { Users, Plus, Video, MessageSquare, Share2, Crown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { FeatureGate } from "@/components/FeatureGate";

interface CollaborativeSession {
  id: string;
  teamId: string;
  participants: Participant[];
  sharedVoices: VoiceSelection[];
  status: 'active' | 'paused' | 'completed';
  createdAt: string;
}

interface Participant {
  userId: string;
  role: 'initiator' | 'collaborator' | 'observer';
  joinedAt: string;
  isActive: boolean;
}

interface VoiceSelection {
  perspective: string;
  role: string;
  assignedTo?: string;
}

interface TeamCollaborationPanelProps {
  isOpen: boolean;
  onClose: () => void;
  teamId?: string;
}

export function TeamCollaborationPanel({ isOpen, onClose, teamId }: TeamCollaborationPanelProps) {
  const [newSessionPrompt, setNewSessionPrompt] = useState('');
  const [selectedVoices, setSelectedVoices] = useState<VoiceSelection[]>([]);
  const { toast } = useToast();

  // Fetch active team sessions
  const { data: sessions, isLoading } = useQuery({
    queryKey: ['/api/collaboration/sessions', teamId],
    queryFn: async () => {
      if (!teamId) return [];
      const response = await apiRequest('GET', `/api/collaboration/sessions?teamId=${teamId}`);
      return response.json();
    },
    enabled: !!teamId
  });

  // Create collaborative session mutation
  const createSession = useMutation({
    mutationFn: async (sessionData: any) => {
      const response = await apiRequest('POST', '/api/collaboration/sessions', sessionData);
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Collaborative Session Created",
        description: `Session ${data.id} is now active for team collaboration.`
      });
      setNewSessionPrompt('');
      setSelectedVoices([]);
    },
    onError: (error: any) => {
      toast({
        title: "Session Creation Failed",
        description: error.message || "Failed to create collaborative session. Check your Team subscription.",
        variant: "destructive"
      });
    }
  });

  const handleCreateSession = () => {
    if (!newSessionPrompt.trim() || selectedVoices.length === 0) {
      toast({
        title: "Incomplete Session",
        description: "Please provide a prompt and select at least one voice combination.",
        variant: "destructive"
      });
      return;
    }

    createSession.mutate({
      teamId,
      prompt: newSessionPrompt,
      voices: selectedVoices
    });
  };

  const addVoiceSelection = () => {
    setSelectedVoices(prev => [...prev, {
      perspective: 'Explorer',
      role: 'Full-Stack Developer'
    }]);
  };

  const updateVoiceSelection = (index: number, field: keyof VoiceSelection, value: string) => {
    setSelectedVoices(prev => 
      prev.map((voice, i) => 
        i === index ? { ...voice, [field]: value } : voice
      )
    );
  };

  const removeVoiceSelection = (index: number) => {
    setSelectedVoices(prev => prev.filter((_, i) => i !== index));
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-500" />
            Team Collaboration
            <Badge variant="secondary">Team Feature</Badge>
          </DialogTitle>
          <DialogDescription>
            Create and manage collaborative coding sessions with your team members
          </DialogDescription>
        </DialogHeader>

        <FeatureGate feature="team_collaboration" className="min-h-[400px]">
          <Tabs defaultValue="sessions" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="sessions">Active Sessions</TabsTrigger>
              <TabsTrigger value="create">Create Session</TabsTrigger>
              <TabsTrigger value="history">History</TabsTrigger>
            </TabsList>

            <TabsContent value="sessions" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Active Collaborative Sessions</CardTitle>
                  <CardDescription>
                    Real-time coding sessions with your team members
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {isLoading ? (
                    <div className="text-center py-8">
                      <Users className="w-8 h-8 animate-pulse mx-auto mb-2" />
                      <p>Loading sessions...</p>
                    </div>
                  ) : sessions?.length > 0 ? (
                    <div className="space-y-4">
                      {sessions.map((session: CollaborativeSession) => (
                        <div key={session.id} className="border rounded-lg p-4">
                          <div className="flex items-center justify-between mb-3">
                            <div>
                              <h4 className="font-semibold">Session {session.id.slice(-8)}</h4>
                              <p className="text-sm text-muted-foreground">
                                Created {new Date(session.createdAt).toLocaleDateString()}
                              </p>
                            </div>
                            <Badge variant={session.status === 'active' ? 'default' : 'secondary'}>
                              {session.status}
                            </Badge>
                          </div>
                          
                          <div className="flex items-center gap-2 mb-3">
                            <span className="text-sm font-medium">Participants:</span>
                            <div className="flex gap-1">
                              {session.participants.map((participant, idx) => (
                                <Avatar key={idx} className="w-6 h-6">
                                  <AvatarFallback className="text-xs">
                                    {participant.userId.slice(0, 2).toUpperCase()}
                                  </AvatarFallback>
                                </Avatar>
                              ))}
                            </div>
                            <Badge variant="outline" className="text-xs">
                              {session.participants.length} members
                            </Badge>
                          </div>

                          <div className="flex gap-2">
                            <Button size="sm" variant="outline">
                              <Video className="w-4 h-4 mr-1" />
                              Join Session
                            </Button>
                            <Button size="sm" variant="outline">
                              <MessageSquare className="w-4 h-4 mr-1" />
                              Chat
                            </Button>
                            <Button size="sm" variant="outline">
                              <Share2 className="w-4 h-4 mr-1" />
                              Share
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                      <h3 className="font-semibold mb-2">No Active Sessions</h3>
                      <p className="text-muted-foreground mb-4">
                        Create a new collaborative session to start coding with your team
                      </p>
                      <Button onClick={() => {}} variant="outline">
                        Create First Session
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="create" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Create Collaborative Session</CardTitle>
                  <CardDescription>
                    Start a new real-time coding session with your team
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="prompt">Coding Challenge</Label>
                    <textarea
                      id="prompt"
                      className="w-full p-3 border rounded-md resize-none"
                      rows={4}
                      value={newSessionPrompt}
                      onChange={(e) => setNewSessionPrompt(e.target.value)}
                      placeholder="Describe the coding challenge or project you want to collaborate on..."
                      maxLength={2000}
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label>Voice Combinations</Label>
                      <Button size="sm" variant="outline" onClick={addVoiceSelection}>
                        <Plus className="w-4 h-4 mr-1" />
                        Add Voice
                      </Button>
                    </div>
                    
                    {selectedVoices.length === 0 ? (
                      <div className="border-2 border-dashed border-muted rounded-lg p-6 text-center">
                        <Users className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                        <p className="text-muted-foreground">
                          Add voice combinations for collaborative analysis
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {selectedVoices.map((voice, index) => (
                          <div key={index} className="border rounded-lg p-3">
                            <div className="grid grid-cols-3 gap-3">
                              <div>
                                <Label className="text-xs">Perspective</Label>
                                <select
                                  className="w-full p-2 border rounded text-sm"
                                  value={voice.perspective}
                                  onChange={(e) => updateVoiceSelection(index, 'perspective', e.target.value)}
                                >
                                  <option value="Explorer">Explorer</option>
                                  <option value="Maintainer">Maintainer</option>
                                  <option value="Analyzer">Analyzer</option>
                                  <option value="Developer">Developer</option>
                                  <option value="Implementor">Implementor</option>
                                </select>
                              </div>
                              <div>
                                <Label className="text-xs">Role</Label>
                                <select
                                  className="w-full p-2 border rounded text-sm"
                                  value={voice.role}
                                  onChange={(e) => updateVoiceSelection(index, 'role', e.target.value)}
                                >
                                  <option value="Security Engineer">Security Engineer</option>
                                  <option value="Systems Architect">Systems Architect</option>
                                  <option value="UI/UX Engineer">UI/UX Engineer</option>
                                  <option value="Performance Engineer">Performance Engineer</option>
                                  <option value="Full-Stack Developer">Full-Stack Developer</option>
                                </select>
                              </div>
                              <div className="flex items-end">
                                <Button 
                                  size="sm" 
                                  variant="outline" 
                                  onClick={() => removeVoiceSelection(index)}
                                  className="w-full"
                                >
                                  Remove
                                </Button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <Button 
                    onClick={handleCreateSession}
                    disabled={createSession.isPending}
                    className="w-full"
                  >
                    {createSession.isPending ? (
                      <>
                        <Users className="w-4 h-4 mr-2 animate-spin" />
                        Creating Session...
                      </>
                    ) : (
                      <>
                        <Users className="w-4 h-4 mr-2" />
                        Create Collaborative Session
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="history" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Session History</CardTitle>
                  <CardDescription>
                    Previous collaborative sessions and their outcomes
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-center py-8">
                    <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="font-semibold mb-2">No Session History</h3>
                    <p className="text-muted-foreground">
                      Completed collaborative sessions will appear here
                    </p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </FeatureGate>
      </DialogContent>
    </Dialog>
  );
}

export default TeamCollaborationPanel;