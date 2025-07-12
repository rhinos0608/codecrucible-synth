import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Button
} from '@/components/ui/button';
import {
  Input
} from '@/components/ui/input';
import {
  Textarea
} from '@/components/ui/textarea';
import {
  Label
} from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Switch
} from '@/components/ui/switch';
import {
  Badge
} from '@/components/ui/badge';
import {
  Separator
} from '@/components/ui/separator';
import { 
  File, 
  Plus, 
  Edit, 
  Trash2, 
  FileText, 
  Code2, 
  Braces, 
  Database,
  Globe,
  Eye,
  EyeOff,
  Download,
  Upload,
  Brain
} from 'lucide-react';

interface FolderFile {
  id: number;
  folderId: number;
  name: string;
  content: string;
  fileType: string;
  language: string;
  description?: string;
  tags: string[];
  isContextEnabled: boolean;
  userId: string;
  createdAt: string;
  updatedAt: string;
}

interface FolderFileManagerProps {
  folderId: number;
  folderName: string;
}

const FILE_LANGUAGES = [
  { value: 'javascript', label: 'JavaScript', icon: '🟨' },
  { value: 'typescript', label: 'TypeScript', icon: '🔷' },
  { value: 'python', label: 'Python', icon: '🐍' },
  { value: 'java', label: 'Java', icon: '☕' },
  { value: 'cpp', label: 'C++', icon: '⚡' },
  { value: 'csharp', label: 'C#', icon: '🔷' },
  { value: 'html', label: 'HTML', icon: '🌐' },
  { value: 'css', label: 'CSS', icon: '🎨' },
  { value: 'sql', label: 'SQL', icon: '🗄️' },
  { value: 'json', label: 'JSON', icon: '📋' },
  { value: 'yaml', label: 'YAML', icon: '📄' },
  { value: 'markdown', label: 'Markdown', icon: '📝' },
  { value: 'text', label: 'Plain Text', icon: '📄' },
];

export function FolderFileManager({ folderId, folderName }: FolderFileManagerProps) {
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingFile, setEditingFile] = useState<FolderFile | null>(null);
  const [newFile, setNewFile] = useState({
    name: '',
    content: '',
    fileType: 'text',
    language: 'text',
    description: '',
    tags: [] as string[],
    isContextEnabled: false,
  });
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch folder files following AI_INSTRUCTIONS.md patterns
  const { data: files = [], isLoading } = useQuery({
    queryKey: [`/api/folders/${folderId}/files`],
    retry: 1,
    staleTime: 30000,
  });

  // Create file mutation
  const createFile = useMutation({
    mutationFn: async (fileData: typeof newFile) => {
      return await apiRequest('POST', `/api/folders/${folderId}/files`, fileData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/folders/${folderId}/files`] });
      setShowCreateDialog(false);
      setNewFile({
        name: '',
        content: '',
        fileType: 'text',
        language: 'text',
        description: '',
        tags: [],
        isContextEnabled: false,
      });
      toast({
        title: "File created",
        description: "Your file has been created successfully."
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: "Failed to create file. Please try again.",
        variant: "destructive"
      });
    }
  });

  // Update file mutation
  const updateFile = useMutation({
    mutationFn: async ({ fileId, updates }: { fileId: number; updates: Partial<FolderFile> }) => {
      return await apiRequest('PUT', `/api/files/${fileId}`, updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/folders/${folderId}/files`] });
      setShowEditDialog(false);
      setEditingFile(null);
      toast({
        title: "File updated",
        description: "Your file has been updated successfully."
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: "Failed to update file. Please try again.",
        variant: "destructive"
      });
    }
  });

  // Delete file mutation
  const deleteFile = useMutation({
    mutationFn: async (fileId: number) => {
      return await apiRequest('DELETE', `/api/files/${fileId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/folders/${folderId}/files`] });
      toast({
        title: "File deleted",
        description: "Your file has been deleted successfully."
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: "Failed to delete file. Please try again.",
        variant: "destructive"
      });
    }
  });

  const handleCreateFile = () => {
    if (!newFile.name.trim() || !newFile.content.trim()) {
      toast({
        title: "Validation Error",
        description: "File name and content are required.",
        variant: "destructive"
      });
      return;
    }
    createFile.mutate(newFile);
  };

  const handleEditFile = (file: FolderFile) => {
    setEditingFile(file);
    setShowEditDialog(true);
  };

  const handleUpdateFile = () => {
    if (!editingFile) return;
    updateFile.mutate({
      fileId: editingFile.id,
      updates: editingFile
    });
  };

  const handleDeleteFile = (fileId: number) => {
    if (confirm('Are you sure you want to delete this file?')) {
      deleteFile.mutate(fileId);
    }
  };

  const getLanguageInfo = (language: string) => {
    return FILE_LANGUAGES.find(lang => lang.value === language) || FILE_LANGUAGES[FILE_LANGUAGES.length - 1];
  };

  const getFileIcon = (fileType: string, language: string) => {
    if (language === 'javascript' || language === 'typescript') return <Code2 className="w-4 h-4" />;
    if (language === 'sql') return <Database className="w-4 h-4" />;
    if (language === 'html' || language === 'css') return <Globe className="w-4 h-4" />;
    if (language === 'json' || language === 'yaml') return <Braces className="w-4 h-4" />;
    return <FileText className="w-4 h-4" />;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Files in "{folderName}"</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Manage text files and enable AI context integration
          </p>
        </div>
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Add File
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create New File</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="fileName">File Name</Label>
                  <Input
                    id="fileName"
                    value={newFile.name}
                    onChange={(e) => setNewFile(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="example.js"
                  />
                </div>
                <div>
                  <Label htmlFor="language">Language</Label>
                  <Select value={newFile.language} onValueChange={(value) => 
                    setNewFile(prev => ({ ...prev, language: value }))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {FILE_LANGUAGES.map(lang => (
                        <SelectItem key={lang.value} value={lang.value}>
                          {lang.icon} {lang.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div>
                <Label htmlFor="description">Description (Optional)</Label>
                <Input
                  id="description"
                  value={newFile.description}
                  onChange={(e) => setNewFile(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Brief description of this file"
                />
              </div>

              <div>
                <Label htmlFor="content">Content</Label>
                <Textarea
                  id="content"
                  value={newFile.content}
                  onChange={(e) => setNewFile(prev => ({ ...prev, content: e.target.value }))}
                  placeholder="Enter your file content here..."
                  className="min-h-[200px] font-mono"
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Switch
                    id="contextEnabled"
                    checked={newFile.isContextEnabled}
                    onCheckedChange={(checked) => 
                      setNewFile(prev => ({ ...prev, isContextEnabled: checked }))}
                  />
                  <Label htmlFor="contextEnabled" className="flex items-center gap-2">
                    <Brain className="w-4 h-4" />
                    Enable AI Context Integration
                  </Label>
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                  Cancel
                </Button>
                <Button 
                  onClick={handleCreateFile}
                  disabled={createFile.isPending}
                >
                  {createFile.isPending ? 'Creating...' : 'Create File'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Files List */}
      {isLoading ? (
        <div className="text-center py-8">Loading files...</div>
      ) : files.length === 0 ? (
        <Card>
          <CardContent className="text-center py-8">
            <File className="w-16 h-16 mx-auto mb-4 text-gray-400" />
            <h3 className="text-lg font-medium mb-2">No Files Yet</h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Add text files to this folder and enable AI context integration.
            </p>
            <Button onClick={() => setShowCreateDialog(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Create First File
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {files.map((file: FolderFile) => (
            <Card key={file.id}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {getFileIcon(file.fileType, file.language)}
                    <div>
                      <CardTitle className="text-sm">{file.name}</CardTitle>
                      <CardDescription className="flex items-center gap-2">
                        {getLanguageInfo(file.language).icon} {getLanguageInfo(file.language).label}
                        {file.isContextEnabled && (
                          <Badge variant="secondary" className="text-xs">
                            <Brain className="w-3 h-3 mr-1" />
                            AI Context
                          </Badge>
                        )}
                      </CardDescription>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEditFile(file)}
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDeleteFile(file.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              {file.description && (
                <CardContent className="pt-0">
                  <p className="text-sm text-gray-600 dark:text-gray-400">{file.description}</p>
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit File</DialogTitle>
          </DialogHeader>
          {editingFile && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="editFileName">File Name</Label>
                  <Input
                    id="editFileName"
                    value={editingFile.name}
                    onChange={(e) => setEditingFile(prev => prev ? { ...prev, name: e.target.value } : null)}
                  />
                </div>
                <div>
                  <Label htmlFor="editLanguage">Language</Label>
                  <Select 
                    value={editingFile.language} 
                    onValueChange={(value) => 
                      setEditingFile(prev => prev ? { ...prev, language: value } : null)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {FILE_LANGUAGES.map(lang => (
                        <SelectItem key={lang.value} value={lang.value}>
                          {lang.icon} {lang.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label htmlFor="editDescription">Description</Label>
                <Input
                  id="editDescription"
                  value={editingFile.description || ''}
                  onChange={(e) => setEditingFile(prev => prev ? { ...prev, description: e.target.value } : null)}
                />
              </div>

              <div>
                <Label htmlFor="editContent">Content</Label>
                <Textarea
                  id="editContent"
                  value={editingFile.content}
                  onChange={(e) => setEditingFile(prev => prev ? { ...prev, content: e.target.value } : null)}
                  className="min-h-[200px] font-mono"
                />
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="editContextEnabled"
                  checked={editingFile.isContextEnabled}
                  onCheckedChange={(checked) => 
                    setEditingFile(prev => prev ? { ...prev, isContextEnabled: checked } : null)
                  }
                />
                <Label htmlFor="editContextEnabled" className="flex items-center gap-2">
                  <Brain className="w-4 h-4" />
                  Enable AI Context Integration
                </Label>
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setShowEditDialog(false)}>
                  Cancel
                </Button>
                <Button 
                  onClick={handleUpdateFile}
                  disabled={updateFile.isPending}
                >
                  {updateFile.isPending ? 'Updating...' : 'Update File'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}