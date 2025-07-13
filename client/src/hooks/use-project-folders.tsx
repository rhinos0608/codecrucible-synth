import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { ProjectFolder, InsertProjectFolder, insertProjectFolderSchema } from '../../../shared/schema';

// Get all project folders for authenticated user
export function useProjectFolders() {
  return useQuery<ProjectFolder[]>({
    queryKey: ['/api/project-folders'],
    queryFn: () => apiRequest('/api/project-folders'),
  });
}

// Get projects in a specific folder
export function useProjectsInFolder(folderId: number) {
  return useQuery({
    queryKey: ['/api/project-folders', folderId, 'projects'],
    queryFn: () => apiRequest(`/api/project-folders/${folderId}/projects`),
  });
}

// Create new project folder
export function useCreateProjectFolder() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data: Omit<InsertProjectFolder, 'userId'>) => {
      const folderData = insertProjectFolderSchema.omit({ userId: true }).parse(data);
      return apiRequest('/api/project-folders', {
        method: 'POST',
        body: folderData,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/project-folders'] });
    },
  });
}

// Update project folder
export function useUpdateProjectFolder() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, ...data }: { id: number } & Partial<InsertProjectFolder>) => {
      return apiRequest(`/api/project-folders/${id}`, {
        method: 'PATCH',
        body: data,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/project-folders'] });
    },
  });
}

// Delete project folder
export function useDeleteProjectFolder() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (folderId: number) => {
      return apiRequest(`/api/project-folders/${folderId}`, {
        method: 'DELETE',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/project-folders'] });
      queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
    },
  });
}