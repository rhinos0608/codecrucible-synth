import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { 
  FileText, 
  Code, 
  Plus, 
  Edit3, 
  Trash2, 
  Download, 
  Upload, 
  MessageSquare, 
  Brain,
  Tag,
  Copy,
  Check,
  Sparkles,
  FileCode,
  Settings
} from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { FolderFile, ProjectFolder } from "@shared/schema";
import { useAiChat } from '@/hooks/use-ai-chat';

interface FileManagerProps {
  isOpen: boolean;
  onClose: () => void;
  folder: ProjectFolder | null;
}

const SUPPORTED_LANGUAGES = [
  { value: "javascript", label: "JavaScript", icon: "🟨" },
  { value: "typescript", label: "TypeScript", icon: "🔷" },
  { value: "python", label: "Python", icon: "🐍" },
  { value: "html", label: "HTML", icon: "🌐" },
  { value: "css", label: "CSS", icon: "🎨" },
  { value: "json", label: "JSON", icon: "📄" },
  { value: "markdown", label: "Markdown", icon: "📝" },
  { value: "sql", label: "SQL", icon: "🗄️" },
  { value: "bash", label: "Bash", icon: "⚡" },
  { value: "text", label: "Plain Text", icon: "📄" }
];

const FILE_TYPES = [
  { value: "code", label: "Code File", icon: <Code className="h-4 w-4" /> },
  { value: "text", label: "Text File", icon: <FileText className="h-4 w-4" /> },
  { value: "config", label: "Configuration", icon: <Settings className="h-4 w-4" /> },
  { value: "documentation", label: "Documentation", icon: <FileCode className="h-4 w-4" /> }
];

export function FileManager({ isOpen, onClose, folder }: FileManagerProps) {
  const [selectedFile, setSelectedFile] = useState<FolderFile | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showAIChat, setShowAIChat] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [copiedFileId, setCopiedFileId] = useState<number | null>(null);
  
  // AI Chat state
  const [chatMessages, setChatMessages] = useState<Array<{role: 'user' | 'assistant', content: string}>>([]);
  const [currentQuestion, setCurrentQuestion] = useState('');
  
  const [newFile, setNewFile] = useState({
    name: "",
    content: "",
    fileType: "text",
    language: "text",
    description: "",
    tags: [] as string[],
    isContextEnabled: false
  });

  const { toast } = useToast();
  const queryClient = useQueryClient();
  const aiChatMutation = useAiChat();

  // Fetch folder files
  const { data: files = [], isLoading } = useQuery({
    queryKey: ["/api/folders", folder?.id, "files"],
    enabled: !!folder?.id && isOpen,
  });

  // Create file mutation
  const createFile = useMutation({
    mutationFn: async (fileData: typeof newFile) => {
      return apiRequest(`/api/folders/${folder?.id}/files`, {
        method: "POST",
        body: { ...fileData, folderId: folder?.id }
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/folders", folder?.id, "files"] });
      setShowCreateDialog(false);
      resetNewFile();
      toast({ description: "File created successfully" });
    },
    onError: (error: any) => {
      toast({ 
        variant: "destructive",
        description: error.message || "Failed to create file" 
      });
    }
  });

  // Update file mutation
  const updateFile = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<FolderFile> }) => {
      return apiRequest(`/api/files/${id}`, {
        method: "PUT",
        body: data
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/folders", folder?.id, "files"] });
      setShowEditDialog(false);
      setSelectedFile(null);
      toast({ description: "File updated successfully" });
    },
    onError: (error: any) => {
      toast({ 
        variant: "destructive",
        description: error.message || "Failed to update file" 
      });
    }
  });

  // Delete file mutation
  const deleteFile = useMutation({
    mutationFn: async (fileId: number) => {
      return apiRequest(`/api/files/${fileId}`, {
        method: "DELETE"
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/folders", folder?.id, "files"] });
      toast({ description: "File deleted successfully" });
    },
    onError: (error: any) => {
      toast({ 
        variant: "destructive",
        description: error.message || "Failed to delete file" 
      });
    }
  });

  // AI Chat mutation for file assistance
  const aiChat = useMutation({
    mutationFn: async ({ fileContent, prompt }: { fileContent: string; prompt: string }) => {
      return apiRequest("/api/ai/chat", {
        method: "POST",
        body: {
          messages: [
            {
              role: "system",
              content: "You are a coding assistant. Help analyze, improve, or answer questions about the provided code/text file."
            },
            {
              role: "user", 
              content: `File content:\n\n${fileContent}\n\nUser question: ${prompt}`
            }
          ],
          context: "file_analysis"
        }
      });
    },
    onSuccess: (response) => {
      // Display AI response in a dialog or inline
      console.log("AI Response:", response);
      toast({ 
        description: "AI analysis complete - check console for response",
        duration: 3000 
      });
    },
    onError: (error: any) => {
      toast({ 
        variant: "destructive",
        description: error.message || "AI chat failed" 
      });
    }
  });

  const resetNewFile = () => {
    setNewFile({
      name: "",
      content: "",
      fileType: "text",
      language: "text", 
      description: "",
      tags: [],
      isContextEnabled: false
    });
  };

  const handleCreateFile = () => {
    if (!newFile.name.trim() || !newFile.content.trim()) {
      toast({ 
        variant: "destructive",
        description: "Name and content are required" 
      });
      return;
    }
    createFile.mutate(newFile);
  };

  const handleUpdateFile = () => {
    if (!selectedFile) return;
    updateFile.mutate({ 
      id: selectedFile.id, 
      data: selectedFile 
    });
  };

  const handleCopyContent = async (content: string, fileId: number) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedFileId(fileId);
      setTimeout(() => setCopiedFileId(null), 2000);
      toast({ description: "File content copied to clipboard" });
    } catch (error) {
      toast({ 
        variant: "destructive",
        description: "Failed to copy content" 
      });
    }
  };

  const handleAIChat = () => {
    if (!selectedFile || !aiPrompt.trim()) {
      toast({ 
        variant: "destructive",
        description: "Please select a file and enter a prompt" 
      });
      return;
    }
    
    aiChat.mutate({
      fileContent: selectedFile.content,
      prompt: aiPrompt
    });
  };

  const getLanguageIcon = (language: string) => {
    const lang = SUPPORTED_LANGUAGES.find(l => l.value === language);
    return lang?.icon || "📄";
  };

  const getFileTypeIcon = (fileType: string) => {
    const type = FILE_TYPES.find(t => t.value === fileType);
    return type?.icon || <FileText className="h-4 w-4" />;
  };

  if (!folder) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            File Manager - {folder.name}
          </DialogTitle>
          <DialogDescription>
            Manage text files, code files, and AI chat functions for your project folder
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden">
          <Tabs defaultValue="files" className="h-full flex flex-col">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="files">File Browser</TabsTrigger>
              <TabsTrigger value="editor">File Editor</TabsTrigger>
              <TabsTrigger value="ai-chat">AI Assistant</TabsTrigger>
            </TabsList>

            <TabsContent value="files" className="flex-1 overflow-hidden">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold">Files ({files.length})</h3>
                <Button 
                  onClick={() => setShowCreateDialog(true)}
                  size="sm"
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  New File
                </Button>
              </div>

              <ScrollArea className="h-[500px]">
                <div className="grid gap-3">
                  {isLoading ? (
                    <div className="text-center py-8">
                      <div className="animate-pulse space-y-4">
                        {[1,2,3].map(i => (
                          <div key={i} className="h-16 bg-gray-200 dark:bg-gray-700 rounded" />
                        ))}
                      </div>
                    </div>
                  ) : files.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No files in this folder</p>
                      <p className="text-sm">Create your first file to get started</p>
                    </div>
                  ) : (
                    files.map((file: FolderFile) => (
                      <Card key={file.id} className="hover:shadow-md transition-shadow">
                        <CardHeader className="pb-2">
                          <div className="flex items-start justify-between">
                            <div className="flex items-center gap-2">
                              <span className="text-lg">{getLanguageIcon(file.language)}</span>
                              <div>
                                <CardTitle className="text-sm">{file.name}</CardTitle>
                                <div className="flex items-center gap-2 mt-1">
                                  <Badge variant="outline" className="text-xs">
                                    {getFileTypeIcon(file.fileType)}
                                    <span className="ml-1">{file.fileType}</span>
                                  </Badge>
                                  <Badge variant="outline" className="text-xs">
                                    {file.language}
                                  </Badge>
                                  {file.isContextEnabled && (
                                    <Badge variant="default" className="text-xs bg-purple-600">
                                      <Sparkles className="h-3 w-3 mr-1" />
                                      AI Context
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleCopyContent(file.content, file.id)}
                                className="h-8 w-8 p-0"
                              >
                                {copiedFileId === file.id ? (
                                  <Check className="h-3 w-3 text-green-600" />
                                ) : (
                                  <Copy className="h-3 w-3" />
                                )}
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setSelectedFile(file);
                                  setShowEditDialog(true);
                                }}
                                className="h-8 w-8 p-0"
                              >
                                <Edit3 className="h-3 w-3" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => deleteFile.mutate(file.id)}
                                className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        </CardHeader>
                        {file.description && (
                          <CardContent className="pt-0">
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                              {file.description}
                            </p>
                          </CardContent>
                        )}
                      </Card>
                    ))
                  )}
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="editor" className="flex-1 overflow-hidden">
              {selectedFile ? (
                <div className="h-full space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold">Editing: {selectedFile.name}</h3>
                    <Button 
                      onClick={handleUpdateFile}
                      disabled={updateFile.isPending}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      {updateFile.isPending ? "Saving..." : "Save Changes"}
                    </Button>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium">File Name</label>
                      <Input
                        value={selectedFile.name}
                        onChange={(e) => setSelectedFile({...selectedFile, name: e.target.value})}
                        placeholder="Enter file name"
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium">Language</label>
                      <Select 
                        value={selectedFile.language} 
                        onValueChange={(value) => setSelectedFile({...selectedFile, language: value})}
                      >
                        <SelectTrigger className="mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {SUPPORTED_LANGUAGES.map(lang => (
                            <SelectItem key={lang.value} value={lang.value}>
                              {lang.icon} {lang.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-medium">Content</label>
                    <Textarea
                      value={selectedFile.content}
                      onChange={(e) => setSelectedFile({...selectedFile, content: e.target.value})}
                      placeholder="Enter file content"
                      className="mt-1 h-64 font-mono text-sm"
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium">Description (Optional)</label>
                    <Input
                      value={selectedFile.description || ""}
                      onChange={(e) => setSelectedFile({...selectedFile, description: e.target.value})}
                      placeholder="Describe this file's purpose"
                      className="mt-1"
                    />
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center h-full text-gray-500">
                  <div className="text-center">
                    <Edit3 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Select a file from the browser to edit</p>
                  </div>
                </div>
              )}
            </TabsContent>

            <TabsContent value="ai-chat" className="flex-1 overflow-hidden">
              <div className="h-full space-y-4">
                <div className="flex items-center gap-2">
                  <Brain className="h-5 w-5 text-purple-600" />
                  <h3 className="text-lg font-semibold">AI File Assistant</h3>
                </div>

                {selectedFile ? (
                  <div className="space-y-4">
                    <div className="bg-blue-50 dark:bg-blue-950 p-4 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-lg">{getLanguageIcon(selectedFile.language)}</span>
                        <span className="font-medium">{selectedFile.name}</span>
                        <Badge variant="outline">{selectedFile.language}</Badge>
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {selectedFile.description || "No description"}
                      </p>
                    </div>

                    <div>
                      <label className="text-sm font-medium">Ask AI about this file:</label>
                      <Textarea
                        value={aiPrompt}
                        onChange={(e) => setAiPrompt(e.target.value)}
                        placeholder="Ask questions like: 'Explain this code', 'Find bugs', 'Optimize performance', 'Add comments', etc."
                        className="mt-1 h-32"
                      />
                    </div>

                    <Button 
                      onClick={handleAIChat}
                      disabled={aiChat.isPending || !aiPrompt.trim()}
                      className="w-full bg-purple-600 hover:bg-purple-700"
                    >
                      <MessageSquare className="h-4 w-4 mr-2" />
                      {aiChat.isPending ? "Analyzing..." : "Ask AI Assistant"}
                    </Button>

                    <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg">
                      <h4 className="font-medium mb-2">Quick AI Actions:</h4>
                      <div className="grid grid-cols-2 gap-2">
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => setAiPrompt("Explain what this code does")}
                        >
                          Explain Code
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => setAiPrompt("Find potential bugs or issues")}
                        >
                          Find Bugs
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => setAiPrompt("Suggest improvements and optimizations")}
                        >
                          Optimize
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => setAiPrompt("Add comprehensive comments")}
                        >
                          Add Comments
                        </Button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-full text-gray-500">
                    <div className="text-center">
                      <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>Select a file to start AI chat</p>
                      <p className="text-sm">Get help with code analysis, debugging, and improvements</p>
                    </div>
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </div>

        {/* Create File Dialog */}
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New File</DialogTitle>
              <DialogDescription>
                Add a new text or code file to the folder
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">File Name *</label>
                <Input
                  value={newFile.name}
                  onChange={(e) => setNewFile({...newFile, name: e.target.value})}
                  placeholder="example.js"
                  className="mt-1"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">File Type</label>
                  <Select 
                    value={newFile.fileType} 
                    onValueChange={(value) => setNewFile({...newFile, fileType: value})}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {FILE_TYPES.map(type => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.icon}
                          <span className="ml-2">{type.label}</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-sm font-medium">Language</label>
                  <Select 
                    value={newFile.language} 
                    onValueChange={(value) => setNewFile({...newFile, language: value})}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SUPPORTED_LANGUAGES.map(lang => (
                        <SelectItem key={lang.value} value={lang.value}>
                          {lang.icon} {lang.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium">Content *</label>
                <Textarea
                  value={newFile.content}
                  onChange={(e) => setNewFile({...newFile, content: e.target.value})}
                  placeholder="Enter file content..."
                  className="mt-1 h-32 font-mono text-sm"
                />
              </div>

              <div>
                <label className="text-sm font-medium">Description (Optional)</label>
                <Input
                  value={newFile.description}
                  onChange={(e) => setNewFile({...newFile, description: e.target.value})}
                  placeholder="Brief description of this file"
                  className="mt-1"
                />
              </div>

              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="context-enabled"
                  checked={newFile.isContextEnabled}
                  onChange={(e) => setNewFile({...newFile, isContextEnabled: e.target.checked})}
                  className="rounded"
                />
                <label htmlFor="context-enabled" className="text-sm">
                  Enable for AI context (Pro+ feature)
                </label>
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                  Cancel
                </Button>
                <Button 
                  onClick={handleCreateFile}
                  disabled={createFile.isPending}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  {createFile.isPending ? "Creating..." : "Create File"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </DialogContent>
    </Dialog>
  );
}