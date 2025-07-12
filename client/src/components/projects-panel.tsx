import { useState } from "react";
import { Code, Calendar, Tag, ExternalLink, Trash2, Eye, Copy } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Project } from "@shared/schema";

interface ProjectsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onUseAsContext?: (project: Project) => void;
}

export function ProjectsPanel({ isOpen, onClose, onUseAsContext }: ProjectsPanelProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);

  // Fetch projects
  const { data: projects = [], isLoading } = useQuery({
    queryKey: ["/api/projects"],
    enabled: isOpen,
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/projects");
      return response.json();
    }
  });

  // Delete project mutation
  const deleteProject = useMutation({
    mutationFn: async (projectId: number) => {
      await apiRequest("DELETE", `/api/projects/${projectId}`);
    },
    onSuccess: () => {
      toast({
        title: "Project Deleted",
        description: "Project has been deleted successfully."
      });
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      setSelectedProject(null);
    },
    onError: () => {
      toast({
        title: "Delete Failed",
        description: "Failed to delete project. Please try again.",
        variant: "destructive"
      });
    }
  });

  // Copy project code to clipboard following AI_INSTRUCTIONS.md security patterns
  const copyProjectCode = async (project: Project) => {
    try {
      // Input validation following security standards
      if (!project || !project.code || typeof project.code !== 'string') {
        throw new Error('Invalid project code');
      }
      
      // Sanitize project name for display
      const sanitizedName = project.name?.slice(0, 50) || 'Untitled Project';
      
      await navigator.clipboard.writeText(project.code);
      toast({
        title: "Code Copied",
        description: `Code for "${sanitizedName}" copied to clipboard.`
      });
    } catch (error) {
      console.error('Copy operation failed:', error);
      toast({
        title: "Copy Failed",
        description: "Failed to copy code to clipboard.",
        variant: "destructive"
      });
    }
  };

  // Use project as context for AI generation following AI_INSTRUCTIONS.md patterns
  const useProjectAsContext = (project: Project) => {
    try {
      // Input validation following security standards
      if (!project || !project.code || typeof project.code !== 'string') {
        throw new Error('Invalid project data');
      }
      
      // Sanitize project name for display
      const sanitizedName = project.name?.slice(0, 50) || 'Untitled Project';
      
      if (onUseAsContext) {
        onUseAsContext(project);
        onClose(); // Close the panel after using as context
        toast({
          title: "Context Applied",
          description: `"${sanitizedName}" will be used as context for AI generation.`
        });
      }
    } catch (error) {
      console.error('Use as context failed:', error);
      toast({
        title: "Context Failed",
        description: "Failed to use project as context.",
        variant: "destructive"
      });
    }
  };

  // Format date for display
  const formatDate = (date: Date | string) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden flex flex-col bg-gray-900 border-gray-700 text-gray-100">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="text-gray-100">
            <div className="flex items-center space-x-3">
              <Code className="w-6 h-6 text-purple-400" />
              <div>
                <h3 className="text-xl font-semibold text-gray-100">Project Library</h3>
                <p className="text-sm text-gray-400">Manage your saved synthesized solutions</p>
              </div>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-1 min-h-0 max-h-[calc(90vh-120px)]">
          {/* Projects List */}
          <div className="w-1/2 pr-4 border-r border-gray-700 flex flex-col min-h-0">
            <div className="mb-4 flex-shrink-0">
              <h4 className="text-lg font-semibold mb-2 text-gray-100">Saved Projects ({projects.length})</h4>
              {isLoading && (
                <div className="text-center py-8 text-gray-400">Loading projects...</div>
              )}
            </div>
            
            <ScrollArea className="flex-1 min-h-0">
              <div className="space-y-3 pr-2">
                {projects.map((project: Project) => (
                  <Card 
                    key={project.id}
                    className={`cursor-pointer transition-all hover:shadow-md bg-gray-800 border-gray-700 hover:bg-gray-750 ${
                      selectedProject?.id === project.id 
                        ? 'ring-2 ring-purple-500 bg-purple-900/20' 
                        : ''
                    }`}
                    onClick={() => setSelectedProject(project)}
                  >
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <CardTitle className="text-sm font-medium truncate text-gray-100">
                            {project.name}
                          </CardTitle>
                          <p className="text-xs text-gray-400 mt-1 line-clamp-2">
                            {project.description || 'No description'}
                          </p>
                        </div>
                        <Badge variant="outline" className="ml-2 text-xs">
                          {project.language}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="flex items-center justify-between text-xs text-gray-400">
                        <div className="flex items-center space-x-2">
                          <Calendar className="w-3 h-3" />
                          <span>{formatDate(project.createdAt!)}</span>
                        </div>
                        <div className="flex items-center space-x-1">
                          {(project.tags as string[])?.slice(0, 2).map((tag) => (
                            <Badge key={tag} variant="secondary" className="text-xs">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
                
                {!isLoading && projects.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    <Code className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                    <p>No projects saved yet.</p>
                    <p className="text-sm">Generate and save some solutions to see them here.</p>
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>

          {/* Project Details */}
          <div className="w-1/2 pl-4 flex flex-col min-h-0">
            {selectedProject ? (
              <div className="h-full flex flex-col min-h-0">
                <div className="flex items-start justify-between mb-4 flex-shrink-0">
                  <div className="flex-1 min-w-0">
                    <h4 className="text-lg font-semibold truncate">{selectedProject.name}</h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      {selectedProject.description}
                    </p>
                    <div className="flex items-center space-x-4 mt-2 text-xs text-gray-500">
                      <span>Created: {formatDate(selectedProject.createdAt!)}</span>
                      <span>Language: {selectedProject.language}</span>
                      {selectedProject.sessionId && (
                        <span>Session: #{selectedProject.sessionId}</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Tags */}
                {selectedProject.tags && (selectedProject.tags as string[]).length > 0 && (
                  <div className="mb-4 flex-shrink-0">
                    <div className="flex items-center space-x-2 flex-wrap">
                      <Tag className="w-4 h-4 text-gray-500" />
                      {(selectedProject.tags as string[]).map((tag) => (
                        <Badge key={tag} variant="secondary" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Code Preview */}
                <div className="flex-1 mb-4 min-h-0 flex flex-col">
                  <div className="flex items-center justify-between mb-2 flex-shrink-0">
                    <h5 className="text-sm font-medium text-gray-200">Code Preview</h5>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyProjectCode(selectedProject)}
                      className="h-8 px-2 text-xs text-gray-400 hover:text-gray-200"
                    >
                      <Copy className="w-3 h-3 mr-1" />
                      Copy
                    </Button>
                  </div>
                  <div className="flex-1 min-h-0">
                    <ScrollArea className="bg-gray-800 border border-gray-700 rounded-lg p-4 text-sm font-mono text-gray-100 h-full">
                      <div className="pr-2">
                        <pre className="whitespace-pre-wrap break-words">{selectedProject.code}</pre>
                      </div>
                    </ScrollArea>
                  </div>
                </div>

                {/* Actions - Fixed positioning to prevent cutoff */}
                <div className="flex flex-col space-y-3 pt-4 border-t border-gray-700 flex-shrink-0 bg-gray-900">
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copyProjectCode(selectedProject)}
                      className="flex items-center space-x-1.5 text-gray-300 hover:text-gray-100 border-gray-600 hover:border-gray-500"
                    >
                      <Copy className="w-4 h-4" />
                      <span>Copy Code</span>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => useProjectAsContext(selectedProject)}
                      className="flex items-center space-x-1.5 text-green-300 hover:text-green-100 border-green-600 hover:border-green-500"
                    >
                      <ExternalLink className="w-4 h-4" />
                      <span>Use as Context</span>
                    </Button>
                  </div>
                  <div className="flex justify-end">
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => deleteProject.mutate(selectedProject.id)}
                      disabled={deleteProject.isPending}
                      className="flex items-center space-x-1.5 bg-red-600 hover:bg-red-700 text-white"
                    >
                      <Trash2 className="w-4 h-4" />
                      <span>{deleteProject.isPending ? "Deleting..." : "Delete"}</span>
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="h-full flex items-center justify-center text-gray-500">
                <div className="text-center">
                  <Eye className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                  <p>Select a project to view details</p>
                  <p className="text-sm">Click on any project from the list to see its code and details.</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}