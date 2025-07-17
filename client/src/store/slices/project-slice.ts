// Project management slice
// Following AI_INSTRUCTIONS.md patterns with immutable state management

import { produce } from 'immer';
import { StateCreator } from 'zustand';
import { storeLogger } from '../utils/logger';
import type { ProjectState, AppState, Project, ProjectFolder } from '../types';

// Initial state
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

// Project slice creator
export const createProjectSlice: StateCreator<
  AppState,
  [],
  [],
  ProjectState
> = (set, get) => ({
  ...initialProjectState,
  
  actions: {
    setProjects: (projects: Project[]) => {
      set(produce((state: AppState) => {
        // Convert array to normalized object
        state.project.projects = projects.reduce((acc, project) => {
          acc[project.id] = project;
          return acc;
        }, {} as Record<string, Project>);
        
        storeLogger.info('Projects loaded', { count: projects.length });
      }));
    },
    
    addProject: (project: Project) => {
      set(produce((state: AppState) => {
        state.project.projects[project.id] = project;
        storeLogger.info('Project added', { projectId: project.id });
      }));
    },
    
    updateProject: (id: string, updates: Partial<Project>) => {
      set(produce((state: AppState) => {
        if (state.project.projects[id]) {
          Object.assign(state.project.projects[id], updates);
          storeLogger.info('Project updated', { projectId: id });
        }
      }));
    },
    
    deleteProject: (id: string) => {
      set(produce((state: AppState) => {
        delete state.project.projects[id];
        if (state.project.selectedProject === id) {
          state.project.selectedProject = null;
        }
        storeLogger.info('Project deleted', { projectId: id });
      }));
    },
    
    selectProject: (id: string | null) => {
      set(produce((state: AppState) => {
        state.project.selectedProject = id;
        storeLogger.info('Project selected', { projectId: id });
      }));
    },
    
    setFolders: (folders: ProjectFolder[]) => {
      set(produce((state: AppState) => {
        state.project.folders = folders.reduce((acc, folder) => {
          acc[folder.id] = folder;
          return acc;
        }, {} as Record<string, ProjectFolder>);
        
        storeLogger.info('Folders loaded', { count: folders.length });
      }));
    },
    
    createFolder: (folder: ProjectFolder) => {
      set(produce((state: AppState) => {
        state.project.folders[folder.id] = folder;
        storeLogger.info('Folder created', { folderId: folder.id });
      }));
    },
    
    moveProject: (projectId: string, folderId: string | null) => {
      set(produce((state: AppState) => {
        if (state.project.projects[projectId]) {
          state.project.projects[projectId].folderId = folderId;
          storeLogger.info('Project moved', { projectId, folderId });
        }
      }));
    },
    
    toggleFolder: (folderId: string) => {
      set(produce((state: AppState) => {
        if (state.project.expandedFolders.has(folderId)) {
          state.project.expandedFolders.delete(folderId);
        } else {
          state.project.expandedFolders.add(folderId);
        }
        storeLogger.info('Folder toggled', { folderId });
      }));
    }
  }
});