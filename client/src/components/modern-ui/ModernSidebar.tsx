import { useState } from "react";
import { 
  Brain, 
  FolderOpen, 
  Plus, 
  ChevronRight, 
  ChevronDown,
  FileText,
  Settings,
  User,
  LogOut,
  Crown,
  Users,
  BarChart3,
  GraduationCap,
  Sparkles,
  Code2,
  Target
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
// Simplified imports for initial implementation
// Will restore full integration once core layout works
import type { Project, ProjectFolder } from "@shared/schema";

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
  const [expandedFolders, setExpandedFolders] = useState<Set<number>>(new Set());
  // Mock data for initial layout implementation
  const user = { username: 'Demo User' };
  const planTier = 'free';
  const projects = [];
  const folders = [];
  
  const logout = () => {
    window.location.href = '/api/logout';
  };

  const toggleFolder = (folderId: number) => {
    const newExpanded = new Set(expandedFolders);
    if (newExpanded.has(folderId)) {
      newExpanded.delete(folderId);
    } else {
      newExpanded.add(folderId);
    }
    setExpandedFolders(newExpanded);
  };

  const getProjectsInFolder = (folderId: number | null) => {
    return projects.filter(p => p.folderId === folderId);
  };

  const ungroupedProjects = getProjectsInFolder(null);

  return (
    <div className={cn(
      "flex flex-col h-full bg-gray-50 dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800",
      className
    )}>
      {/* Header */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-800">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-r from-purple-500 to-blue-500 flex items-center justify-center">
            <Brain className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="font-semibold text-gray-900 dark:text-white">CodeCrucible</h1>
            <p className="text-xs text-gray-500 dark:text-gray-400">AI Council Workspace</p>
          </div>
        </div>

        {/* New Chat Button */}
        <Button 
          onClick={onNewChat}
          className="w-full justify-start bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white"
        >
          <Plus className="w-4 h-4 mr-2" />
          New Voice Session
        </Button>
      </div>

      {/* Navigation & Projects */}
      <ScrollArea className="flex-1 px-2">
        <div className="space-y-2 py-4">
          {/* Quick Actions */}
          <div className="px-2">
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
              Workspace
            </p>
            <div className="space-y-1">
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
                onClick={() => onNavigate?.('voice-profiles')}
              >
                <User className="w-4 h-4 mr-3" />
                Voice Profiles
                {planTier === 'free' && <Crown className="w-3 h-3 ml-auto text-yellow-500" />}
              </Button>
              
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
                onClick={() => onNavigate?.('analytics')}
              >
                <BarChart3 className="w-4 h-4 mr-3" />
                Analytics
                {planTier === 'free' && <Crown className="w-3 h-3 ml-auto text-yellow-500" />}
              </Button>
              
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
                onClick={() => onNavigate?.('teams')}
              >
                <Users className="w-4 h-4 mr-3" />
                Teams
                {planTier === 'free' && <Crown className="w-3 h-3 ml-auto text-yellow-500" />}
              </Button>
              
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
                onClick={() => onNavigate?.('learning')}
              >
                <GraduationCap className="w-4 h-4 mr-3" />
                Learning
                <Badge variant="outline" className="ml-auto text-xs text-orange-500 border-orange-500">
                  Coming Soon
                </Badge>
              </Button>
            </div>
          </div>

          <Separator className="my-4" />

          {/* Projects Section */}
          <div className="px-2">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Projects
              </p>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <Plus className="w-3 h-3" />
              </Button>
            </div>

            <div className="space-y-1">
              {/* Project Folders */}
              {folders.map((folder) => (
                <div key={folder.id}>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 px-2"
                    onClick={() => toggleFolder(folder.id)}
                  >
                    {expandedFolders.has(folder.id) ? (
                      <ChevronDown className="w-3 h-3 mr-2" />
                    ) : (
                      <ChevronRight className="w-3 h-3 mr-2" />
                    )}
                    <FolderOpen className="w-4 h-4 mr-2" />
                    <span className="truncate flex-1 text-left">{folder.name}</span>
                    <Badge variant="secondary" className="ml-2 text-xs">
                      {getProjectsInFolder(folder.id).length}
                    </Badge>
                  </Button>
                  
                  {/* Projects in folder */}
                  {expandedFolders.has(folder.id) && (
                    <div className="ml-6 space-y-1 mt-1">
                      {getProjectsInFolder(folder.id).map((project) => (
                        <Button
                          key={project.id}
                          variant="ghost"
                          size="sm"
                          className="w-full justify-start text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 px-2"
                          onClick={() => onProjectSelect?.(project)}
                        >
                          <FileText className="w-3 h-3 mr-2" />
                          <span className="truncate text-left">{project.name}</span>
                        </Button>
                      ))}
                    </div>
                  )}
                </div>
              ))}

              {/* Ungrouped Projects */}
              {ungroupedProjects.map((project) => (
                <Button
                  key={project.id}
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 px-2"
                  onClick={() => onProjectSelect?.(project)}
                >
                  <FileText className="w-4 h-4 mr-2" />
                  <span className="truncate flex-1 text-left">{project.name}</span>
                </Button>
              ))}

              {/* Empty state */}
              {projects.length === 0 && (
                <div className="text-center py-8">
                  <Code2 className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                  <p className="text-sm text-gray-500 dark:text-gray-400">No projects yet</p>
                  <p className="text-xs text-gray-400 dark:text-gray-500">Generate your first AI solution</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </ScrollArea>

      {/* User Section */}
      <div className="p-4 border-t border-gray-200 dark:border-gray-800">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-8 h-8 rounded-full bg-gradient-to-r from-green-400 to-blue-500 flex items-center justify-center">
            <span className="text-sm font-medium text-white">
              {user?.username?.charAt(0).toUpperCase() || 'U'}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
              {user?.username || 'User'}
            </p>
            <div className="flex items-center gap-1">
              <Badge variant={planTier === 'free' ? 'secondary' : 'default'} className="text-xs">
                {planTier === 'free' ? 'FREE' : planTier?.toUpperCase()}
              </Badge>
              {planTier === 'free' && (
                <Button variant="ghost" size="sm" className="h-5 px-1 text-xs text-yellow-600 hover:text-yellow-700">
                  <Crown className="w-3 h-3 mr-1" />
                  Upgrade
                </Button>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-1">
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
            onClick={() => onNavigate?.('settings')}
          >
            <Settings className="w-4 h-4 mr-3" />
            Settings
          </Button>
          
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
            onClick={logout}
          >
            <LogOut className="w-4 h-4 mr-3" />
            Sign Out
          </Button>
        </div>
      </div>
    </div>
  );
}