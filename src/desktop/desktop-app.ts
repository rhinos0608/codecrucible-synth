import electron from 'electron';
const { app, BrowserWindow, ipcMain, Menu, dialog, shell } = electron;
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createServer } from 'http';
import express from 'express';
import { Server as SocketIOServer } from 'socket.io';
import { CLIContext } from '../core/cli.js';
import { logger } from '../core/logger.js';
import chalk from 'chalk';

// Fix for __dirname in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Removed - now using direct imports

export interface DesktopOptions {
  port: number;
  width?: number;
  height?: number;
  devMode?: boolean;
}

let mainWindow: electron.BrowserWindow | null = null;
let backendServer: any = null;

/**
 * Start the desktop application
 */
export async function startDesktopApp(context: CLIContext, options: DesktopOptions): Promise<void> {
  console.log(chalk.blue('🖥️  Initializing CodeCrucible Desktop...'));
  
  // Start backend server and get actual port used
  const actualPort = await startBackendServer(context, options.port);
  
  // Update options with actual port
  const updatedOptions = { ...options, port: actualPort };
  
  // Initialize Electron
  await initializeElectron(updatedOptions);
  
  console.log(chalk.green('✅ Desktop application started'));
}

/**
 * Start the backend Express server
 */
async function startBackendServer(context: CLIContext, port: number): Promise<number> {
  const app = express();
  const server = createServer(app);
  const io = new SocketIOServer(server, {
    cors: { 
      origin: ['http://localhost:3001', 'https://localhost:3001'],
      methods: ['GET', 'POST'],
      credentials: false
    }
  });
  
  // Middleware
  app.use(express.json({ limit: '10mb' }));
  app.use(express.static(join(__dirname, 'ui')));
  
  // Serve the desktop UI
  app.get('/', (req, res) => {
    res.sendFile(join(__dirname, 'ui', 'index.html'));
  });
  
  // API endpoints
  app.post('/api/generate', async (req, res) => {
    try {
      const { prompt, voices, mode } = req.body;
      
      const voiceList = voices || context.config.voices.default;
      const responses = await context.voiceSystem.generateMultiVoiceSolutions(
        prompt,
        voiceList,
        { files: [] }
      );
      
      const synthesis = await context.voiceSystem.synthesizeVoiceResponses(
        responses,
        mode || 'competitive'
      );
      
      res.json({
        success: true,
        result: synthesis,
        responses
      });
      
    } catch (error) {
      logger.error('Desktop API error:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });
  
  app.get('/api/voices', (req, res) => {
    res.json({
      available: context.config.voices.available,
      default: context.config.voices.default
    });
  });
  
  app.get('/api/status', async (req, res) => {
    try {
      const modelStatus = await context.modelClient.checkConnection();
      res.json({
        model: {
          available: modelStatus,
          endpoint: context.config.model.endpoint,
          name: context.config.model.name
        },
        voices: context.config.voices.available.length,
        uptime: process.uptime()
      });
    } catch (error) {
      res.status(500).json({ error: 'Status check failed' });
    }
  });
  
  // WebSocket handling
  io.on('connection', (socket) => {
    console.log(chalk.gray(`🔌 Desktop client connected: ${socket.id}`));
    
    socket.on('generate_code', async (data) => {
      try {
        const responses = await context.voiceSystem.generateMultiVoiceSolutions(
          data.prompt,
          data.voices || context.config.voices.default,
          { files: data.context || [] }
        );
        
        const synthesis = await context.voiceSystem.synthesizeVoiceResponses(
          responses,
          data.mode || 'competitive'
        );
        
        socket.emit('generation_complete', {
          success: true,
          result: synthesis,
          responses
        });
        
      } catch (error) {
        socket.emit('generation_complete', {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    });
    
    socket.on('disconnect', () => {
      console.log(chalk.gray(`🔌 Desktop client disconnected: ${socket.id}`));
    });
  });
  
  // Start server with port fallback
  return new Promise<number>((resolve, reject) => {
    const tryPort = (currentPort: number) => {
      const attempt = server.listen(currentPort, () => {
        console.log(chalk.green(`🌐 Desktop backend running on http://localhost:${currentPort}`));
        backendServer = attempt;
        resolve(currentPort);
      });
      
      attempt.on('error', (err: any) => {
        if (err.code === 'EADDRINUSE') {
          console.log(chalk.yellow(`⚠️  Port ${currentPort} is busy, trying ${currentPort + 1}...`));
          tryPort(currentPort + 1);
        } else {
          reject(err);
        }
      });
    };
    
    tryPort(port);
  });
}

/**
 * Initialize Electron application
 */
async function initializeElectron(options: DesktopOptions): Promise<void> {
  // Wait for Electron app to be ready
  await app.whenReady();
  
  // Create main window
  createMainWindow(options);
  
  // Setup application menu
  setupApplicationMenu();
  
  // Handle app events
  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });
  
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow(options);
    }
  });
  
  // Setup IPC handlers
  setupIpcHandlers();
}

/**
 * Create the main application window
 */
function createMainWindow(options: DesktopOptions): void {
  mainWindow = new BrowserWindow({
    width: options.width || 1200,
    height: options.height || 800,
    minWidth: 800,
    minHeight: 600,
    title: 'CodeCrucible Synth',
    icon: join(__dirname, 'assets', 'icon.png'), // Add app icon
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      allowRunningInsecureContent: false,
      experimentalFeatures: false,
      webSecurity: true,
      sandbox: true,
      preload: join(__dirname, 'preload.js')
    },
    titleBarStyle: 'default',
    autoHideMenuBar: false
  });
  
  // Load the desktop UI
  mainWindow.loadURL(`http://localhost:${options.port}`);
  
  // Open DevTools in development
  if (options.devMode) {
    mainWindow.webContents.openDevTools();
  }
  
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
  
  // Handle external links
  mainWindow.webContents.setWindowOpenHandler(({ url }: { url: string }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

/**
 * Setup application menu
 */
function setupApplicationMenu(): void {
  const template: any[] = [
    {
      label: 'File',
      submenu: [
        {
          label: 'New Project',
          accelerator: 'CmdOrCtrl+N',
          click: () => {
            // Handle new project
            mainWindow?.webContents.send('menu-action', 'new-project');
          }
        },
        {
          label: 'Open Project',
          accelerator: 'CmdOrCtrl+O',
          click: async () => {
            const result = await dialog.showOpenDialog(mainWindow!, {
              properties: ['openDirectory']
            });
            
            if (!result.canceled) {
              mainWindow?.webContents.send('menu-action', 'open-project', result.filePaths[0]);
            }
          }
        },
        { type: 'separator' },
        {
          label: 'Exit',
          accelerator: process.platform === 'darwin' ? 'Cmd+Q' : 'Ctrl+Q',
          click: () => {
            app.quit();
          }
        }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' }
      ]
    },
    {
      label: 'Generate',
      submenu: [
        {
          label: 'Quick Generate',
          accelerator: 'CmdOrCtrl+G',
          click: () => {
            mainWindow?.webContents.send('menu-action', 'quick-generate');
          }
        },
        {
          label: 'Voice Council',
          accelerator: 'CmdOrCtrl+Shift+G',
          click: () => {
            mainWindow?.webContents.send('menu-action', 'voice-council');
          }
        }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'About CodeCrucible Synth',
          click: () => {
            dialog.showMessageBox(mainWindow!, {
              type: 'info',
              title: 'About CodeCrucible Synth',
              message: 'CodeCrucible Synth v2.0.0',
              detail: 'Local AI-powered coding assistant with multi-voice synthesis\\n\\nBuilt with Electron, Node.js, and Ollama'
            });
          }
        },
        {
          label: 'Documentation',
          click: () => {
            shell.openExternal('https://github.com/codecrucible/codecrucible-synth');
          }
        }
      ]
    }
  ];
  
  // macOS specific menu adjustments
  if (process.platform === 'darwin') {
    template.unshift({
      label: app.getName(),
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' }
      ]
    });
  }
  
  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

/**
 * Setup IPC handlers for communication with renderer
 */
function setupIpcHandlers(): void {
  ipcMain.handle('get-app-version', () => {
    return app.getVersion();
  });
  
  ipcMain.handle('select-directory', async () => {
    const result = await dialog.showOpenDialog(mainWindow!, {
      properties: ['openDirectory']
    });
    
    return result.canceled ? null : result.filePaths[0];
  });
  
  ipcMain.handle('save-file', async (event, content: string, defaultPath?: string) => {
    const result = await dialog.showSaveDialog(mainWindow!, {
      defaultPath,
      filters: [
        { name: 'All Files', extensions: ['*'] },
        { name: 'TypeScript', extensions: ['ts'] },
        { name: 'JavaScript', extensions: ['js'] },
        { name: 'Text', extensions: ['txt'] }
      ]
    });
    
    if (!result.canceled && result.filePath) {
      const fs = await import('fs/promises');
      await fs.writeFile(result.filePath, content, 'utf8');
      return result.filePath;
    }
    
    return null;
  });
}

