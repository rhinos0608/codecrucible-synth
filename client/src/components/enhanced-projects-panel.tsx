import { useState, useEffect } from 'react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter 
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { 
  Target, 
  FolderPlus, 
  Folder, 
  BookOpen, 
  Calendar, 
  Code, 
  FileText, 
  Edit, 
  Trash2, 
  Copy, 
  Sparkles,
  ChevronDown,
  ChevronRight,
  MoreHorizontal
} from 'lucide-react';
import { 
  useProjects, 
  useCreateProject, 
  useDeleteProject, 
  useMoveProject 
} from '@/hooks/use-projects';
import { 
  useProjectFolders, 
  useCreateProjectFolder, 
  useDeleteProjectFolder,
  useUpdateProjectFolder 
} from '@/hooks/use-project-folders';
import { useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Project, ProjectFolder } from '@/shared/schema';
import { FileSelectionModal } from './file-selection-modal';
import { FeatureGate } from './FeatureGate';

const FOLDER_COLORS = [
  '#3B82F6', '#10B981', '#F59E0B', '#EF4444', 
  '#8B5CF6', '#06B6D4', '#84CC16', '#F97316'
];

interface EnhancedProjectsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onUseAsContext?: (projects: Project[]) => void;
  selectedContextProjects: Project[];
}

export function EnhancedProjectsPanel({ 
  isOpen, 
  onClose, 
  onUseAsContext, 
  selectedContextProjects = [] 
}: EnhancedProjectsPanelProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // State management
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProjects, setSelectedProjects] = useState<Set<number>>(new Set());
  const [expandedFolders, setExpandedFolders] = useState<Set<number>>(new Set());
  const [expandedProjects, setExpandedProjects] = useState<Set<number>>(new Set());
  
  // Dialog states
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [showDeleteProject, setShowDeleteProject] = useState(false);
  const [showFileSelection, setShowFileSelection] = useState(false);
  
  // Form data
  const [newFolderData, setNewFolderData] = useState({ 
    name: '', 
    description: '', 
    color: FOLDER_COLORS[0] 
  });
  
  // Selection states
  const [deletingProject, setDeletingProject] = useState<Project | null>(null);
  const [fileSelectionProject, setFileSelectionProject] = useState<Project | null>(null);
  
  // Data hooks - Fixed to use correct destructuring
  const { projects = [], isLoading: projectsLoading, error: projectsError } = useProjects();
  const { data: folders = [], isLoading: foldersLoading, error: foldersError } = useProjectFolders();
  
  // Enhanced debugging to track hook data flow
  console.log('🔧 Hook Data Flow Debug:', {
    useProjectsResult: useProjects(),
    projectsFromHook: projects,
    projectsLength: projects.length,
    projectsLoading,
    projectsError: projectsError?.message || null
  });

  // Debug logging in development and force refresh when panel opens
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      console.log('🎯 Enhanced Projects Panel Data:', {
        projects: projects.length,
        folders: folders.length,
        projectsLoading,
        foldersLoading,
        projectsError: projectsError?.message || null,
        foldersError: foldersError?.message || null,
        projectIds: projects.map(p => p.id),
        projectNames: projects.map(p => p.name)
      });
    }
  }, [projects, folders, projectsLoading, foldersLoading, projectsError, foldersError]);
  
  // Force refresh when panel opens to ensure latest data
  useEffect(() => {
    if (isOpen) {
      console.log('🔄 Projects panel opened - forcing data refresh');
      queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
      queryClient.invalidateQueries({ queryKey: ['/api/project-folders'] });
    }
  }, [isOpen, queryClient]);
  
  // Mutation hooks
  const createFolderMutation = useCreateProjectFolder();
  const deleteProjectMutation = useDeleteProject();
  const moveMutation = useMoveProject();
  
  // Initialize selected projects from props
  useEffect(() => {
    const initialSelected = new Set(selectedContextProjects.map(p => p.id));
    setSelectedProjects(initialSelected);
  }, [selectedContextProjects]);

  // Handler functions
  const handleCreateFolder = async () => {
    if (!newFolderData.name.trim()) {
      toast({
        title: "Error",
        description: "Folder name is required",
        variant: "destructive",
      });
      return;
    }

    try {
      await createFolderMutation.mutateAsync(newFolderData);
      setShowCreateFolder(false);
      setNewFolderData({ name: '', description: '', color: FOLDER_COLORS[0] });
      toast({
        title: "Success",
        description: "Folder created successfully",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to create folder",
        variant: "destructive",
      });
    }
  };

  const handleDeleteProject = (project: Project) => {
    setDeletingProject(project);
    setShowDeleteProject(true);
  };

  const confirmDeleteProject = async () => {
    if (!deletingProject) return;

    try {
      await deleteProjectMutation.mutateAsync(deletingProject.id);
      setShowDeleteProject(false);
      setDeletingProject(null);
      toast({
        title: "Success",
        description: "Project deleted successfully",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete project",
        variant: "destructive",
      });
    }
  };

  const handleSelectFiles = (project: Project) => {
    setFileSelectionProject(project);
    setShowFileSelection(true);
  };

  const handleFilesSelected = (files: any[], projectContext: Project) => {
    console.log('Files selected for AI context:', files, 'from project:', projectContext);
    setShowFileSelection(false);
    toast({
      title: "Files Selected",
      description: `${files.length} files selected from ${projectContext.name}`,
    });
  };

  const toggleProjectSelection = (projectId: number) => {
    const newSelected = new Set(selectedProjects);
    if (newSelected.has(projectId)) {
      newSelected.delete(projectId);
    } else {
      newSelected.add(projectId);
    }
    setSelectedProjects(newSelected);
  };

  const toggleProjectExpansion = (projectId: number) => {
    const newExpanded = new Set(expandedProjects);
    if (newExpanded.has(projectId)) {
      newExpanded.delete(projectId);
    } else {
      newExpanded.add(projectId);
    }
    setExpandedProjects(newExpanded);
  };

  const getFilteredProjects = () => {
    return projects.filter(project =>
      project.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      project.description?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  };

  const renderProjectCard = (project: Project) => {
    const isExpanded = expandedProjects.has(project.id);
    const isSelected = selectedProjects.has(project.id);
    
    return (
      <Card 
        key={project.id} 
        className={`transition-colors hover:bg-gray-50 dark:hover:bg-gray-800 ${
          isSelected ? 'ring-2 ring-blue-500' : ''
        }`}
      >
        <CardContent className="p-4">
          <div className="flex items-start justify-between">
            <div 
              className="flex-1 cursor-pointer"
              onClick={() => toggleProjectExpansion(project.id)}
            >
              <div className="flex items-center gap-2 mb-1">
                <h4 className="font-medium text-sm">{project.name}</h4>
                {isExpanded ? 
                  <ChevronDown className="w-4 h-4 text-gray-500" /> : 
                  <ChevronRight className="w-4 h-4 text-gray-500" />
                }
              </div>
              {project.description && (
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                  {project.description}
                </p>
              )}
              <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                <span className="flex items-center gap-1">
                  <Code className="w-3 h-3" />
                  {project.language || 'javascript'}
                </span>
                <span className="flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  {new Date(project.createdAt).toLocaleDateString()}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-1 ml-2">
              <Button
                size="sm"
                variant="ghost"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleProjectSelection(project.id);
                }}
                className={`h-7 w-7 p-0 ${isSelected ? 'bg-blue-100 dark:bg-blue-900' : ''}`}
                title="Select for AI context"
              >
                <Sparkles className={`w-3 h-3 ${isSelected ? 'text-blue-600' : 'text-gray-500'}`} />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={(e) => {
                  e.stopPropagation();
                  handleSelectFiles(project);
                }}
                className="h-7 w-7 p-0"
                title="Select specific files"
              >
                <Target className="w-3 h-3" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeleteProject(project);
                }}
                className="h-7 w-7 p-0 text-red-600 hover:text-red-700"
                title="Delete project"
              >
                <Trash2 className="w-3 h-3" />
              </Button>
            </div>
          </div>
          
          {/* Expanded Code Content */}
          {isExpanded && (
            <div className="mt-4 border-t pt-4">
              <div className="bg-gray-900 dark:bg-gray-950 rounded-lg p-4 max-h-96 overflow-y-auto">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-gray-400 font-mono">Full Project Code</span>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      navigator.clipboard.writeText(project.code || '');
                      toast({
                        title: "Copied",
                        description: "Project code copied to clipboard",
                      });
                    }}
                    className="h-6 w-6 p-0 text-gray-400 hover:text-gray-300"
                  >
                    <Copy className="w-3 h-3" />
                  </Button>
                </div>
                <pre className="text-xs text-gray-100 dark:text-gray-100 font-mono whitespace-pre-wrap break-words">
                  {project.code || 'No code available for this project.'}
                </pre>
              </div>
              
              {/* Project Actions when expanded */}
              <div className="flex items-center gap-2 mt-3 pt-3 border-t">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    toggleProjectSelection(project.id);
                    toast({
                      title: isSelected ? "Removed from Context" : "Added to Context",
                      description: `${project.name} ${isSelected ? 'removed from' : 'added to'} AI context`,
                    });
                  }}
                  className="flex items-center gap-1"
                >
                  <Sparkles className="w-3 h-3" />
                  {isSelected ? 'Remove from Context' : 'Add to Context'}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleSelectFiles(project)}
                  className="flex items-center gap-1"
                >
                  <Target className="w-3 h-3" />
                  Select Files
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <>
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

            {/* Search and Controls */}
            <div className="flex gap-2 mb-4">
              <Input
                placeholder="Search projects..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="flex-1"
              />
              <FeatureGate feature="project_folders" tier="pro">
                <Button 
                  size="sm" 
                  className="flex items-center gap-1"
                  onClick={() => setShowCreateFolder(true)}
                >
                  <FolderPlus className="w-4 h-4" />
                  New Folder
                </Button>
              </FeatureGate>
            </div>

            {/* Main Content */}
            <div className="flex-1 overflow-auto">
              {projectsLoading || foldersLoading ? (
                <div className="text-center py-8">Loading projects...</div>
              ) : (
                <div className="space-y-4">
                  {/* Debug Information */}
                  {process.env.NODE_ENV === 'development' && (
                    <div className="text-xs text-gray-500 p-2 bg-gray-100 dark:bg-gray-800 rounded">
                      Debug: {projects.length} projects, {folders.length} folders
                    </div>
                  )}

                  {/* Project Folders */}
                  {folders.map(folder => (
                    <div key={folder.id} className="space-y-2">
                      <div className="flex items-center gap-2 cursor-pointer" 
                           onClick={() => {
                             const newExpanded = new Set(expandedFolders);
                             if (newExpanded.has(folder.id)) {
                               newExpanded.delete(folder.id);
                             } else {
                               newExpanded.add(folder.id);
                             }
                             setExpandedFolders(newExpanded);
                           }}>
                        {expandedFolders.has(folder.id) ? 
                          <ChevronDown className="w-4 h-4" /> : 
                          <ChevronRight className="w-4 h-4" />
                        }
                        <Folder className="w-4 h-4" style={{ color: folder.color }} />
                        <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">
                          {folder.name}
                        </h3>
                        <span className="text-xs text-gray-500">
                          ({getFilteredProjects().filter(p => p.folderId === folder.id).length})
                        </span>
                      </div>
                      
                      {expandedFolders.has(folder.id) && (
                        <div className="ml-6 space-y-2">
                          {getFilteredProjects().filter(p => p.folderId === folder.id).length > 0 ? (
                            getFilteredProjects().filter(p => p.folderId === folder.id).map(renderProjectCard)
                          ) : (
                            <div className="text-xs text-gray-500 py-2">No projects in this folder</div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}

                  {/* Ungrouped Projects */}
                  {getFilteredProjects().filter(p => !p.folderId).length > 0 && (
                    <div>
                      <h3 className="text-sm font-medium mb-2 flex items-center gap-1">
                        <BookOpen className="w-4 h-4" />
                        Ungrouped Projects ({getFilteredProjects().filter(p => !p.folderId).length})
                      </h3>
                      <div className="space-y-2">
                        {getFilteredProjects().filter(p => !p.folderId).map(renderProjectCard)}
                      </div>
                    </div>
                  )}

                  {/* Empty State */}
                  {getFilteredProjects().length === 0 && folders.length === 0 && (
                    <div className="text-center py-8 text-gray-500">
                      <BookOpen className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      <p>No projects or folders found</p>
                      <p className="text-xs mt-1">Create your first project by generating code with the AI voices</p>
                    </div>
                  )}
                  
                  {/* No Projects Found */}
                  {getFilteredProjects().length === 0 && folders.length > 0 && (
                    <div className="text-center py-4 text-gray-500">
                      <p className="text-sm">No projects match your search criteria</p>
                      <p className="text-xs mt-1">Try adjusting your search or check different folders</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Create Folder Dialog */}
      <Dialog open={showCreateFolder} onOpenChange={setShowCreateFolder}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Folder</DialogTitle>
            <DialogDescription>
              Organize your projects with custom folders
            </DialogDescription>
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
            <Button variant="outline" onClick={() => setShowCreateFolder(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateFolder} disabled={createFolderMutation.isPending}>
              {createFolderMutation.isPending ? 'Creating...' : 'Create Folder'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Project Confirmation */}
      <Dialog open={showDeleteProject} onOpenChange={setShowDeleteProject}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Project</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{deletingProject?.name}"? This action cannot be undone and will permanently remove the project and all its code.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteProject(false)}>
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={confirmDeleteProject}
              disabled={deleteProjectMutation.isPending}
            >
              {deleteProjectMutation.isPending ? 'Deleting...' : 'Delete Project'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* File Selection Modal */}
      <FileSelectionModal
        isOpen={showFileSelection}
        onClose={() => setShowFileSelection(false)}
        onSelectFiles={handleFilesSelected}
        project={fileSelectionProject}
      />
    </>
  );
}