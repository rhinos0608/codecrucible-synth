import { useState } from 'react';
import { File, Trash2, Eye, Download, Paperclip, Search, Filter, X, Code } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useUserFiles, useDeleteFile, useAttachFileToSession } from '@/hooks/useFileUpload';
import { useToast } from '@/hooks/use-toast';
import type { UserFile } from '@shared/schema';

interface FileManagerProps {
  sessionId?: number;
  projectId?: number;
  onFileSelect?: (file: UserFile) => void;
  onFileAttach?: (file: UserFile) => void;
  selectionMode?: boolean;
  className?: string;
}

export function FileManager({
  sessionId,
  projectId,
  onFileSelect,
  onFileAttach,
  selectionMode = false,
  className = ''
}: FileManagerProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [languageFilter, setLanguageFilter] = useState<string>('all');
  const [viewingFile, setViewingFile] = useState<UserFile | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<Set<number>>(new Set());

  const { data: files = [], isLoading, error } = useUserFiles();
  const deleteFileMutation = useDeleteFile();
  const attachFileToSessionMutation = useAttachFileToSession();
  const { toast } = useToast();

  // Filter files based on search and language
  const filteredFiles = files.filter((file) => {
    const matchesSearch = file.fileName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         file.originalName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesLanguage = languageFilter === 'all' || file.language === languageFilter;
    const matchesProject = !projectId || file.projectId === projectId;
    
    return matchesSearch && matchesLanguage && matchesProject;
  });

  // Get unique languages from files
  const availableLanguages = Array.from(new Set(files.map(file => file.language)));

  // Handle file deletion
  const handleDeleteFile = async (fileId: number) => {
    try {
      await deleteFileMutation.mutateAsync(fileId);
    } catch (error) {
      console.error('Failed to delete file:', error);
    }
  };

  // Handle file attachment to session
  const handleAttachToSession = async (file: UserFile) => {
    if (!sessionId) return;
    
    try {
      await attachFileToSessionMutation.mutateAsync({
        sessionId,
        fileId: file.id,
        isContextEnabled: true
      });
      
      if (onFileAttach) {
        onFileAttach(file);
      }
    } catch (error) {
      console.error('Failed to attach file to session:', error);
    }
  };

  // Handle file selection (for multi-select mode)
  const handleFileSelection = (fileId: number) => {
    const newSelection = new Set(selectedFiles);
    if (newSelection.has(fileId)) {
      newSelection.delete(fileId);
    } else {
      newSelection.add(fileId);
    }
    setSelectedFiles(newSelection);
  };

  // Download file content
  const downloadFile = (file: UserFile) => {
    const blob = new Blob([file.content], { type: file.mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.originalName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Format file size
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Format date
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (isLoading) {
    return (
      <Card className={className}>
        <CardContent className="p-6">
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin h-6 w-6 border-2 border-blue-500 border-t-transparent rounded-full"></div>
            <span className="ml-2 text-gray-600 dark:text-gray-400">Loading files...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className={className}>
        <CardContent className="p-6">
          <div className="text-center py-8">
            <p className="text-red-600 dark:text-red-400">Failed to load files</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>File Manager</span>
            <Badge variant="secondary">{filteredFiles.length} files</Badge>
          </CardTitle>
          
          {/* Search and Filter */}
          <div className="flex space-x-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search files..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={languageFilter} onValueChange={setLanguageFilter}>
              <SelectTrigger className="w-[180px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Filter by language" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Languages</SelectItem>
                {availableLanguages.map((lang) => (
                  <SelectItem key={lang} value={lang}>
                    {lang.charAt(0).toUpperCase() + lang.slice(1)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <ScrollArea className="h-[400px]">
            {filteredFiles.length === 0 ? (
              <div className="text-center py-8 px-6">
                <File className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-500 mb-4" />
                <p className="text-gray-600 dark:text-gray-400">
                  {searchTerm || languageFilter !== 'all' 
                    ? 'No files match your search criteria' 
                    : 'No files uploaded yet'
                  }
                </p>
              </div>
            ) : (
              <div className="space-y-1 p-2">
                {filteredFiles.map((file) => (
                  <div
                    key={file.id}
                    className={`
                      flex items-center justify-between p-3 rounded-lg border transition-colors
                      ${selectionMode && selectedFiles.has(file.id)
                        ? 'bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800'
                        : 'hover:bg-gray-50 dark:hover:bg-gray-800 border-transparent'
                      }
                      ${selectionMode ? 'cursor-pointer' : ''}
                    `}
                    onClick={selectionMode ? () => handleFileSelection(file.id) : undefined}
                  >
                    <div className="flex items-center space-x-3 min-w-0 flex-1">
                      <div className="flex-shrink-0">
                        <Code className="h-5 w-5 text-gray-500" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                          {file.originalName}
                        </p>
                        <div className="flex items-center space-x-2 text-xs text-gray-500 dark:text-gray-400">
                          <span>{formatFileSize(file.fileSize)}</span>
                          <span>•</span>
                          <Badge variant="outline" className="text-xs">
                            {file.language}
                          </Badge>
                          <span>•</span>
                          <span>{formatDate(file.createdAt)}</span>
                          {file.usageCount > 0 && (
                            <>
                              <span>•</span>
                              <span>Used {file.usageCount} times</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {!selectionMode && (
                      <div className="flex items-center space-x-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setViewingFile(file)}
                          title="View file content"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => downloadFile(file)}
                          title="Download file"
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                        
                        {sessionId && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleAttachToSession(file)}
                            disabled={attachFileToSessionMutation.isPending}
                            title="Attach to current session"
                          >
                            <Paperclip className="h-4 w-4" />
                          </Button>
                        )}
                        
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteFile(file.id)}
                          disabled={deleteFileMutation.isPending}
                          title="Delete file"
                          className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>

      {/* File Content Viewer Dialog */}
      <Dialog open={!!viewingFile} onOpenChange={() => setViewingFile(null)}>
        <DialogContent className="max-w-4xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>{viewingFile?.originalName}</span>
              <div className="flex items-center space-x-2">
                <Badge variant="outline">{viewingFile?.language}</Badge>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => viewingFile && downloadFile(viewingFile)}
                >
                  <Download className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setViewingFile(null)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </DialogTitle>
            <DialogDescription>
              {viewingFile && `${formatFileSize(viewingFile.fileSize)} • Uploaded ${formatDate(viewingFile.createdAt)}`}
            </DialogDescription>
          </DialogHeader>
          
          <ScrollArea className="h-[60vh] w-full">
            <pre className="text-sm font-mono bg-gray-50 dark:bg-gray-900 p-4 rounded-lg overflow-x-auto">
              <code className="text-gray-800 dark:text-gray-200">
                {viewingFile?.content}
              </code>
            </pre>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </>
  );
}