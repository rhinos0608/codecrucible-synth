import { useState, useRef, useCallback } from 'react';
import { Upload, File, X, Paperclip, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useFileUpload } from '@/hooks/useFileUpload';
import type { UserFile } from '@shared/schema';

interface FileUploadAreaProps {
  projectId?: number;
  sessionId?: number;
  onFileUploaded?: (file: UserFile) => void;
  onFilesAttached?: (files: UserFile[]) => void;
  className?: string;
  variant?: 'dropzone' | 'button' | 'compact';
  maxFiles?: number;
  showAttachedFiles?: boolean;
  attachedFiles?: UserFile[];
}

export function FileUploadArea({
  projectId,
  sessionId,
  onFileUploaded,
  onFilesAttached,
  className = '',
  variant = 'dropzone',
  maxFiles = 5,
  showAttachedFiles = false,
  attachedFiles = []
}: FileUploadAreaProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const { processAndUploadFile, isUploading } = useFileUpload();

  // Handle drag and drop events
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    const droppedFiles = Array.from(e.dataTransfer.files);
    handleFileSelection(droppedFiles);
  }, []);

  // Handle file selection from input or drag & drop
  const handleFileSelection = (files: File[]) => {
    const validFiles = files.slice(0, maxFiles);
    setSelectedFiles(validFiles);
  };

  // Handle file input change
  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      handleFileSelection(Array.from(e.target.files));
    }
  };

  // Upload selected files
  const uploadFiles = async () => {
    if (selectedFiles.length === 0) return;

    const uploadedFiles: UserFile[] = [];
    
    try {
      for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i];
        setUploadProgress(((i + 1) / selectedFiles.length) * 100);
        
        const uploadedFile = await processAndUploadFile(file, {
          projectId,
          sessionId
        });
        
        uploadedFiles.push(uploadedFile);
        
        if (onFileUploaded) {
          onFileUploaded(uploadedFile);
        }
      }
      
      if (onFilesAttached && uploadedFiles.length > 0) {
        onFilesAttached(uploadedFiles);
      }
      
      // Reset state
      setSelectedFiles([]);
      setUploadProgress(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      
    } catch (error) {
      console.error('Upload failed:', error);
      setUploadProgress(null);
    }
  };

  // Remove selected file
  const removeSelectedFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  // Get file size in readable format
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Render dropzone variant
  if (variant === 'dropzone') {
    return (
      <div className={`space-y-4 ${className}`}>
        <div
          className={`
            border-2 border-dashed rounded-lg p-6 text-center transition-colors
            ${isDragOver 
              ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/20' 
              : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
            }
            ${isUploading ? 'opacity-50 pointer-events-none' : 'cursor-pointer'}
          `}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <Upload className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-500 mb-4" />
          <p className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
            Drop files here or click to browse
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Supports code files up to 10MB each (max {maxFiles} files)
          </p>
          
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={handleFileInputChange}
            accept=".txt,.js,.jsx,.ts,.tsx,.json,.html,.css,.scss,.md,.py,.java,.cpp,.c,.cs,.php,.rb,.go,.rs,.kt,.swift,.xml,.yaml,.yml,.log,.sql,.sh,.bat"
          />
        </div>

        {selectedFiles.length > 0 && (
          <div className="space-y-2">
            <h4 className="font-medium text-gray-900 dark:text-gray-100">
              Selected Files ({selectedFiles.length})
            </h4>
            {selectedFiles.map((file, index) => (
              <div key={index} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <div className="flex items-center space-x-3">
                  <File className="h-5 w-5 text-gray-500" />
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      {file.name}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {formatFileSize(file.size)}
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeSelectedFile(index)}
                  disabled={isUploading}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
            
            <div className="flex space-x-2">
              <Button
                onClick={uploadFiles}
                disabled={isUploading || selectedFiles.length === 0}
                className="flex-1"
              >
                {isUploading ? 'Uploading...' : `Upload ${selectedFiles.length} file${selectedFiles.length === 1 ? '' : 's'}`}
              </Button>
              <Button
                variant="outline"
                onClick={() => setSelectedFiles([])}
                disabled={isUploading}
              >
                Clear
              </Button>
            </div>
            
            {uploadProgress !== null && (
              <Progress value={uploadProgress} className="w-full" />
            )}
          </div>
        )}

        {showAttachedFiles && attachedFiles.length > 0 && (
          <div className="space-y-2">
            <h4 className="font-medium text-gray-900 dark:text-gray-100">
              Attached Files ({attachedFiles.length})
            </h4>
            {attachedFiles.map((file) => (
              <div key={file.id} className="flex items-center space-x-3 p-2 bg-green-50 dark:bg-green-950/20 rounded-lg">
                <Paperclip className="h-4 w-4 text-green-600" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                    {file.fileName}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {formatFileSize(file.fileSize)} • {file.language}
                  </p>
                </div>
                <Badge variant="secondary" className="text-xs">
                  Attached
                </Badge>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Render button variant
  if (variant === 'button') {
    return (
      <div className={`space-y-2 ${className}`}>
        <Button
          variant="outline"
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
          className="w-full"
        >
          <Upload className="h-4 w-4 mr-2" />
          {isUploading ? 'Uploading...' : 'Upload Files'}
        </Button>
        
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={handleFileInputChange}
          accept=".txt,.js,.jsx,.ts,.tsx,.json,.html,.css,.scss,.md,.py,.java,.cpp,.c,.cs,.php,.rb,.go,.rs,.kt,.swift,.xml,.yaml,.yml,.log,.sql,.sh,.bat"
        />
        
        {selectedFiles.length > 0 && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {selectedFiles.length} file{selectedFiles.length === 1 ? '' : 's'} selected. 
              <Button variant="link" className="p-0 ml-1 h-auto" onClick={uploadFiles}>
                Click here to upload
              </Button>
            </AlertDescription>
          </Alert>
        )}
      </div>
    );
  }

  // Render compact variant
  return (
    <div className={`inline-flex items-center space-x-2 ${className}`}>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => fileInputRef.current?.click()}
        disabled={isUploading}
      >
        <Paperclip className="h-4 w-4" />
      </Button>
      
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={handleFileInputChange}
        accept=".txt,.js,.jsx,.ts,.tsx,.json,.html,.css,.scss,.md,.py,.java,.cpp,.c,.cs,.php,.rb,.go,.rs,.kt,.swift,.xml,.yaml,.yml,.log,.sql,.sh,.bat"
      />
      
      {selectedFiles.length > 0 && (
        <Badge variant="secondary" className="text-xs">
          {selectedFiles.length} selected
        </Badge>
      )}
    </div>
  );
}