import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Project, InsertProject } from "../../../shared/schema";

export function useProjects() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch all projects
  const {
    data: projects = [],
    isLoading,
    error
  } = useQuery({
    queryKey: ["/api/projects"],
    queryFn: async (): Promise<Project[]> => {
      const response = await apiRequest("GET", "/api/projects");
      return response.json();
    }
  });

  // Create new project
  const createProject = useMutation({
    mutationFn: async (projectData: Omit<InsertProject, 'id'>) => {
      const response = await apiRequest("POST", "/api/projects", projectData);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      toast({
        title: "Project Created",
        description: "Your project has been saved successfully."
      });
    },
    onError: (error) => {
      console.error("Failed to create project:", error);
      toast({
        title: "Save Failed",
        description: "Failed to save project. Please try again.",
        variant: "destructive"
      });
    }
  });

  // Update project
  const updateProject = useMutation({
    mutationFn: async ({ id, updates }: { id: number; updates: Partial<InsertProject> }) => {
      return apiRequest(`/api/projects/${id}`, {
        method: "PUT",
        body: updates
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      toast({
        title: "Project Updated",
        description: "Your project has been updated successfully."
      });
    },
    onError: (error) => {
      console.error("Failed to update project:", error);
      toast({
        title: "Update Failed",
        description: "Failed to update project. Please try again.",
        variant: "destructive"
      });
    }
  });

  // Delete project
  const deleteProject = useMutation({
    mutationFn: async (projectId: number) => {
      return apiRequest(`/api/projects/${projectId}`, {
        method: "DELETE"
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      toast({
        title: "Project Deleted",
        description: "Project has been deleted successfully."
      });
    },
    onError: (error) => {
      console.error("Failed to delete project:", error);
      toast({
        title: "Delete Failed",
        description: "Failed to delete project. Please try again.",
        variant: "destructive"
      });
    }
  });

  // Get project by ID
  const getProject = (id: number) => {
    return useQuery({
      queryKey: ["/api/projects", id],
      queryFn: async (): Promise<Project> => {
        return apiRequest(`/api/projects/${id}`);
      },
      enabled: !!id
    });
  };

  return {
    projects,
    isLoading,
    error,
    createProject,
    updateProject,
    deleteProject,
    getProject
  };
}

// Individual exports for component compatibility
export function useCreateProject() {
  const { createProject } = useProjects();
  return createProject;
}

export function useDeleteProject() {
  const { deleteProject } = useProjects();
  return deleteProject;
}

export function useMoveProject() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  return useMutation({
    mutationFn: async ({ projectId, folderId }: { projectId: number; folderId: number | null }) => {
      return apiRequest(`/api/projects/${projectId}/move`, {
        method: 'PUT',
        body: { folderId }
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      queryClient.invalidateQueries({ queryKey: ["/api/project-folders"] });
      toast({
        title: "Project Moved",
        description: "Project has been moved successfully."
      });
    },
    onError: (error) => {
      console.error("Failed to move project:", error);
      toast({
        title: "Move Failed",
        description: "Failed to move project. Please try again.",
        variant: "destructive"
      });
    }
  });
}

// Analytics hook for project insights
export function useProjectAnalytics() {
  return useQuery({
    queryKey: ["/api/projects/analytics"],
    queryFn: async () => {
      const projects: Project[] = await apiRequest("/api/projects");
      
      // Calculate analytics from project data
      const totalProjects = projects.length;
      const languageStats = projects.reduce((acc, project) => {
        acc[project.language] = (acc[project.language] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      
      const recentProjects = projects
        .filter(p => {
          const daysDiff = (Date.now() - new Date(p.createdAt!).getTime()) / (1000 * 60 * 60 * 24);
          return daysDiff <= 7;
        }).length;

      const tagStats = projects.reduce((acc, project) => {
        (project.tags as string[])?.forEach(tag => {
          acc[tag] = (acc[tag] || 0) + 1;
        });
        return acc;
      }, {} as Record<string, number>);

      return {
        totalProjects,
        languageStats,
        recentProjects,
        tagStats,
        mostUsedLanguage: Object.entries(languageStats).sort(([,a], [,b]) => b - a)[0]?.[0] || 'javascript',
        mostUsedTags: Object.entries(tagStats).sort(([,a], [,b]) => b - a).slice(0, 5)
      };
    }
  });
}