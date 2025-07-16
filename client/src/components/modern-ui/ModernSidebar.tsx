import { useState } from "react";
import { MessageSquare, Plus, FolderOpen, Settings, User, LogOut, Brain, BarChart3, Users, GraduationCap, Crown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import type { Project } from "@shared/schema";
import { useProjects } from "@/hooks/use-projects";
import { useChatSessions } from "@/hooks/use-chat-sessions";
import { useLocation } from "wouter";

interface ModernSidebarProps {
  onProjectSelect?: (project: Project) => void;
  onNewChat?: () => void;
  onNavigate?: (section: string) => void;
  className?: string;
}

export function ModernSidebar({ 
  onProjectSelect, 
  onNewChat, 
  onNavigate,
  className 
}: ModernSidebarProps) {
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [, setLocation] = useLocation();
  
  // Fetch real projects from API
  const { projects = [], isLoading, error } = useProjects();
  
  // Chat session management
  const { createChatSession, isCreating } = useChatSessions();

  console.log('🔍 ModernSidebar Projects:', {
    count: projects.length,
    loading: isLoading,
    error: error?.message,
    projects: projects.map(p => ({ id: p.id, name: p.name, language: p.language }))
  });

  const handleProjectClick = (project: Project) => {
    console.log('📁 Project clicked for chat:', project);
    setSelectedProject(project.id.toString());
    
    // Navigate to chat page with project context
    if (project.chatSessionId) {
      setLocation(`/chat/${project.chatSessionId}`);
    } else {
      // Create new chat session for this project
      console.log('🆕 Creating new chat session for project:', project.id);
      createChatSession({
        projectId: project.id,
        selectedVoice: 'Developer', // Default voice for project discussions
        initialCode: project.code,
        projectName: project.name
      });
      
      // Navigation will be handled by the mutation success callback
    }
  };

  return (
    <div className={cn("h-full bg-gray-900 text-white flex flex-col", className)}>
      {/* Header */}
      <div className="p-4 border-b border-gray-800">
        <div className="flex items-center gap-2 mb-4">
          <Brain className="w-6 h-6 text-purple-400" />
          <span className="font-semibold text-lg">CodeCrucible</span>
        </div>
        
        <Button 
          onClick={() => {
            console.log('💬 New chat button clicked');
            onNewChat();
          }}
          className="w-full bg-gray-800 hover:bg-gray-700 text-white border border-gray-700"
          variant="outline"
        >
          <Plus className="w-4 h-4 mr-2" />
          New chat
        </Button>
      </div>

      {/* Chat History / Projects */}
      <ScrollArea className="flex-1 px-2">
        <div className="space-y-2 py-2">
          {isLoading && (
            <div className="text-center text-gray-400 py-4">
              Loading projects...
            </div>
          )}
          
          {error && (
            <div className="text-center text-red-400 py-4">
              Failed to load projects
            </div>
          )}
          
          {projects.map((project) => (
            <Button
              key={project.id}
              variant={selectedProject === project.id.toString() ? "secondary" : "ghost"}
              className={cn(
                "w-full justify-start text-left h-auto p-3",
                selectedProject === project.id.toString() 
                  ? "bg-gray-800" 
                  : "hover:bg-gray-800"
              )}
              onClick={() => {
                console.log('📁 Project selected:', project.id, project.name);
                handleProjectClick(project);
              }}
            >
              <div className="flex items-start gap-2 w-full">
                <MessageSquare className="w-4 h-4 mt-0.5 flex-shrink-0 text-gray-400" />
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm text-white truncate">
                    {project.name}
                  </div>
                  <div className="text-xs text-gray-400 truncate flex items-center gap-2">
                    <span>{project.language} • {new Date(project.createdAt).toLocaleDateString()}</span>
                    {isCreating && selectedProject === project.id.toString() ? (
                      <div className="animate-spin h-3 w-3 border-2 border-blue-500 border-t-transparent rounded-full flex-shrink-0" />
                    ) : project.chatSessionId ? (
                      <Badge variant="secondary" className="text-xs px-1 py-0">Chat</Badge>
                    ) : null}
                  </div>
                </div>
              </div>
            </Button>
          ))}
          
          {projects.length === 0 && !isLoading && (
            <div className="text-center text-gray-400 py-4">
              No projects yet. Generate some code to get started!
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Navigation */}
      <div className="p-2 border-t border-gray-800">
        <div className="space-y-1">
          <Button
            variant="ghost"
            className="w-full justify-start text-gray-300 hover:text-white hover:bg-gray-800"
            onClick={() => {
              console.log('👤 Voice Profiles navigation clicked');
              onNavigate?.('voice-profiles');
            }}
          >
            <Settings className="w-4 h-4 mr-2" />
            Voice Profiles
          </Button>
          
          <Button
            variant="ghost"
            className="w-full justify-start text-gray-300 hover:text-white hover:bg-gray-800"
            onClick={() => {
              console.log('📊 Analytics navigation clicked');
              onNavigate?.('analytics');
            }}
          >
            <BarChart3 className="w-4 h-4 mr-2" />
            Analytics
          </Button>
          
          <Button
            variant="ghost"
            className="w-full justify-start text-gray-300 hover:text-white hover:bg-gray-800"
            onClick={() => {
              console.log('👥 Teams navigation clicked');
              onNavigate?.('teams');
            }}
          >
            <Users className="w-4 h-4 mr-2" />
            Teams
          </Button>
          
          <Button
            variant="ghost"
            className="w-full justify-start text-gray-300 hover:text-white hover:bg-gray-800"
            onClick={() => {
              console.log('📁 Projects navigation clicked');
              onNavigate?.('projects');
            }}
          >
            <FolderOpen className="w-4 h-4 mr-2" />
            Projects
          </Button>
          
          <Button
            variant="ghost"
            className="w-full justify-start text-gray-300 hover:text-white hover:bg-gray-800"
            onClick={() => {
              console.log('🎓 Learning navigation clicked');
              onNavigate?.('learning');
            }}
          >
            <GraduationCap className="w-4 h-4 mr-2" />
            Learning
            <Badge variant="outline" className="ml-auto text-orange-400 border-orange-400 text-xs">
              Soon
            </Badge>
          </Button>
          
          <Button
            variant="ghost"
            className="w-full justify-start text-gray-300 hover:text-white hover:bg-gray-800"
            onClick={() => {
              console.log('👑 Premium navigation clicked');
              onNavigate?.('premium');
            }}
          >
            <Crown className="w-4 h-4 mr-2" />
            Premium
          </Button>
          
          <Separator className="my-2" />
          
          <Button
            variant="ghost"
            className="w-full justify-start text-gray-300 hover:text-red-300 hover:bg-gray-800"
            onClick={() => {
              console.log('🚪 Logout clicked');
              window.location.href = '/api/logout';
            }}
          >
            <LogOut className="w-4 h-4 mr-2" />
            Logout
          </Button>
        </div>

        <Separator className="my-2 bg-gray-800" />

        {/* User Profile */}
        <div className="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-800">
          <div className="w-8 h-8 rounded-full bg-purple-600 flex items-center justify-center">
            <User className="w-4 h-4" />
          </div>
          <div className="flex-1">
            <div className="text-sm font-medium text-white">Demo User</div>
            <div className="text-xs text-gray-400">Free Plan</div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 text-gray-400 hover:text-white"
            onClick={() => {
              console.log('🚪 Logout button clicked');
              window.location.href = '/api/logout';
            }}
          >
            <LogOut className="w-3 h-3" />
          </Button>
        </div>
      </div>
    </div>
  );
}