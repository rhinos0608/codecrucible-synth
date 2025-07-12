import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import type { Project, ProjectFolder, InsertProject, InsertProjectFolder } from '@shared/schema';
import { Card, CardHeader, CardContent, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import {
  Plus,
  Folder,
  FolderPlus,
  File,
  Copy,
  Edit,
  Trash2,
  ChevronDown,
  ChevronRight,
  Target,
  BookOpen,
  Code,
  Layers,
  TreePine,
  Sparkles,
  ArrowLeft,
  FileText
} from 'lucide-react';
import { FolderFileManager } from './folder-file-manager';

// Enhanced Projects Panel following AI_INSTRUCTIONS.md and CodingPhilosophy.md patterns
// Implements consciousness-driven development with defensive programming and council-based error handling

interface EnhancedProjectsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onUseAsContext?: (projects: Project[]) => void;
  selectedContextProjects: Project[];
}

const COMPLEXITY_LABELS = {
  '1': 'Simple',
  '2': 'Moderate', 
  '3': 'Complex'
};

const FOLDER_COLORS = [
  '#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6',
  '#06b6d4', '#f97316', '#84cc16', '#ec4899', '#6366f1'
];

const FOLDER_ICONS = [
  'folder', 'code', 'layers', 'settings', 'database',
  'globe', 'shield', 'zap', 'target', 'book'
];

export function EnhancedProjectsPanel({ 
  isOpen, 
  onClose, 
  onUseAsContext, 
  selectedContextProjects 
}: EnhancedProjectsPanelProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // State management following AI_INSTRUCTIONS.md patterns
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProjects, setSelectedProjects] = useState<Set<number>>(new Set());
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>([]);
  const [complexityFilter, setComplexityFilter] = useState<number | null>(null);
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [showEditFolder, setShowEditFolder] = useState(false);
  const [showDeleteFolder, setShowDeleteFolder] = useState(false);
  const [expandedFolders, setExpandedFolders] = useState<Set<number>>(new Set());
  const [showFolderManager, setShowFolderManager] = useState(false);
  const [selectedFolder, setSelectedFolder] = useState<ProjectFolder | null>(null);
  const [editingFolder, setEditingFolder] = useState<ProjectFolder | null>(null);
  const [deletingFolder, setDeletingFolder] = useState<ProjectFolder | null>(null);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [showMoveProject, setShowMoveProject] = useState(false);
  const [movingProject, setMovingProject] = useState<Project | null>(null);
  const [showProjectDetail, setShowProjectDetail] = useState(false);
  const [selectedProjectDetail, setSelectedProjectDetail] = useState<Project | null>(null);
  
  // New folder data with defensive defaults
  const [newFolderData, setNewFolderData] = useState({
    name: '',
    description: '',
    color: '#3b82f6',
    icon: '📁',
    parentId: null as number | null,
    visibility: 'private' as const
  });

  // Data fetching with error handling following CodingPhilosophy.md patterns
  const { data: projects = [], isLoading: projectsLoading } = useQuery<Project[]>({
    queryKey: ['/api/projects'],
    retry: 3, // Implement resilience patterns
  });

  const { data: folders = [], isLoading: foldersLoading } = useQuery<ProjectFolder[]>({
    queryKey: ['/api/project-folders'],
    retry: 3,
  });

  // Council-based error handling for mutations following CodingPhilosophy.md
  const createFolderMutation = useMutation({
    mutationFn: async (data: InsertProjectFolder) => {
      return apiRequest('/api/project-folders', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/project-folders'] });
      setShowCreateFolder(false);
      setNewFolderData({
        name: '',
        description: '',
        color: '#3b82f6',
        icon: '📁',
        parentId: null,
        visibility: 'private'
      });
      toast({
        title: "Success",
        description: "Folder created successfully",
      });
    },
    onError: (error) => {
      console.error('Folder creation failed - engaging error council:', error);
      toast({
        title: "Creation Failed",
        description: "Failed to create folder. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Update folder mutation following Jung's Descent Protocol
  const updateFolderMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<InsertProjectFolder> }) => {
      return apiRequest(`/api/project-folders/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/project-folders'] });
      setShowEditFolder(false);
      setEditingFolder(null);
      toast({
        title: "Success",
        description: "Folder updated successfully",
      });
    },
    onError: (error) => {
      console.error('Folder update failed - invoking council:', error);
      toast({
        title: "Update Failed",
        description: "Failed to update folder. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Delete folder mutation with defensive patterns
  const deleteFolderMutation = useMutation({
    mutationFn: async (folderId: number) => {
      return apiRequest(`/api/project-folders/${folderId}`, {
        method: 'DELETE',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/project-folders'] });
      queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
      setShowDeleteFolder(false);
      setDeletingFolder(null);
      toast({
        title: "Success",
        description: "Folder deleted successfully",
      });
    },
    onError: (error) => {
      console.error('Folder deletion failed - council assembly required:', error);
      toast({
        title: "Deletion Failed",
        description: "Failed to delete folder. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Move project mutation following Alexander's Pattern Language
  const moveProjectMutation = useMutation({
    mutationFn: async ({ projectId, folderId }: { projectId: number; folderId: number | null }) => {
      console.log('Moving project via PUT request:', { projectId, folderId });
      
      // Enhanced PUT request following AI_INSTRUCTIONS.md patterns
      const response = await apiRequest('PUT', `/api/projects/${projectId}/move`, {
        folderId
      });
      
      console.log('Move project response:', response.status);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
      queryClient.invalidateQueries({ queryKey: ['/api/project-folders'] });
      setShowMoveProject(false);
      setMovingProject(null);
      toast({
        title: "Success",
        description: "Project moved successfully",
      });
    },
    onError: (error) => {
      console.error('Project move failed - engaging error council:', error);
      toast({
        title: "Move Failed",
        description: `Failed to move project: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: "destructive",
      });
    },
  });

  // Alexander's Pattern Language - consistent event handlers
  const handleCreateFolder = () => {
    if (!newFolderData.name.trim()) {
      toast({
        title: "Validation Error",
        description: "Folder name is required",
        variant: "destructive",
      });
      return;
    }

    createFolderMutation.mutate({
      name: newFolderData.name,
      description: newFolderData.description,
      color: newFolderData.color,
      icon: newFolderData.icon,
      parentId: newFolderData.parentId,
      visibility: newFolderData.visibility,
    });
  };

  // Defensive programming - handle context selection with null checks
  const handleContextSelection = (project: Project, checked: boolean) => {
    if (!project?.id) {
      console.warn('Invalid project for context selection:', project);
      return;
    }

    setSelectedProjects(prev => {
      const newSet = new Set(prev);
      if (checked) {
        newSet.add(project.id);
      } else {
        newSet.delete(project.id);
      }
      return newSet;
    });
  };

  // Jung's Descent Protocol - embrace complexity in filtering
  const getFilteredProjects = (): Project[] => {
    return projects.filter(project => {
      // Defensive null checks following AI_INSTRUCTIONS.md patterns
      if (!project) return false;
      
      const matchesSearch = !searchTerm || 
        project.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        project.description?.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesLanguage = selectedLanguages.length === 0 || 
        selectedLanguages.includes(project.language || '');
      
      const matchesComplexity = complexityFilter === null || 
        (project.complexity || 1) === complexityFilter;
      
      const matchesTags = selectedTags.length === 0 || 
        selectedTags.some(tag => project.tags?.includes(tag));

      return matchesSearch && matchesLanguage && matchesComplexity && matchesTags;
    });
  };

  // Bateson's Learning - folder tree building with recursive patterns
  const buildFolderTree = (allFolders: ProjectFolder[], parentId: number | null = null): ProjectFolder[] => {
    return allFolders.filter(folder => folder.parentId === parentId);
  };

  const getProjectsInFolder = (folderId: number): Project[] => {
    return projects.filter(project => project.folderId === folderId);
  };

  const toggleFolder = (folderId: number) => {
    setExpandedFolders(prev => {
      const newSet = new Set(prev);
      if (newSet.has(folderId)) {
        newSet.delete(folderId);
      } else {
        newSet.add(folderId);
      }
      return newSet;
    });
  };

  const handleOpenFolder = (folder: ProjectFolder) => {
    setSelectedFolder(folder);
    setShowFolderManager(true);
  };

  const handleBackToFolders = () => {
    setShowFolderManager(false);
    setSelectedFolder(null);
  };

  // Alexander's Pattern Language - folder management patterns
  const handleEditFolder = (folder: ProjectFolder) => {
    setEditingFolder(folder);
    setNewFolderData({
      name: folder.name,
      description: folder.description || '',
      color: folder.color || '#3b82f6',
      icon: folder.icon || '📁',
      parentId: folder.parentId,
      visibility: folder.visibility
    });
    setShowEditFolder(true);
  };

  const handleDeleteFolder = (folder: ProjectFolder) => {
    setDeletingFolder(folder);
    setShowDeleteFolder(true);
  };

  const confirmDeleteFolder = () => {
    if (deletingFolder) {
      deleteFolderMutation.mutate(deletingFolder.id);
    }
  };

  // Campbell's Journey - project transformation patterns
  const handleCopyProject = async (project: Project) => {
    try {
      await navigator.clipboard.writeText(project.code);
      toast({
        title: "Copied!",
        description: "Project code copied to clipboard",
      });
    } catch (error) {
      console.error('Copy failed - council intervention needed:', error);
      toast({
        title: "Copy Failed",
        description: "Failed to copy project code",
        variant: "destructive",
      });
    }
  };

  const handleEditProject = (project: Project) => {
    setEditingProject(project);
    // Trigger project edit modal/flow
    toast({
      title: "Edit Project",
      description: "Project editing functionality coming soon",
    });
  };

  const handleMoveProject = (project: Project) => {
    setMovingProject(project);
    setShowMoveProject(true);
  };

  const confirmMoveProject = (folderId: number | null) => {
    if (movingProject) {
      console.log('Confirming move for project:', movingProject.id, 'to folder:', folderId);
      moveProjectMutation.mutate({
        projectId: movingProject.id,
        folderId
      });
    }
  };

  // Campbell's Journey - project exploration through detailed view
  const handleViewProject = (project: Project) => {
    setSelectedProjectDetail(project);
    setShowProjectDetail(true);
  };

  // Campbell's Journey - transformation through project rendering
  const renderProjectCard = (project: Project) => (
    <Card key={project.id} className="mb-2">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <Checkbox
              checked={selectedProjects.has(project.id)}
              onCheckedChange={(checked) => handleContextSelection(project, checked as boolean)}
            />
            <div 
              className="cursor-pointer hover:text-blue-600 dark:hover:text-blue-400"
              onClick={() => handleViewProject(project)}
            >
              <CardTitle className="text-sm">{project.name || 'Untitled Project'}</CardTitle>
              <CardDescription className="text-xs">
                {project.language || 'Unknown'} • {COMPLEXITY_LABELS[(project.complexity || 1).toString() as keyof typeof COMPLEXITY_LABELS]}
              </CardDescription>
            </div>
          </div>
          <div className="flex gap-1">
            <Button 
              size="sm" 
              variant="ghost" 
              className="h-6 w-6 p-0"
              onClick={() => handleCopyProject(project)}
              title="Copy project code"
            >
              <Copy className="w-3 h-3" />
            </Button>
            <Button 
              size="sm" 
              variant="ghost" 
              className="h-6 w-6 p-0"
              onClick={() => handleEditProject(project)}
              title="Edit project"
            >
              <Edit className="w-3 h-3" />
            </Button>
            <Button 
              size="sm" 
              variant="ghost" 
              className="h-6 w-6 p-0"
              onClick={() => handleMoveProject(project)}
              title="Move to folder"
            >
              <Folder className="w-3 h-3" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="flex flex-wrap gap-1 mb-2">
          {(project.tags || []).map(tag => (
            <Badge key={tag} variant="secondary" className="text-xs">
              {tag}
            </Badge>
          ))}
        </div>
        <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-2">
          {project.description || 'No description'}
        </p>
      </CardContent>
    </Card>
  );

  // QWAN (Quality Without A Name) - recursive folder rendering
  const renderFolderTree = (folders: ProjectFolder[], depth = 0) => (
    <div className={`${depth > 0 ? 'ml-4' : ''}`}>
      {folders.map(folder => {
        if (!folder) return null;
        
        const folderProjects = getProjectsInFolder(folder.id);
        const childFolders = buildFolderTree(folders, folder.id);
        const isExpanded = expandedFolders.has(folder.id);

        return (
          <div key={folder.id} className="mb-2">
            <div className="flex items-center gap-2 p-2 hover:bg-gray-50 dark:hover:bg-gray-800 rounded">
              <Button
                size="sm"
                variant="ghost"
                className="h-6 w-6 p-0"
                onClick={() => toggleFolder(folder.id)}
              >
                {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </Button>
              <Folder className="w-4 h-4" style={{ color: folder.color }} />
              <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{folder.name}</span>
              <Badge variant="outline" className="text-xs">
                {folderProjects.length}
              </Badge>
              <div className="flex gap-1 ml-auto">
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 w-6 p-0"
                  onClick={() => handleOpenFolder(folder)}
                  title="Manage folder files"
                >
                  <File className="w-3 h-3" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 w-6 p-0"
                  onClick={() => handleEditFolder(folder)}
                  title="Edit folder"
                >
                  <Edit className="w-3 h-3" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 w-6 p-0"
                  onClick={() => handleDeleteFolder(folder)}
                  title="Delete folder"
                >
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            </div>
            
            {isExpanded && (
              <div className="ml-6">
                {folderProjects.map(renderProjectCard)}
                {childFolders.length > 0 && renderFolderTree(childFolders, depth + 1)}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );

  // Living Spiral methodology - main render with consciousness integration
  if (showFolderManager && selectedFolder) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="ghost"
                onClick={handleBackToFolders}
                className="h-8 w-8 p-0"
              >
                <ArrowLeft className="w-4 h-4" />
              </Button>
              <DialogTitle>Files in {selectedFolder.name}</DialogTitle>
            </div>
          </DialogHeader>
          <FolderFileManager
            folderId={selectedFolder.id}
            folderName={selectedFolder.name}
          />
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Target className="w-5 h-5" />
            Enhanced Projects & Context Management
          </DialogTitle>
          <DialogDescription>
            Organize projects in folders and select them for AI context integration
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col h-[70vh]">
          {/* Context Summary */}
          {selectedProjects.size > 0 && (
            <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg mb-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">
                  {selectedProjects.size} project{selectedProjects.size !== 1 ? 's' : ''} selected for context
                </span>
                <Button
                  size="sm"
                  onClick={() => {
                    const contextProjects = projects.filter(p => selectedProjects.has(p.id));
                    onUseAsContext?.(contextProjects);
                    toast({
                      title: "Context Applied",
                      description: `${contextProjects.length} projects will inform AI generation`,
                    });
                  }}
                  className="flex items-center gap-1"
                >
                  <Sparkles className="w-3 h-3" />
                  Use as Context
                </Button>
              </div>
            </div>
          )}

          {/* Search and Filters */}
          <div className="flex gap-2 mb-4">
            <Input
              placeholder="Search projects..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1"
            />
            <Dialog open={showCreateFolder} onOpenChange={setShowCreateFolder}>
              <DialogTrigger asChild>
                <Button size="sm" className="flex items-center gap-1">
                  <FolderPlus className="w-4 h-4" />
                  New Folder
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create New Folder</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium">Name</label>
                    <Input
                      value={newFolderData.name}
                      onChange={(e) => setNewFolderData(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="Folder name"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Description</label>
                    <Textarea
                      value={newFolderData.description}
                      onChange={(e) => setNewFolderData(prev => ({ ...prev, description: e.target.value }))}
                      placeholder="Optional description"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Color</label>
                    <div className="flex gap-2 mt-1">
                      {FOLDER_COLORS.map(color => (
                        <button
                          key={color}
                          className={`w-6 h-6 rounded border-2 ${newFolderData.color === color ? 'border-gray-900' : 'border-gray-300'}`}
                          style={{ backgroundColor: color }}
                          onClick={() => setNewFolderData(prev => ({ ...prev, color }))}
                        />
                      ))}
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button onClick={handleCreateFolder} disabled={createFolderMutation.isPending}>
                    {createFolderMutation.isPending ? 'Creating...' : 'Create Folder'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {/* Edit Folder Dialog - Following CodingPhilosophy.md patterns */}
            <Dialog open={showEditFolder} onOpenChange={setShowEditFolder}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Edit Folder</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium">Name</label>
                    <Input
                      value={newFolderData.name}
                      onChange={(e) => setNewFolderData(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="Folder name"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Description</label>
                    <Textarea
                      value={newFolderData.description}
                      onChange={(e) => setNewFolderData(prev => ({ ...prev, description: e.target.value }))}
                      placeholder="Optional description"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Color</label>
                    <div className="flex gap-2 mt-1">
                      {FOLDER_COLORS.map(color => (
                        <button
                          key={color}
                          className={`w-6 h-6 rounded border-2 ${newFolderData.color === color ? 'border-gray-900' : 'border-gray-300'}`}
                          style={{ backgroundColor: color }}
                          onClick={() => setNewFolderData(prev => ({ ...prev, color }))}
                        />
                      ))}
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button 
                    onClick={() => {
                      if (editingFolder) {
                        updateFolderMutation.mutate({
                          id: editingFolder.id,
                          data: {
                            name: newFolderData.name,
                            description: newFolderData.description,
                            color: newFolderData.color,
                            icon: newFolderData.icon
                          }
                        });
                      }
                    }} 
                    disabled={updateFolderMutation.isPending}
                  >
                    {updateFolderMutation.isPending ? 'Updating...' : 'Update Folder'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {/* Delete Folder Confirmation - Jung's Descent Protocol */}
            <Dialog open={showDeleteFolder} onOpenChange={setShowDeleteFolder}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Delete Folder</DialogTitle>
                  <DialogDescription>
                    Are you sure you want to delete "{deletingFolder?.name}"? This will move all projects in this folder to "Ungrouped Projects". This action cannot be undone.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setShowDeleteFolder(false)}>
                    Cancel
                  </Button>
                  <Button 
                    variant="destructive" 
                    onClick={confirmDeleteFolder}
                    disabled={deleteFolderMutation.isPending}
                  >
                    {deleteFolderMutation.isPending ? 'Deleting...' : 'Delete Folder'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {/* Move Project Dialog - Alexander's Pattern Language */}
            <Dialog open={showMoveProject} onOpenChange={setShowMoveProject}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Move Project</DialogTitle>
                  <DialogDescription>
                    Choose a folder for "{movingProject?.name}" or select "Ungrouped" to remove from all folders.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-2">
                  <Button
                    variant="outline"
                    className="w-full justify-start"
                    onClick={() => confirmMoveProject(null)}
                  >
                    <BookOpen className="w-4 h-4 mr-2" />
                    Ungrouped Projects
                  </Button>
                  {folders.map(folder => (
                    <Button
                      key={folder.id}
                      variant="outline"
                      className="w-full justify-start"
                      onClick={() => confirmMoveProject(folder.id)}
                    >
                      <Folder className="w-4 h-4 mr-2" style={{ color: folder.color }} />
                      {folder.name}
                    </Button>
                  ))}
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setShowMoveProject(false)}>
                    Cancel
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {/* Project Detail View Dialog - Following CodingPhilosophy.md exploration patterns */}
            <Dialog open={showProjectDetail} onOpenChange={setShowProjectDetail}>
              <DialogContent className="max-w-4xl max-h-[90vh]">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <FileText className="w-5 h-5" />
                    {selectedProjectDetail?.name || 'Project Details'}
                  </DialogTitle>
                  <DialogDescription>
                    Full project output and metadata
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 max-h-[70vh] overflow-y-auto">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-gray-600 dark:text-gray-400">Language</label>
                      <p className="text-sm">{selectedProjectDetail?.language || 'Unknown'}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-600 dark:text-gray-400">Complexity</label>
                      <p className="text-sm">{COMPLEXITY_LABELS[(selectedProjectDetail?.complexity || 1).toString() as keyof typeof COMPLEXITY_LABELS]}</p>
                    </div>
                  </div>
                  
                  {selectedProjectDetail?.description && (
                    <div>
                      <label className="text-sm font-medium text-gray-600 dark:text-gray-400">Description</label>
                      <p className="text-sm mt-1">{selectedProjectDetail.description}</p>
                    </div>
                  )}

                  {selectedProjectDetail?.tags && selectedProjectDetail.tags.length > 0 && (
                    <div>
                      <label className="text-sm font-medium text-gray-600 dark:text-gray-400">Tags</label>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {selectedProjectDetail.tags.map(tag => (
                          <Badge key={tag} variant="secondary" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="text-sm font-medium text-gray-600 dark:text-gray-400">Generated Code</label>
                    <div className="mt-1 p-4 bg-gray-100 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg">
                      <pre className="text-xs whitespace-pre-wrap overflow-auto max-h-96 text-gray-900 dark:text-gray-100 font-mono leading-relaxed">
                        {selectedProjectDetail?.code || 'No code available'}
                      </pre>
                    </div>
                  </div>

                  <div className="flex gap-2 pt-4">
                    <Button
                      size="sm"
                      onClick={() => selectedProjectDetail && handleCopyProject(selectedProjectDetail)}
                      className="flex items-center gap-2"
                    >
                      <Copy className="w-4 h-4" />
                      Copy Code
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => selectedProjectDetail && handleMoveProject(selectedProjectDetail)}
                      className="flex items-center gap-2"
                    >
                      <Folder className="w-4 h-4" />
                      Move to Folder
                    </Button>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setShowProjectDetail(false)}>
                    Close
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          {/* Main Content */}
          <div className="flex-1 overflow-auto">
            {projectsLoading || foldersLoading ? (
              <div className="text-center py-8">Loading projects...</div>
            ) : (
              <div className="space-y-4">
                {/* Render Folder Tree */}
                {folders.length > 0 && (
                  <div>
                    <h3 className="text-sm font-medium mb-2 flex items-center gap-1">
                      <Folder className="w-4 h-4" />
                      Project Folders
                    </h3>
                    {renderFolderTree(buildFolderTree(folders))}
                  </div>
                )}

                {/* Ungrouped Projects */}
                {getFilteredProjects().filter(p => !p.folderId).length > 0 && (
                  <div>
                    <h3 className="text-sm font-medium mb-2 flex items-center gap-1">
                      <BookOpen className="w-4 h-4" />
                      Ungrouped Projects
                    </h3>
                    {getFilteredProjects().filter(p => !p.folderId).map(renderProjectCard)}
                  </div>
                )}

                {getFilteredProjects().length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    No projects found matching your criteria
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}