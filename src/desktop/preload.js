const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // App version
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  
  // File system operations
  selectDirectory: () => ipcRenderer.invoke('select-directory'),
  saveFile: (content, defaultPath) => ipcRenderer.invoke('save-file', content, defaultPath),
  
  // Menu actions
  onMenuAction: (callback) => {
    const wrappedCallback = (event, action, data) => callback(action, data);
    ipcRenderer.on('menu-action', wrappedCallback);
    
    // Return cleanup function
    return () => {
      ipcRenderer.removeListener('menu-action', wrappedCallback);
    };
  },
  
  // Remove all listeners (cleanup)
  removeAllListeners: (channel) => {
    ipcRenderer.removeAllListeners(channel);
  }
});

// Security: Remove Node.js globals from renderer process
delete window.process;
delete window.Buffer;
delete window.global;
delete window.setImmediate;
delete window.clearImmediate;

console.log('CodeCrucible preload script loaded successfully');