import { useState } from "react";
import { MessageSquare, Plus, FolderOpen, Settings, User, LogOut, Brain, BarChart3, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import type { Project } from "@shared/schema";

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

  // Mock projects for layout testing
  const projects = [
    { id: "1", title: "React Dashboard", language: "TypeScript", lastModified: "2 hours ago" },
    { id: "2", title: "API Integration", language: "Node.js", lastModified: "Yesterday" },
    { id: "3", title: "Authentication Flow", language: "React", lastModified: "3 days ago" },
    { id: "4", title: "Database Schema", language: "SQL", lastModified: "1 week ago" },
  ];

  const handleProjectClick = (projectId: string) => {
    setSelectedProject(projectId);
    // onProjectSelect could be called here with the project
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
          {projects.map((project) => (
            <Button
              key={project.id}
              variant={selectedProject === project.id ? "secondary" : "ghost"}
              className={cn(
                "w-full justify-start text-left h-auto p-3",
                selectedProject === project.id 
                  ? "bg-gray-800" 
                  : "hover:bg-gray-800"
              )}
              onClick={() => {
                console.log('📁 Project selected:', project.id, project.title);
                handleProjectClick(project.id);
              }}
            >
              <div className="flex items-start gap-2 w-full">
                <MessageSquare className="w-4 h-4 mt-0.5 flex-shrink-0 text-gray-400" />
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm text-white truncate">
                    {project.title}
                  </div>
                  <div className="text-xs text-gray-400 truncate">
                    {project.language} • {project.lastModified}
                  </div>
                </div>
              </div>
            </Button>
          ))}
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