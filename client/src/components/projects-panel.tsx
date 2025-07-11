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
}

export function ProjectsPanel({ isOpen, onClose }: ProjectsPanelProps) {
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

  // Copy project code to clipboard
  const copyProjectCode = async (project: Project) => {
    try {
      await navigator.clipboard.writeText(project.code);
      toast({
        title: "Code Copied",
        description: `Code for "${project.name}" copied to clipboard.`
      });
    } catch (error) {
      toast({
        title: "Copy Failed",
        description: "Failed to copy code to clipboard.",
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
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle>
            <div className="flex items-center space-x-3">
              <Code className="w-6 h-6 text-purple-600" />
              <div>
                <h3 className="text-xl font-semibold">Project Library</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">Manage your saved synthesized solutions</p>
              </div>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="flex h-[calc(90vh-120px)]">
          {/* Projects List */}
          <div className="w-1/2 pr-4 border-r border-gray-200 dark:border-gray-700">
            <div className="mb-4">
              <h4 className="text-lg font-semibold mb-2">Saved Projects ({projects.length})</h4>
              {isLoading && (
                <div className="text-center py-8 text-gray-500">Loading projects...</div>
              )}
            </div>
            
            <ScrollArea className="h-full">
              <div className="space-y-3">
                {projects.map((project: Project) => (
                  <Card 
                    key={project.id}
                    className={`cursor-pointer transition-all hover:shadow-md ${
                      selectedProject?.id === project.id 
                        ? 'ring-2 ring-purple-500 bg-purple-50 dark:bg-purple-900/20' 
                        : ''
                    }`}
                    onClick={() => setSelectedProject(project)}
                  >
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <CardTitle className="text-sm font-medium truncate">
                            {project.name}
                          </CardTitle>
                          <p className="text-xs text-gray-500 mt-1 line-clamp-2">
                            {project.description || 'No description'}
                          </p>
                        </div>
                        <Badge variant="outline" className="ml-2 text-xs">
                          {project.language}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="flex items-center justify-between text-xs text-gray-500">
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
          <div className="w-1/2 pl-4">
            {selectedProject ? (
              <div className="h-full flex flex-col">
                <div className="flex items-start justify-between mb-4">
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
                  <div className="mb-4">
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
                <div className="flex-1 mb-4">
                  <h5 className="text-sm font-medium mb-2">Code Preview</h5>
                  <div className="bg-gray-900 rounded-lg p-4 text-sm font-mono text-gray-100 overflow-auto h-full">
                    <pre className="whitespace-pre-wrap">{selectedProject.code}</pre>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copyProjectCode(selectedProject)}
                    className="flex items-center space-x-2"
                  >
                    <Copy className="w-4 h-4" />
                    <span>Copy Code</span>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex items-center space-x-2"
                  >
                    <ExternalLink className="w-4 h-4" />
                    <span>Open in Editor</span>
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => deleteProject.mutate(selectedProject.id)}
                    disabled={deleteProject.isPending}
                    className="flex items-center space-x-2"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>{deleteProject.isPending ? "Deleting..." : "Delete"}</span>
                  </Button>
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