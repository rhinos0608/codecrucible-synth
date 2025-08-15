import { contextBridge, ipcRenderer } from 'electron';

/**
 * Secure preload script for CodeCrucible Synth
 * 
 * This script safely exposes only necessary APIs from the main process
 * to the renderer process while maintaining security isolation.
 */

// Validate input to prevent injection attacks
function validateString(input: unknown): string {
  if (typeof input !== 'string') {
    throw new Error('Invalid input: expected string');
  }
  // Basic sanitization - remove null bytes and control characters
  return input.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
}

function validateFilePath(path: unknown): string {
  const validPath = validateString(path);
  // Prevent path traversal attempts
  if (validPath.includes('..') || validPath.includes('\0')) {
    throw new Error('Invalid file path');
  }
  return validPath;
}

// Define the API interface
interface ElectronAPI {
  // App information
  getAppVersion(): Promise<string>;
  
  // File operations (with validation)
  selectDirectory(): Promise<string | null>;
  saveFile(content: string, defaultPath?: string): Promise<string | null>;
  
  // Menu actions (secure communication)
  onMenuAction(callback: (action: string, data?: any) => void): () => void;
  
  // Application state
  isProduction(): boolean;
}

// Expose secure API to renderer
const electronAPI: ElectronAPI = {
  // App information
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  
  // File operations with validation
  selectDirectory: () => ipcRenderer.invoke('select-directory'),
  
  saveFile: (content: string, defaultPath?: string) => {
    const validContent = validateString(content);
    const validDefaultPath = defaultPath ? validateFilePath(defaultPath) : undefined;
    return ipcRenderer.invoke('save-file', validContent, validDefaultPath);
  },
  
  // Menu actions with secure event handling
  onMenuAction: (callback: (action: string, data?: any) => void) => {
    const wrappedCallback = (event: Electron.IpcRendererEvent, action: string, data?: any) => {
      // Validate action is a safe string
      const validAction = validateString(action);
      callback(validAction, data);
    };
    
    ipcRenderer.on('menu-action', wrappedCallback);
    
    // Return cleanup function
    return () => {
      ipcRenderer.removeListener('menu-action', wrappedCallback);
    };
  },
  
  // Application state
  isProduction: () => process.env.NODE_ENV === 'production'
};

// Context isolation: expose API safely
contextBridge.exposeInMainWorld('electronAPI', electronAPI);

// Log successful preload (only in development)
if (process.env.NODE_ENV !== 'production') {
  console.log('🔒 Secure preload script loaded successfully');
}

// Prevent access to Node.js APIs from renderer
delete (window as any).require;
delete (window as any).exports;
delete (window as any).module;

// Additional security: prevent access to electron internals
Object.freeze(electronAPI);