import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import type { UserFile } from '@shared/schema';

// File upload hook - Following Jung's Descent Protocol for consciousness-driven file management
export function useFileUpload() {
  const [isUploading, setIsUploading] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Upload file mutation
  const uploadMutation = useMutation({
    mutationFn: async (fileData: {
      fileName: string;
      content: string;
      mimeType: string;
      projectId?: number;
      sessionId?: number;
    }) => {
      return apiRequest('/api/files/upload', {
        method: 'POST',
        body: fileData
      });
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/files'] });
      toast({
        title: "File uploaded successfully",
        description: `${data.fileName} has been uploaded to your workspace.`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Upload failed",
        description: error.message || "Failed to upload file. Please try again.",
        variant: "destructive",
      });
    }
  });

  // Process file for upload - Following AI_INSTRUCTIONS.md security patterns
  const processAndUploadFile = async (
    file: File, 
    options?: { projectId?: number; sessionId?: number }
  ) => {
    setIsUploading(true);

    try {
      // File size validation (10MB limit)
      if (file.size > 10485760) {
        throw new Error('File size must be less than 10MB');
      }

      // Validate file type (only text-based files allowed for security)
      const allowedTypes = [
        'text/plain',
        'text/javascript',
        'text/typescript',
        'application/json',
        'text/html',
        'text/css',
        'text/markdown',
        'application/javascript',
        'application/typescript'
      ];

      const allowedExtensions = [
        'txt', 'js', 'jsx', 'ts', 'tsx', 'json', 'html', 'css', 'scss',
        'md', 'py', 'java', 'cpp', 'c', 'cs', 'php', 'rb', 'go', 'rs',
        'kt', 'swift', 'xml', 'yaml', 'yml', 'log', 'sql', 'sh', 'bat'
      ];

      const ext = file.name.split('.').pop()?.toLowerCase();
      const isValidType = allowedTypes.includes(file.type) || 
                         allowedExtensions.includes(ext || '');

      if (!isValidType) {
        throw new Error('Only text-based files are supported for security reasons');
      }

      // Read file content
      const content = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target?.result as string);
        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsText(file);
      });

      // Prepare upload data
      const uploadData = {
        fileName: file.name,
        content,
        mimeType: file.type || 'text/plain',
        projectId: options?.projectId,
        sessionId: options?.sessionId
      };

      // Upload file
      const result = await uploadMutation.mutateAsync(uploadData);
      return result;

    } catch (error: any) {
      toast({
        title: "Upload failed",
        description: error.message || "Failed to process file. Please try again.",
        variant: "destructive",
      });
      throw error;
    } finally {
      setIsUploading(false);
    }
  };

  return {
    processAndUploadFile,
    isUploading: isUploading || uploadMutation.isPending,
    uploadError: uploadMutation.error,
    uploadMutation
  };
}

// Get user files hook
export function useUserFiles() {
  return useQuery<UserFile[]>({
    queryKey: ['/api/files'],
    queryFn: () => apiRequest('/api/files'),
  });
}

// Delete file hook
export function useDeleteFile() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (fileId: number) => {
      return apiRequest(`/api/files/${fileId}`, {
        method: 'DELETE'
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/files'] });
      toast({
        title: "File deleted",
        description: "File has been removed from your workspace.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Delete failed",
        description: error.message || "Failed to delete file. Please try again.",
        variant: "destructive",
      });
    }
  });
}

// Session file attachment hooks
export function useSessionFiles(sessionId: number) {
  return useQuery<UserFile[]>({
    queryKey: ['/api/sessions', sessionId, 'files'],
    queryFn: () => apiRequest(`/api/sessions/${sessionId}/files`),
    enabled: !!sessionId
  });
}

export function useAttachFileToSession() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ sessionId, fileId, isContextEnabled = true }: {
      sessionId: number;
      fileId: number;
      isContextEnabled?: boolean;
    }) => {
      return apiRequest(`/api/sessions/${sessionId}/files`, {
        method: 'POST',
        body: { fileId, isContextEnabled }
      });
    },
    onSuccess: (_, { sessionId }) => {
      queryClient.invalidateQueries({ queryKey: ['/api/sessions', sessionId, 'files'] });
      toast({
        title: "File attached",
        description: "File has been attached to this session for AI context.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Attachment failed",
        description: error.message || "Failed to attach file. Please try again.",
        variant: "destructive",
      });
    }
  });
}

export function useDetachFileFromSession() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ sessionId, fileId }: {
      sessionId: number;
      fileId: number;
    }) => {
      return apiRequest(`/api/sessions/${sessionId}/files/${fileId}`, {
        method: 'DELETE'
      });
    },
    onSuccess: (_, { sessionId }) => {
      queryClient.invalidateQueries({ queryKey: ['/api/sessions', sessionId, 'files'] });
      toast({
        title: "File detached",
        description: "File has been removed from this session.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Detach failed",
        description: error.message || "Failed to detach file. Please try again.",
        variant: "destructive",
      });
    }
  });
}