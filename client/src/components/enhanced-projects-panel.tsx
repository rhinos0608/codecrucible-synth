import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { 
  FolderOpen, 
  FolderPlus, 
  File, 
  Plus, 
  Search, 
  Tag, 
  Brain, 
  Crown, 
  Settings, 
  ChevronRight, 
  ChevronDown,
  Copy,
  Trash2,
  Edit,
  Move,
  Filter,
  History,
  Zap,
  Target,
  BookOpen,
  Code,
  Layers,
  TreePine,
  Sparkles
} from 'lucide-react';

interface ProjectFolder {
  id: number;
  name: string;
  description?: string;
  color?: string;
  icon?: string;
  parentId?: number;
  userId: string;
  sortOrder: number;
  isShared: boolean;
  visibility: 'private' | 'team' | 'public';
  createdAt: Date;
  updatedAt: Date;
}

interface Project {
  id: number;
  name: string;
  description?: string;
  code: string;
  language: string;
  framework?: string;
  complexity: number;
  userId: string;
  sessionId?: number;
  folderId?: number;
  tags: string[];
  isPublic: boolean;
  createdAt: Date;
  updatedAt: Date;
}

interface EnhancedProjectsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onUseAsContext?: (projects: Project[]) => void;
  selectedContextProjects?: Project[];
}

const LANGUAGE_COLORS = {
  'typescript': '#3178C6',
  'javascript': '#F7DF1E',
  'python': '#3776AB',
  'react': '#61DAFB',
  'vue': '#4FC08D',
  'angular': '#DD0031',
  'node': '#339933',
  'express': '#000000',
  'css': '#1572B6',
  'html': '#E34F26',
  'sql': '#4479A1',
  'php': '#777BB4',
  'java': '#ED8B00',
  'c++': '#00599C',
  'rust': '#000000',
  'go': '#00ADD8',
  'default': '#6B7280'
};

const COMPLEXITY_LABELS = {
  1: 'Simple',
  2: 'Medium',
  3: 'Complex',
  4: 'Advanced',
  5: 'Expert'
};

export function EnhancedProjectsPanel({ 
  isOpen, 
  onClose, 
  onUseAsContext,
  selectedContextProjects = []
}: EnhancedProjectsPanelProps) {
  const [activeTab, setActiveTab] = useState('browse');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>([]);
  const [complexityFilter, setComplexityFilter] = useState<number | null>(null);
  const [expandedFolders, setExpandedFolders] = useState<Set<number>>(new Set());
  const [selectedProjects, setSelectedProjects] = useState<Set<number>>(new Set());
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [selectedFolder, setSelectedFolder] = useState<ProjectFolder | null>(null);
  const [newFolderData, setNewFolderData] = useState({
    name: '',
    description: '',
    color: '#3B82F6',
    icon: 'folder',
    parentId: null as number | null,
    visibility: 'private' as 'private' | 'team' | 'public'
  });

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch projects
  const { data: projects = [], isLoading: projectsLoading } = useQuery({
    queryKey: ['/api/projects'],
    enabled: isOpen
  });

  // Fetch folders
  const { data: folders = [], isLoading: foldersLoading } = useQuery({
    queryKey: ['/api/project-folders'],
    enabled: isOpen
  });

  // Create folder mutation
  const createFolderMutation = useMutation({
    mutationFn: async (folderData: any) => {
      return await apiRequest('/api/project-folders', {
        method: 'POST',
        body: JSON.stringify(folderData)
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/project-folders'] });
      setShowCreateFolder(false);
      setNewFolderData({
        name: '',
        description: '',
        color: '#3B82F6',
        icon: 'folder',
        parentId: null,
        visibility: 'private'
      });
      toast({
        title: "Folder created",
        description: "Your project folder has been created successfully."
      });
    },
    onError: (error: any) => {
      if (error.message.includes('subscription')) {
        toast({
          title: "Pro subscription required",
          description: "Project folders are available with Pro subscription.",
          variant: "destructive"
        });
      } else {
        toast({
          title: "Error",
          description: "Failed to create folder. Please try again.",
          variant: "destructive"
        });
      }
    }
  });

  // Move project mutation
  const moveProjectMutation = useMutation({
    mutationFn: async ({ projectId, folderId }: { projectId: number; folderId: number | null }) => {
      return await apiRequest(`/api/projects/${projectId}/move`, {
        method: 'POST',
        body: JSON.stringify({ folderId })
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
      toast({
        title: "Project moved",
        description: "Project has been moved successfully."
      });
    },
    onError: (error: any) => {
      if (error.message.includes('subscription')) {
        toast({
          title: "Pro subscription required",
          description: "Project organization requires Pro subscription.",
          variant: "destructive"
        });
      } else {
        toast({
          title: "Error",
          description: "Failed to move project. Please try again.",
          variant: "destructive"
        });
      }
    }
  });

  // Context selection handler
  const handleContextSelection = (project: Project, selected: boolean) => {
    if (selected) {
      setSelectedProjects(prev => new Set([...prev, project.id]));
    } else {
      setSelectedProjects(prev => {
        const newSet = new Set(prev);
        newSet.delete(project.id);
        return newSet;
      });
    }
  };

  // Apply context selection
  const handleApplyContext = () => {
    const contextProjects = projects.filter((p: Project) => selectedProjects.has(p.id));
    if (onUseAsContext) {
      onUseAsContext(contextProjects);
    }
    toast({
      title: "Context applied",
      description: `${contextProjects.length} projects selected as context for AI generation.`
    });
  };

  // Filter projects based on search and filters
  const filteredProjects = projects.filter((project: Project) => {
    const matchesSearch = project.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         project.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         project.code.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesTags = selectedTags.length === 0 || 
                       selectedTags.some(tag => project.tags.includes(tag));
    
    const matchesLanguage = selectedLanguages.length === 0 || 
                           selectedLanguages.includes(project.language);
    
    const matchesComplexity = complexityFilter === null || 
                             project.complexity === complexityFilter;
    
    return matchesSearch && matchesTags && matchesLanguage && matchesComplexity;
  });

  // Get all unique tags and languages
  const allTags = [...new Set(projects.flatMap((p: Project) => p.tags))];
  const allLanguages = [...new Set(projects.map((p: Project) => p.language))];

  // Build folder tree
  const buildFolderTree = (folders: ProjectFolder[], parentId: number | null = null): ProjectFolder[] => {
    return folders
      .filter(folder => folder.parentId === parentId)
      .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
  };

  // Get projects in folder
  const getProjectsInFolder = (folderId: number | null): Project[] => {
    return filteredProjects.filter((p: Project) => p.folderId === folderId);
  };

  // Folder tree renderer
  const renderFolderTree = (folders: ProjectFolder[], level: number = 0) => {
    return folders.map(folder => {
      const isExpanded = expandedFolders.has(folder.id);
      const folderProjects = getProjectsInFolder(folder.id);
      const childFolders = buildFolderTree(folders, folder.id);
      
      return (
        <div key={folder.id} className="mb-2">
          <div 
            className={`flex items-center gap-2 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer ${level > 0 ? 'ml-4' : ''}`}
            onClick={() => {
              if (isExpanded) {
                setExpandedFolders(prev => {
                  const newSet = new Set(prev);
                  newSet.delete(folder.id);
                  return newSet;
                });
              } else {
                setExpandedFolders(prev => new Set([...prev, folder.id]));
              }
            }}
          >
            {isExpanded ? (
              <ChevronDown className="w-4 h-4 text-gray-500" />
            ) : (
              <ChevronRight className="w-4 h-4 text-gray-500" />
            )}
            <FolderOpen 
              className="w-4 h-4" 
              style={{ color: folder.color || '#3B82F6' }}
            />
            <span className="font-medium">{folder.name}</span>
            <Badge variant="secondary" className="ml-auto">
              {folderProjects.length}
            </Badge>
          </div>
          
          {isExpanded && (
            <div className="ml-6 mt-2 space-y-1">
              {folderProjects.map(project => renderProjectCard(project))}
              {childFolders.length > 0 && renderFolderTree(childFolders, level + 1)}
            </div>
          )}
        </div>
      );
    });
  };

  // Project card renderer
  const renderProjectCard = (project: Project) => {
    const isSelected = selectedProjects.has(project.id);
    const languageColor = LANGUAGE_COLORS[project.language.toLowerCase()] || LANGUAGE_COLORS.default;
    
    return (
      <Card key={project.id} className={`mb-2 transition-all ${isSelected ? 'ring-2 ring-blue-500' : ''}`}>
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              <Checkbox
                checked={isSelected}
                onCheckedChange={(checked) => handleContextSelection(project, checked as boolean)}
                className="mt-1"
              />
              <div>
                <CardTitle className="text-sm">{project.name}</CardTitle>
                <CardDescription className="text-xs">
                  {project.description || 'No description'}
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Badge 
                variant="outline" 
                className="text-xs"
                style={{ borderColor: languageColor, color: languageColor }}
              >
                {project.language}
              </Badge>
              <Badge variant="secondary" className="text-xs">
                {COMPLEXITY_LABELS[project.complexity as keyof typeof COMPLEXITY_LABELS]}
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="flex items-center justify-between">
            <div className="flex gap-1">
              {project.tags.slice(0, 3).map(tag => (
                <Badge key={tag} variant="outline" className="text-xs">
                  {tag}
                </Badge>
              ))}
              {project.tags.length > 3 && (
                <Badge variant="outline" className="text-xs">
                  +{project.tags.length - 3}
                </Badge>
              )}
            </div>
            <div className="flex gap-1">
              <Button size="sm" variant="ghost" className="h-6 px-2">
                <Copy className="w-3 h-3" />
              </Button>
              <Button size="sm" variant="ghost" className="h-6 px-2">
                <Edit className="w-3 h-3" />
              </Button>
              <Button size="sm" variant="ghost" className="h-6 px-2">
                <Move className="w-3 h-3" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TreePine className="w-5 h-5" />
            Enhanced Projects Library
            <Badge variant="outline" className="ml-2">
              <Sparkles className="w-3 h-3 mr-1" />
              Living Spiral Architecture
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="browse">
              <BookOpen className="w-4 h-4 mr-2" />
              Browse & Context
            </TabsTrigger>
            <TabsTrigger value="organize">
              <FolderOpen className="w-4 h-4 mr-2" />
              Organize
              <Crown className="w-3 h-3 ml-1" />
            </TabsTrigger>
            <TabsTrigger value="analytics">
              <Target className="w-4 h-4 mr-2" />
              Pattern Analytics
            </TabsTrigger>
            <TabsTrigger value="synthesis">
              <Brain className="w-4 h-4 mr-2" />
              Synthesis Library
            </TabsTrigger>
          </TabsList>

          <TabsContent value="browse" className="flex-1 flex flex-col">
            <div className="flex gap-4 mb-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                  <Input
                    placeholder="Search projects, code, or descriptions..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <Select value={complexityFilter?.toString() || ""} onValueChange={(value) => setComplexityFilter(value ? parseInt(value) : null)}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Complexity" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All Levels</SelectItem>
                  {Object.entries(COMPLEXITY_LABELS).map(([level, label]) => (
                    <SelectItem key={level} value={level}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                onClick={handleApplyContext}
                disabled={selectedProjects.size === 0}
                className="flex items-center gap-2"
              >
                <Brain className="w-4 h-4" />
                Apply Context ({selectedProjects.size})
              </Button>
            </div>

            <div className="flex gap-4 mb-4">
              <div className="flex gap-2 flex-wrap">
                {allLanguages.map(lang => (
                  <Badge
                    key={lang}
                    variant={selectedLanguages.includes(lang) ? "default" : "outline"}
                    className="cursor-pointer"
                    onClick={() => {
                      if (selectedLanguages.includes(lang)) {
                        setSelectedLanguages(prev => prev.filter(l => l !== lang));
                      } else {
                        setSelectedLanguages(prev => [...prev, lang]);
                      }
                    }}
                  >
                    {lang}
                  </Badge>
                ))}
              </div>
            </div>

            <ScrollArea className="flex-1">
              <div className="space-y-4">
                {/* Root projects (no folder) */}
                <div className="space-y-2">
                  <h3 className="font-medium text-gray-700 dark:text-gray-300">Root Projects</h3>
                  {getProjectsInFolder(null).map(project => renderProjectCard(project))}
                </div>

                {/* Folder tree */}
                <div className="space-y-2">
                  <h3 className="font-medium text-gray-700 dark:text-gray-300">Organized Projects</h3>
                  {renderFolderTree(buildFolderTree(folders))}
                </div>
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="organize" className="flex-1">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium">Project Organization</h3>
              <Button
                onClick={() => setShowCreateFolder(true)}
                className="flex items-center gap-2"
              >
                <FolderPlus className="w-4 h-4" />
                Create Folder
                <Crown className="w-3 h-3 ml-1" />
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Layers className="w-4 h-4" />
                    Folder Structure
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-64">
                    {renderFolderTree(buildFolderTree(folders))}
                  </ScrollArea>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Code className="w-4 h-4" />
                    Pattern Recognition
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      Automatically detected patterns in your projects:
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {allLanguages.map(lang => (
                        <Badge key={lang} variant="outline">
                          {lang}: {projects.filter((p: Project) => p.language === lang).length}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="analytics" className="flex-1">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Context Usage</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{selectedContextProjects.length}</div>
                  <div className="text-xs text-gray-500">Projects in context</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Pattern Evolution</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{folders.length}</div>
                  <div className="text-xs text-gray-500">Organized patterns</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">QWAN Score</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">87%</div>
                  <div className="text-xs text-gray-500">Quality without a name</div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="synthesis" className="flex-1">
            <div className="text-center py-8">
              <Brain className="w-16 h-16 mx-auto mb-4 text-gray-400" />
              <h3 className="text-lg font-medium mb-2">Synthesis Library</h3>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                Your synthesized solutions will appear here after running council generation.
              </p>
              <Button variant="outline">
                <Zap className="w-4 h-4 mr-2" />
                Generate New Synthesis
              </Button>
            </div>
          </TabsContent>
        </Tabs>

        {/* Create Folder Dialog */}
        <Dialog open={showCreateFolder} onOpenChange={setShowCreateFolder}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Folder</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="folderName">Folder Name</Label>
                <Input
                  id="folderName"
                  value={newFolderData.name}
                  onChange={(e) => setNewFolderData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Enter folder name"
                />
              </div>
              <div>
                <Label htmlFor="folderDescription">Description</Label>
                <Textarea
                  id="folderDescription"
                  value={newFolderData.description}
                  onChange={(e) => setNewFolderData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Optional description"
                />
              </div>
              <div className="flex gap-4">
                <div className="flex-1">
                  <Label htmlFor="folderColor">Color</Label>
                  <Input
                    id="folderColor"
                    type="color"
                    value={newFolderData.color}
                    onChange={(e) => setNewFolderData(prev => ({ ...prev, color: e.target.value }))}
                  />
                </div>
                <div className="flex-1">
                  <Label htmlFor="folderVisibility">Visibility</Label>
                  <Select
                    value={newFolderData.visibility}
                    onValueChange={(value) => setNewFolderData(prev => ({ ...prev, visibility: value as 'private' | 'team' | 'public' }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="private">Private</SelectItem>
                      <SelectItem value="team">Team</SelectItem>
                      <SelectItem value="public">Public</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setShowCreateFolder(false)}>
                  Cancel
                </Button>
                <Button 
                  onClick={() => createFolderMutation.mutate(newFolderData)}
                  disabled={createFolderMutation.isPending || !newFolderData.name}
                >
                  Create Folder
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </DialogContent>
    </Dialog>
  );
}