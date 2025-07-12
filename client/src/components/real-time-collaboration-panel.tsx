// Real-Time Collaboration Panel - Production Implementation
import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Users, 
  MessageSquare, 
  Share2, 
  Copy, 
  Play, 
  Settings, 
  Eye, 
  Code, 
  Send,
  Clock,
  CheckCircle,
  AlertCircle,
  UserPlus
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { isFrontendDevModeEnabled } from '@/lib/dev-mode';

interface CollaborativeSession {
  id: string;
  name: string;
  creatorId: string;
  shareableLink: string;
  accessType: 'public' | 'team_only' | 'invite_only';
  participants: SessionParticipant[];
  prompt: string;
  selectedVoices: string[];
  voiceOutputs: Record<string, any>;
  synthesis?: any;
  status: 'active' | 'paused' | 'completed';
  createdAt: Date;
  lastActivity: Date;
  voiceAssignments: VoiceAssignment[];
  chatMessages: ChatMessage[];
}

interface SessionParticipant {
  userId: string;
  name: string;
  role: 'creator' | 'collaborator' | 'observer';
  isActive: boolean;
  assignedVoices: string[];
  joinedAt: Date;
  lastSeenAt: Date;
}

interface VoiceAssignment {
  voiceType: string;
  assignedTo?: string;
  status: 'available' | 'assigned' | 'generating' | 'completed';
}

interface ChatMessage {
  id: string;
  userId: string;
  message: string;
  messageType: 'text' | 'system';
  createdAt: Date;
}

interface RealTimeCollaborationPanelProps {
  sessionId?: string;
  onClose: () => void;
}

export default function RealTimeCollaborationPanel({ sessionId, onClose }: RealTimeCollaborationPanelProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'chat' | 'voices' | 'participants'>('overview');
  const [newMessage, setNewMessage] = useState('');
  const [newSessionName, setNewSessionName] = useState('');
  const [accessType, setAccessType] = useState<'public' | 'team_only' | 'invite_only'>('team_only');
  const [websocket, setWebsocket] = useState<WebSocket | null>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Fetch collaborative sessions
  const { data: sessions = [], isLoading: sessionsLoading } = useQuery({
    queryKey: ['/api/collaboration/sessions'],
    enabled: !sessionId
  });

  // Fetch specific session details if sessionId provided
  const { data: currentSession, isLoading: sessionLoading } = useQuery({
    queryKey: ['/api/collaboration/sessions', sessionId],
    enabled: !!sessionId
  });

  // Create new session mutation
  const createSessionMutation = useMutation({
    mutationFn: (data: any) => apiRequest('/api/collaboration/sessions', {
      method: 'POST',
      body: JSON.stringify(data)
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/collaboration/sessions'] });
      setNewSessionName('');
    }
  });

  // Send chat message mutation
  const sendMessageMutation = useMutation({
    mutationFn: ({ sessionId, message }: { sessionId: string; message: string }) =>
      apiRequest(`/api/collaboration/sessions/${sessionId}/chat`, {
        method: 'POST',
        body: JSON.stringify({ message })
      }),
    onSuccess: () => {
      setNewMessage('');
      if (sessionId) {
        queryClient.invalidateQueries({ queryKey: ['/api/collaboration/sessions', sessionId] });
      }
    }
  });

  // Join session mutation
  const joinSessionMutation = useMutation({
    mutationFn: ({ sessionId, role }: { sessionId: string; role: string }) =>
      apiRequest(`/api/collaboration/sessions/${sessionId}/join`, {
        method: 'POST',
        body: JSON.stringify({ role })
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/collaboration/sessions'] });
    }
  });

  // Initialize WebSocket connection for real-time updates
  useEffect(() => {
    if (currentSession && user) {
      const wsUrl = `wss://${window.location.host}/collaboration?sessionId=${currentSession.id}&userId=${user.id}&token=mock-token`;
      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        console.log('Connected to collaboration WebSocket');
      };

      ws.onmessage = (event) => {
        const message = JSON.parse(event.data);
        console.log('WebSocket message received:', message);
        
        // Handle real-time updates
        switch (message.type) {
          case 'participant_joined':
          case 'participant_left':
          case 'voice_assignment':
          case 'voice_output':
          case 'chat_message':
            // Refresh session data
            queryClient.invalidateQueries({ queryKey: ['/api/collaboration/sessions', sessionId] });
            break;
        }
      };

      ws.onclose = () => {
        console.log('Disconnected from collaboration WebSocket');
      };

      setWebsocket(ws);

      return () => {
        ws.close();
      };
    }
  }, [currentSession, user, sessionId, queryClient]);

  // Auto-scroll chat to bottom
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [currentSession?.chatMessages]);

  const handleCreateSession = () => {
    if (!newSessionName.trim()) return;

    createSessionMutation.mutate({
      name: newSessionName,
      accessType,
      prompt: '',
      teamId: null
    });
  };

  const handleSendMessage = () => {
    if (!newMessage.trim() || !sessionId) return;

    sendMessageMutation.mutate({
      sessionId,
      message: newMessage
    });
  };

  const handleJoinSession = (sessionId: string, role: string = 'collaborator') => {
    joinSessionMutation.mutate({ sessionId, role });
  };

  const copyShareableLink = (link: string) => {
    navigator.clipboard.writeText(link);
    // Show toast notification
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-500';
      case 'paused': return 'bg-yellow-500';
      case 'completed': return 'bg-gray-500';
      default: return 'bg-gray-400';
    }
  };

  const getVoiceStatusIcon = (status: string) => {
    switch (status) {
      case 'available': return <AlertCircle className="w-4 h-4 text-orange-500" />;
      case 'assigned': return <Clock className="w-4 h-4 text-blue-500" />;
      case 'generating': return <Play className="w-4 h-4 text-purple-500" />;
      case 'completed': return <CheckCircle className="w-4 h-4 text-green-500" />;
      default: return <AlertCircle className="w-4 h-4 text-gray-500" />;
    }
  };

  const formatTimeAgo = (date: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - new Date(date).getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  };

  // Show session list if no specific session selected
  if (!sessionId) {
    return (
      <Card className="w-full max-w-4xl mx-auto">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-6 h-6" />
                Real-Time Collaboration Sessions
                {isFrontendDevModeEnabled() && (
                  <Badge variant="outline" className="text-xs">DEV 🔧</Badge>
                )}
              </CardTitle>
              <CardDescription>
                Create and join collaborative coding sessions with real-time voice assignment
              </CardDescription>
            </div>
            <Button onClick={onClose} variant="outline">Close</Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Create New Session */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Create New Session</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-4">
                <Input
                  placeholder="Session name..."
                  value={newSessionName}
                  onChange={(e) => setNewSessionName(e.target.value)}
                  className="flex-1"
                />
                <Select value={accessType} onValueChange={(value: any) => setAccessType(value)}>
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="team_only">Team Only</SelectItem>
                    <SelectItem value="invite_only">Invite Only</SelectItem>
                    <SelectItem value="public">Public</SelectItem>
                  </SelectContent>
                </Select>
                <Button 
                  onClick={handleCreateSession}
                  disabled={!newSessionName.trim() || createSessionMutation.isPending}
                >
                  Create Session
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Active Sessions */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Active Sessions</h3>
            {sessionsLoading ? (
              <div className="text-center py-8 text-muted-foreground">Loading sessions...</div>
            ) : sessions.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No active sessions found. Create one to get started!
              </div>
            ) : (
              <div className="grid gap-4">
                {sessions.map((session: CollaborativeSession) => (
                  <Card key={session.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <h4 className="font-semibold">{session.name}</h4>
                            <div className={`w-2 h-2 rounded-full ${getStatusColor(session.status)}`} />
                            <Badge variant="outline" className="text-xs">
                              {session.accessType.replace('_', ' ')}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground mb-2 line-clamp-2">
                            {session.prompt || 'No prompt set'}
                          </p>
                          <div className="flex items-center gap-4 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Users className="w-3 h-3" />
                              {session.participants.length} participants
                            </span>
                            <span>Created {formatTimeAgo(session.createdAt)}</span>
                            <span>Active {formatTimeAgo(session.lastActivity)}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => copyShareableLink(session.shareableLink)}
                          >
                            <Copy className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => handleJoinSession(session.id)}
                            disabled={joinSessionMutation.isPending}
                          >
                            <UserPlus className="w-4 h-4 mr-1" />
                            Join
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  // Show specific session interface
  if (sessionLoading) {
    return (
      <Card className="w-full max-w-6xl mx-auto">
        <CardContent className="p-8 text-center">
          <div className="text-muted-foreground">Loading session...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-6xl mx-auto">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Code className="w-6 h-6" />
              {currentSession?.name}
              <div className={`w-2 h-2 rounded-full ${getStatusColor(currentSession?.status || 'active')}`} />
              {isFrontendDevModeEnabled() && (
                <Badge variant="outline" className="text-xs">DEV 🔧</Badge>
              )}
            </CardTitle>
            <CardDescription className="flex items-center gap-4">
              <span>{currentSession?.participants.length} participants</span>
              <span>•</span>
              <span>Last activity {formatTimeAgo(currentSession?.lastActivity || new Date())}</span>
              <Button
                size="sm"
                variant="outline"
                onClick={() => copyShareableLink(currentSession?.shareableLink || '')}
                className="ml-4"
              >
                <Share2 className="w-3 h-3 mr-1" />
                Share
              </Button>
            </CardDescription>
          </div>
          <Button onClick={onClose} variant="outline">Close</Button>
        </div>
      </CardHeader>
      <CardContent>
        {/* Tab Navigation */}
        <div className="flex space-x-1 mb-6 border-b">
          {[
            { id: 'overview', label: 'Overview', icon: Eye },
            { id: 'voices', label: 'Voice Assignments', icon: Code },
            { id: 'chat', label: 'Chat', icon: MessageSquare },
            { id: 'participants', label: 'Participants', icon: Users }
          ].map(({ id, label, icon: Icon }) => (
            <Button
              key={id}
              variant={activeTab === id ? 'secondary' : 'ghost'}
              onClick={() => setActiveTab(id as any)}
              className="flex items-center gap-2"
            >
              <Icon className="w-4 h-4" />
              {label}
              {id === 'chat' && currentSession?.chatMessages.length > 0 && (
                <Badge variant="secondary" className="ml-1 text-xs">
                  {currentSession.chatMessages.length}
                </Badge>
              )}
            </Button>
          ))}
        </div>

        {/* Tab Content */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            <div>
              <h3 className="font-semibold mb-2">Session Prompt</h3>
              <Textarea
                value={currentSession?.prompt || ''}
                placeholder="Enter your collaborative coding challenge here..."
                className="min-h-20"
                readOnly={currentSession?.creatorId !== user?.id}
              />
            </div>
            
            <div className="grid md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Voice Progress</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {currentSession?.voiceAssignments.map((assignment) => (
                      <div key={assignment.voiceType} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {getVoiceStatusIcon(assignment.status)}
                          <span className="font-medium">{assignment.voiceType}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          {assignment.assignedTo && (
                            <Badge variant="outline" className="text-xs">
                              {currentSession.participants.find(p => p.userId === assignment.assignedTo)?.name || 'Unknown'}
                            </Badge>
                          )}
                          <Badge variant={assignment.status === 'completed' ? 'default' : 'secondary'}>
                            {assignment.status}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Generated Code</CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-40">
                    <div className="space-y-3">
                      {Object.entries(currentSession?.voiceOutputs || {}).map(([voiceType, output]: [string, any]) => (
                        <div key={voiceType} className="border rounded p-3">
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-medium text-sm">{voiceType}</span>
                            <Badge className="text-xs">
                              {output.confidence}% confidence
                            </Badge>
                          </div>
                          <code className="text-xs bg-muted p-2 rounded block overflow-x-auto">
                            {output.code.substring(0, 150)}...
                          </code>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {activeTab === 'voices' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Voice Assignments</h3>
              <Button size="sm" variant="outline">
                <Plus className="w-4 h-4 mr-1" />
                Assign Voice
              </Button>
            </div>
            
            <div className="grid gap-4">
              {currentSession?.voiceAssignments.map((assignment) => (
                <Card key={assignment.voiceType}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        {getVoiceStatusIcon(assignment.status)}
                        <h4 className="font-semibold">{assignment.voiceType}</h4>
                      </div>
                      <Badge variant={assignment.status === 'completed' ? 'default' : 'secondary'}>
                        {assignment.status}
                      </Badge>
                    </div>
                    
                    {assignment.assignedTo ? (
                      <div className="flex items-center gap-2 mb-3">
                        <Avatar className="w-6 h-6">
                          <AvatarFallback className="text-xs">
                            {currentSession.participants.find(p => p.userId === assignment.assignedTo)?.name?.charAt(0) || '?'}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-sm">
                          Assigned to {currentSession.participants.find(p => p.userId === assignment.assignedTo)?.name || 'Unknown'}
                        </span>
                      </div>
                    ) : (
                      <div className="text-sm text-muted-foreground mb-3">
                        Available for assignment
                      </div>
                    )}

                    {currentSession.voiceOutputs[assignment.voiceType] && (
                      <div className="border rounded p-3 bg-muted">
                        <div className="text-sm font-medium mb-2">Generated Output:</div>
                        <code className="text-xs block overflow-x-auto">
                          {currentSession.voiceOutputs[assignment.voiceType].code}
                        </code>
                        <div className="text-xs text-muted-foreground mt-2">
                          {currentSession.voiceOutputs[assignment.voiceType].explanation}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'chat' && (
          <div className="space-y-4">
            <ScrollArea className="h-96 border rounded p-4" ref={chatScrollRef}>
              <div className="space-y-3">
                {currentSession?.chatMessages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex gap-3 ${message.messageType === 'system' ? 'justify-center' : ''}`}
                  >
                    {message.messageType !== 'system' && (
                      <Avatar className="w-8 h-8">
                        <AvatarFallback className="text-xs">
                          {currentSession.participants.find(p => p.userId === message.userId)?.name?.charAt(0) || '?'}
                        </AvatarFallback>
                      </Avatar>
                    )}
                    <div className={`flex-1 ${message.messageType === 'system' ? 'text-center' : ''}`}>
                      {message.messageType !== 'system' && (
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium text-sm">
                            {message.userId === user?.id 
                              ? 'You' 
                              : currentSession.participants.find(p => p.userId === message.userId)?.name || 'Unknown'
                            }
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {formatTimeAgo(message.createdAt)}
                          </span>
                        </div>
                      )}
                      <div className={`${
                        message.messageType === 'system' 
                          ? 'text-xs text-muted-foreground bg-muted px-3 py-1 rounded-full inline-block' 
                          : 'text-sm'
                      }`}>
                        {message.message}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
            
            <div className="flex gap-2">
              <Input
                placeholder="Type a message..."
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                className="flex-1"
              />
              <Button 
                onClick={handleSendMessage}
                disabled={!newMessage.trim() || sendMessageMutation.isPending}
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}

        {activeTab === 'participants' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Session Participants</h3>
              <Button size="sm" variant="outline">
                <UserPlus className="w-4 h-4 mr-1" />
                Invite
              </Button>
            </div>
            
            <div className="grid gap-3">
              {currentSession?.participants.map((participant) => (
                <Card key={participant.userId}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Avatar>
                          <AvatarFallback>
                            {participant.name.charAt(0)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{participant.name}</span>
                            {participant.userId === user?.id && (
                              <Badge variant="secondary" className="text-xs">You</Badge>
                            )}
                            {participant.isActive && (
                              <div className="w-2 h-2 bg-green-500 rounded-full" title="Active" />
                            )}
                          </div>
                          <div className="text-sm text-muted-foreground capitalize">
                            {participant.role}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm text-muted-foreground">
                          Joined {formatTimeAgo(participant.joinedAt)}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Last seen {formatTimeAgo(participant.lastSeenAt)}
                        </div>
                        {participant.assignedVoices.length > 0 && (
                          <div className="flex gap-1 mt-1">
                            {participant.assignedVoices.map((voice) => (
                              <Badge key={voice} variant="outline" className="text-xs">
                                {voice}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}