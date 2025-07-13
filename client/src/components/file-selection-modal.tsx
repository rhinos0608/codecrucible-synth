import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import type { Project } from '@shared/schema';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import {
  File,
  FileText,
  Folder,
  Code,
  Database,
  Globe,
  Settings,
  Target,
  BookOpen
} from 'lucide-react';

// File Selection Modal following AI_INSTRUCTIONS.md patterns for AI council context selection
// Implements consciousness-driven development with defensive programming

interface ProjectFile {
  id: number;
  name: string;
  path: string;
  content: string;
  type: 'code' | 'config' | 'data' | 'doc' | 'other';
  size: number;
  language?: string;
  folderId?: number;
}

interface FileSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectFiles: (files: ProjectFile[], projectContext: Project) => void;
  project: Project | null;
}

const FILE_TYPE_ICONS = {
  code: Code,
  config: Settings,
  data: Database,
  doc: BookOpen,
  other: File
};

const FILE_TYPE_COLORS = {
  code: 'text-blue-600 dark:text-blue-400',
  config: 'text-yellow-600 dark:text-yellow-400',
  data: 'text-green-600 dark:text-green-400',
  doc: 'text-purple-600 dark:text-purple-400',
  other: 'text-gray-600 dark:text-gray-400'
};

export function FileSelectionModal({
  isOpen,
  onClose,
  onSelectFiles,
  project
}: FileSelectionModalProps) {
  const { toast } = useToast();
  const [selectedFiles, setSelectedFiles] = useState<Set<number>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');

  // Fetch project files following AI_INSTRUCTIONS.md security patterns
  const { data: projectFiles = [], isLoading, error } = useQuery<ProjectFile[]>({
    queryKey: ['/api/projects', project?.id, 'files'],
    queryFn: async () => {
      if (!project?.id) return [];
      return apiRequest(`/api/projects/${project.id}/files`);
    },
    enabled: !!project?.id && isOpen,
    retry: 3,
  });

  // Reset selection when project changes
  useEffect(() => {
    setSelectedFiles(new Set());
    setSearchTerm('');
  }, [project?.id]);

  // Filter files based on search term following defensive programming
  const filteredFiles = projectFiles.filter(file => {
    if (!searchTerm) return true;
    const searchLower = searchTerm.toLowerCase();
    return file.name.toLowerCase().includes(searchLower) ||
           file.path.toLowerCase().includes(searchLower) ||
           (file.language?.toLowerCase() || '').includes(searchLower);
  });

  // Handle file selection with council-based validation
  const handleFileSelection = (fileId: number, checked: boolean) => {
    setSelectedFiles(prev => {
      const newSet = new Set(prev);
      if (checked) {
        newSet.add(fileId);
      } else {
        newSet.delete(fileId);
      }
      return newSet;
    });
  };

  // Select all filtered files
  const handleSelectAll = () => {
    const allFilteredIds = new Set(filteredFiles.map(f => f.id));
    setSelectedFiles(allFilteredIds);
  };

  // Clear all selections
  const handleClearAll = () => {
    setSelectedFiles(new Set());
  };

  // Confirm selection and pass to parent
  const handleConfirmSelection = () => {
    if (selectedFiles.size === 0) {
      toast({
        title: "No Files Selected",
        description: "Please select at least one file to provide context to the AI council.",
        variant: "destructive",
      });
      return;
    }

    const selectedFileObjects = projectFiles.filter(file => 
      selectedFiles.has(file.id)
    );

    if (!project) {
      toast({
        title: "Error",
        description: "Project context is missing. Please try again.",
        variant: "destructive",
      });
      return;
    }

    console.log('🔧 File selection confirmed:', {
      projectId: project.id,
      projectName: project.name,
      selectedFileCount: selectedFileObjects.length,
      selectedFiles: selectedFileObjects.map(f => ({ name: f.name, type: f.type, size: f.size }))
    });

    onSelectFiles(selectedFileObjects, project);
    onClose();

    toast({
      title: "Files Selected",
      description: `Selected ${selectedFileObjects.length} files from ${project.name} for AI council context.`,
    });
  };

  // Render file card with selection checkbox
  const renderFileCard = (file: ProjectFile) => {
    const IconComponent = FILE_TYPE_ICONS[file.type];
    const isSelected = selectedFiles.has(file.id);

    return (
      <Card key={file.id} className={`cursor-pointer transition-colors ${
        isSelected ? 'border-blue-500 dark:border-blue-400 bg-blue-50 dark:bg-blue-950' : ''
      }`}>
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              <Checkbox
                checked={isSelected}
                onCheckedChange={(checked) => handleFileSelection(file.id, checked as boolean)}
              />
              <IconComponent className={`w-4 h-4 ${FILE_TYPE_COLORS[file.type]}`} />
              <div>
                <CardTitle className="text-sm">{file.name}</CardTitle>
                <p className="text-xs text-gray-500 dark:text-gray-400">{file.path}</p>
              </div>
            </div>
            <div className="flex flex-col items-end gap-1">
              <Badge variant="secondary" className="text-xs">
                {file.type}
              </Badge>
              {file.language && (
                <Badge variant="outline" className="text-xs">
                  {file.language}
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
            <span>{(file.size / 1024).toFixed(1)}KB</span>
            <span>{file.content.split('\n').length} lines</span>
          </div>
          {file.content.length > 0 && (
            <div className="mt-2 p-2 bg-gray-100 dark:bg-gray-800 rounded text-xs">
              <pre className="whitespace-pre-wrap text-gray-700 dark:text-gray-300 line-clamp-3 overflow-hidden">
                {file.content.substring(0, 200)}
                {file.content.length > 200 ? '...' : ''}
              </pre>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  if (!project) {
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Target className="w-5 h-5" />
            Select Files for AI Council Context
          </DialogTitle>
          <DialogDescription>
            Choose specific files from "{project.name}" to provide context to the AI council.
            Selected files will be analyzed by the voice engines to generate more relevant solutions.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col space-y-4 max-h-[60vh]">
          {/* Search and Selection Controls */}
          <div className="flex items-center justify-between gap-4">
            <div className="flex-1">
              <input
                type="text"
                placeholder="Search files by name, path, or language..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-sm"
              />
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={handleSelectAll}
                disabled={filteredFiles.length === 0}
              >
                Select All ({filteredFiles.length})
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={handleClearAll}
                disabled={selectedFiles.size === 0}
              >
                Clear All
              </Button>
            </div>
          </div>

          {/* Selection Summary */}
          {selectedFiles.size > 0 && (
            <div className="p-3 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
              <p className="text-sm text-blue-800 dark:text-blue-200">
                {selectedFiles.size} file{selectedFiles.size !== 1 ? 's' : ''} selected for AI council context
              </p>
            </div>
          )}

          {/* File List */}
          <div className="flex-1 overflow-auto">
            {isLoading ? (
              <div className="text-center py-8">Loading project files...</div>
            ) : error ? (
              <div className="text-center py-8 text-red-600 dark:text-red-400">
                Error loading files: {error instanceof Error ? error.message : 'Unknown error'}
              </div>
            ) : filteredFiles.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                {searchTerm ? 'No files match your search' : 'No files found in this project'}
              </div>
            ) : (
              <div className="space-y-3">
                {filteredFiles.map(renderFileCard)}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button 
            onClick={handleConfirmSelection}
            disabled={selectedFiles.size === 0}
            className="flex items-center gap-2"
          >
            <Target className="w-4 h-4" />
            Use Selected Files ({selectedFiles.size})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}