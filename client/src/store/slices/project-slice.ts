// Project management and file organization slice
// Following AI_INSTRUCTIONS.md patterns with normalized data structure

import { produce } from 'immer';
import { StateCreator } from 'zustand';
import { storeLogger } from '../utils/logger';
import type { ProjectState, AppState, Project, ProjectFolder } from '../types';

// Initial state with normalized data structure
const initialProjectState: Omit<ProjectState, 'actions'> = {
  projects: {},
  folders: {},
  files: {},
  selectedProject: null,
  selectedFolder: null,
  expandedFolders: new Set(),
  isCreating: false,
  isDeleting: false,
  isMoving: false
};

// Project slice creator with normalized state management
export const createProjectSlice: StateCreator<
  AppState,
  [],
  [],
  ProjectState
> = (set, get) => ({
  ...initialProjectState,
  
  actions: {
    // Set projects from API with normalization
    setProjects: (projects: Project[]) => {
      set(produce((state: AppState) => {
        // Normalize projects into lookup table
        state.project.projects = {};
        projects.forEach(project => {
          state.project.projects[project.id] = {
            ...project,
            createdAt: new Date(project.createdAt),
            updatedAt: new Date(project.updatedAt)
          };
        });
        
        storeLogger.info('Projects normalized and stored', {
          count: projects.length,
          projectIds: projects.map(p => p.id)
        });
      }));
    },

    // Add new project
    addProject: (project: Project) => {
      set(produce((state: AppState) => {
        if (state.project.projects[project.id]) {
          storeLogger.warn('Project already exists', { projectId: project.id });
          return;
        }
        
        state.project.projects[project.id] = {
          ...project,
          createdAt: new Date(project.createdAt),
          updatedAt: new Date(project.updatedAt),
          userId: state.auth.user?.id || project.userId
        };
        
        storeLogger.info('Project added', {
          projectId: project.id,
          name: project.name,
          language: project.language,
          folderId: project.folderId
        });
      }));
    },

    // Update existing project
    updateProject: (id: string, updates: Partial<Project>) => {
      set(produce((state: AppState) => {
        if (!state.project.projects[id]) {
          storeLogger.error('Project not found for update', { projectId: id });
          return;
        }
        
        state.project.projects[id] = {
          ...state.project.projects[id],
          ...updates,
          updatedAt: new Date()
        };
        
        storeLogger.info('Project updated', {
          projectId: id,
          updates: Object.keys(updates)
        });
      }));
    },

    // Delete project
    deleteProject: (id: string) => {
      set(produce((state: AppState) => {
        if (!state.project.projects[id]) {
          storeLogger.warn('Project not found for deletion', { projectId: id });
          return;
        }
        
        const deletedProject = state.project.projects[id];
        delete state.project.projects[id];
        
        // Clear selection if deleted project was selected
        if (state.project.selectedProject === id) {
          state.project.selectedProject = null;
        }
        
        // Remove associated files
        Object.keys(state.project.files).forEach(fileId => {
          if (state.project.files[fileId].projectId === id) {
            delete state.project.files[fileId];
          }
        });
        
        storeLogger.info('Project deleted', {
          projectId: id,
          name: deletedProject.name
        });
      }));
    },

    // Select project for detailed view
    selectProject: (id: string | null) => {
      set(produce((state: AppState) => {
        if (id && !state.project.projects[id]) {
          storeLogger.warn('Cannot select non-existent project', { projectId: id });
          return;
        }
        
        state.project.selectedProject = id;
        
        storeLogger.info('Project selected', { projectId: id });
      }));
    },

    // Set folders from API with normalization
    setFolders: (folders: ProjectFolder[]) => {
      set(produce((state: AppState) => {
        // Normalize folders into lookup table
        state.project.folders = {};
        folders.forEach(folder => {
          state.project.folders[folder.id] = {
            ...folder,
            createdAt: new Date(folder.createdAt)
          };
        });
        
        storeLogger.info('Folders normalized and stored', {
          count: folders.length,
          folderIds: folders.map(f => f.id)
        });
      }));
    },

    // Create new folder
    createFolder: (folder: ProjectFolder) => {
      set(produce((state: AppState) => {
        if (state.project.folders[folder.id]) {
          storeLogger.warn('Folder already exists', { folderId: folder.id });
          return;
        }
        
        state.project.folders[folder.id] = {
          ...folder,
          createdAt: new Date(folder.createdAt),
          userId: state.auth.user?.id || folder.userId
        };
        
        storeLogger.info('Folder created', {
          folderId: folder.id,
          name: folder.name,
          color: folder.color
        });
      }));
    },

    // Move project to folder
    moveProject: (projectId: string, folderId: string | null) => {
      set(produce((state: AppState) => {
        if (!state.project.projects[projectId]) {
          storeLogger.error('Project not found for move', { projectId });
          return;
        }
        
        if (folderId && !state.project.folders[folderId]) {
          storeLogger.error('Target folder not found', { folderId });
          return;
        }
        
        const previousFolderId = state.project.projects[projectId].folderId;
        state.project.projects[projectId].folderId = folderId;
        state.project.projects[projectId].updatedAt = new Date();
        
        storeLogger.info('Project moved', {
          projectId,
          fromFolder: previousFolderId,
          toFolder: folderId
        });
      }));
    },

    // Toggle folder expansion
    toggleFolder: (folderId: string) => {
      set(produce((state: AppState) => {
        if (state.project.expandedFolders.has(folderId)) {
          state.project.expandedFolders.delete(folderId);
        } else {
          state.project.expandedFolders.add(folderId);
        }
        
        storeLogger.info('Folder toggled', {
          folderId,
          expanded: state.project.expandedFolders.has(folderId)
        });
      }));
    }
  }
});

// Project management utilities
export const getProjectsByFolder = (folderId: string | null): Project[] => {
  const state = get();
  return Object.values(state.project.projects).filter(
    project => project.folderId === folderId
  );
};

export const getFolderProjectCount = (folderId: string): number => {
  const state = get();
  return Object.values(state.project.projects).filter(
    project => project.folderId === folderId
  ).length;
};

export const getProjectLanguageStats = (): Record<string, number> => {
  const state = get();
  const stats: Record<string, number> = {};
  
  Object.values(state.project.projects).forEach(project => {
    stats[project.language] = (stats[project.language] || 0) + 1;
  });
  
  return stats;
};

export const getProjectComplexityAverage = (): number => {
  const state = get();
  const projects = Object.values(state.project.projects);
  
  if (projects.length === 0) return 0;
  
  const totalComplexity = projects.reduce((sum, project) => sum + project.complexity, 0);
  return totalComplexity / projects.length;
};

export const searchProjects = (query: string): Project[] => {
  const state = get();
  const searchTerm = query.toLowerCase();
  
  return Object.values(state.project.projects).filter(project =>
    project.name.toLowerCase().includes(searchTerm) ||
    project.language.toLowerCase().includes(searchTerm) ||
    project.tags.some(tag => tag.toLowerCase().includes(searchTerm)) ||
    project.code.toLowerCase().includes(searchTerm)
  );
};

// Project validation utilities
export const validateProjectData = (project: Partial<Project>): string[] => {
  const errors: string[] = [];
  
  if (!project.name || project.name.trim().length === 0) {
    errors.push('Project name is required');
  }
  
  if (!project.language || project.language.trim().length === 0) {
    errors.push('Programming language is required');
  }
  
  if (!project.code || project.code.trim().length === 0) {
    errors.push('Project code is required');
  }
  
  if (project.complexity !== undefined && (project.complexity < 1 || project.complexity > 10)) {
    errors.push('Complexity must be between 1 and 10');
  }
  
  return errors;
};