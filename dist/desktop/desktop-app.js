import electron from 'electron';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createServer } from 'http';
import express from 'express';
import { Server as SocketIOServer } from 'socket.io';
import { logger } from '../core/logger.js';
import chalk from 'chalk';
// Fix for __dirname in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const { app, BrowserWindow, ipcMain, Menu, dialog } = electron;
let mainWindow = null;
let backendServer = null;
/**
 * Start the desktop application
 */
export async function startDesktopApp(context, options) {
    console.log(chalk.blue('🖥️  Initializing CodeCrucible Desktop...'));
    // Start backend server
    await startBackendServer(context, options.port);
    // Initialize Electron
    await initializeElectron(options);
    console.log(chalk.green('✅ Desktop application started'));
}
/**
 * Start the backend Express server
 */
async function startBackendServer(context, port) {
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
        res.send(getDesktopHTML());
    });
    // API endpoints
    app.post('/api/generate', async (req, res) => {
        try {
            const { prompt, voices, mode } = req.body;
            const voiceList = voices || context.config.voices.default;
            const responses = await context.voiceSystem.generateMultiVoiceSolutions(prompt, voiceList, { files: [] });
            const synthesis = await context.voiceSystem.synthesizeVoiceResponses(responses, mode || 'competitive');
            res.json({
                success: true,
                result: synthesis,
                responses
            });
        }
        catch (error) {
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
        }
        catch (error) {
            res.status(500).json({ error: 'Status check failed' });
        }
    });
    // WebSocket handling
    io.on('connection', (socket) => {
        console.log(chalk.gray(`🔌 Desktop client connected: ${socket.id}`));
        socket.on('generate_code', async (data) => {
            try {
                const responses = await context.voiceSystem.generateMultiVoiceSolutions(data.prompt, data.voices || context.config.voices.default, { files: data.context || [] });
                const synthesis = await context.voiceSystem.synthesizeVoiceResponses(responses, data.mode || 'competitive');
                socket.emit('generation_complete', {
                    success: true,
                    result: synthesis,
                    responses
                });
            }
            catch (error) {
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
    // Start server
    return new Promise((resolve) => {
        backendServer = server.listen(port, () => {
            console.log(chalk.green(`🌐 Desktop backend running on http://localhost:${port}`));
            resolve();
        });
    });
}
/**
 * Initialize Electron application
 */
async function initializeElectron(options) {
    // Wait for Electron app to be ready
    await electron.app.whenReady();
    // Create main window
    createMainWindow(options);
    // Setup application menu
    setupApplicationMenu();
    // Handle app events
    electron.app.on('window-all-closed', () => {
        if (process.platform !== 'darwin') {
            electron.app.quit();
        }
    });
    electron.app.on('activate', () => {
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
function createMainWindow(options) {
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
            sandbox: false, // Keep false for preload script access
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
    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        electron.shell.openExternal(url);
        return { action: 'deny' };
    });
}
/**
 * Setup application menu
 */
function setupApplicationMenu() {
    const template = [
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
                        const result = await electron.dialog.showOpenDialog(mainWindow, {
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
                        electron.dialog.showMessageBox(mainWindow, {
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
                        electron.shell.openExternal('https://github.com/codecrucible/codecrucible-synth');
                    }
                }
            ]
        }
    ];
    // macOS specific menu adjustments
    if (process.platform === 'darwin') {
        template.unshift({
            label: electron.app.getName(),
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
function setupIpcHandlers() {
    ipcMain.handle('get-app-version', () => {
        return electron.app.getVersion();
    });
    ipcMain.handle('select-directory', async () => {
        const result = await electron.dialog.showOpenDialog(mainWindow, {
            properties: ['openDirectory']
        });
        return result.canceled ? null : result.filePaths[0];
    });
    ipcMain.handle('save-file', async (event, content, defaultPath) => {
        const result = await electron.dialog.showSaveDialog(mainWindow, {
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
/**
 * Generate desktop UI HTML
 */
function getDesktopHTML() {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'self' ws://localhost:* http://localhost:*; img-src 'self' data:; font-src 'self';">
    <title>CodeCrucible Synth</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: linear-gradient(135deg, #1e3c72 0%, #2a5298 100%);
            color: white;
            height: 100vh;
            overflow: hidden;
        }
        
        .app-container {
            display: flex;
            height: 100vh;
        }
        
        .sidebar {
            width: 280px;
            background: rgba(0, 0, 0, 0.3);
            padding: 20px;
            border-right: 1px solid rgba(255, 255, 255, 0.1);
        }
        
        .main-content {
            flex: 1;
            display: flex;
            flex-direction: column;
            padding: 20px;
        }
        
        .header {
            text-align: center;
            margin-bottom: 30px;
        }
        
        .logo {
            font-size: 28px;
            font-weight: bold;
            margin-bottom: 10px;
            background: linear-gradient(45deg, #ff6b6b, #4ecdc4);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
        }
        
        .subtitle {
            font-size: 14px;
            opacity: 0.8;
        }
        
        .prompt-section {
            flex: 1;
            display: flex;
            flex-direction: column;
            gap: 20px;
        }
        
        .prompt-input {
            width: 100%;
            height: 120px;
            padding: 15px;
            border: 1px solid rgba(255, 255, 255, 0.2);
            border-radius: 8px;
            background: rgba(255, 255, 255, 0.1);
            color: white;
            font-size: 14px;
            resize: vertical;
            backdrop-filter: blur(10px);
        }
        
        .prompt-input::placeholder {
            color: rgba(255, 255, 255, 0.6);
        }
        
        .controls {
            display: flex;
            gap: 15px;
            align-items: center;
            flex-wrap: wrap;
        }
        
        .voice-selector {
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
            margin-bottom: 15px;
        }
        
        .voice-chip {
            padding: 6px 12px;
            background: rgba(255, 255, 255, 0.1);
            border: 1px solid rgba(255, 255, 255, 0.2);
            border-radius: 20px;
            font-size: 12px;
            cursor: pointer;
            transition: all 0.2s;
        }
        
        .voice-chip:hover {
            background: rgba(255, 255, 255, 0.2);
        }
        
        .voice-chip.active {
            background: #4ecdc4;
            border-color: #4ecdc4;
        }
        
        .generate-btn {
            padding: 12px 30px;
            background: linear-gradient(45deg, #ff6b6b, #4ecdc4);
            border: none;
            border-radius: 6px;
            color: white;
            font-weight: bold;
            cursor: pointer;
            transition: transform 0.2s;
        }
        
        .generate-btn:hover {
            transform: translateY(-2px);
        }
        
        .generate-btn:disabled {
            opacity: 0.5;
            cursor: not-allowed;
            transform: none;
        }
        
        .mode-selector {
            display: flex;
            gap: 10px;
        }
        
        .mode-btn {
            padding: 8px 16px;
            background: rgba(255, 255, 255, 0.1);
            border: 1px solid rgba(255, 255, 255, 0.2);
            border-radius: 4px;
            color: white;
            cursor: pointer;
            transition: all 0.2s;
        }
        
        .mode-btn.active {
            background: rgba(255, 255, 255, 0.3);
        }
        
        .output-section {
            flex: 1;
            background: rgba(0, 0, 0, 0.3);
            border-radius: 8px;
            padding: 20px;
            overflow-y: auto;
            margin-top: 20px;
        }
        
        .loading {
            text-align: center;
            padding: 40px;
            opacity: 0.7;
        }
        
        .spinner {
            border: 3px solid rgba(255, 255, 255, 0.3);
            border-radius: 50%;
            border-top: 3px solid white;
            width: 30px;
            height: 30px;
            animation: spin 1s linear infinite;
            margin: 0 auto 15px;
        }
        
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
        
        .result {
            animation: fadeIn 0.5s ease-in;
        }
        
        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(20px); }
            to { opacity: 1; transform: translateY(0); }
        }
        
        .code-block {
            background: rgba(0, 0, 0, 0.5);
            padding: 15px;
            border-radius: 4px;
            margin: 10px 0;
            border-left: 3px solid #4ecdc4;
            font-family: 'Courier New', monospace;
            white-space: pre-wrap;
            overflow-x: auto;
        }
        
        .voice-response {
            margin: 15px 0;
            padding: 15px;
            background: rgba(255, 255, 255, 0.05);
            border-radius: 6px;
            border-left: 3px solid #ff6b6b;
        }
        
        .voice-name {
            font-weight: bold;
            color: #4ecdc4;
            margin-bottom: 8px;
        }
        
        .confidence {
            font-size: 12px;
            opacity: 0.7;
            margin-bottom: 8px;
        }
        
        .status-indicator {
            position: fixed;
            bottom: 20px;
            right: 20px;
            padding: 8px 16px;
            background: rgba(0, 0, 0, 0.7);
            border-radius: 20px;
            font-size: 12px;
            backdrop-filter: blur(10px);
        }
        
        .status-online {
            color: #4ecdc4;
        }
        
        .status-offline {
            color: #ff6b6b;
        }
    </style>
</head>
<body>
    <div class="app-container">
        <div class="sidebar">
            <div class="header">
                <div class="logo">CodeCrucible</div>
                <div class="subtitle">Multi-Voice AI Synthesis</div>
            </div>
            
            <div class="voice-selector" id="voiceSelector">
                <!-- Voices will be populated here -->
            </div>
            
            <div class="mode-selector">
                <div class="mode-btn active" data-mode="competitive">Competitive</div>
                <div class="mode-btn" data-mode="collaborative">Collaborative</div>
                <div class="mode-btn" data-mode="consensus">Consensus</div>
            </div>
        </div>
        
        <div class="main-content">
            <div class="prompt-section">
                <textarea 
                    class="prompt-input" 
                    id="promptInput"
                    placeholder="Describe what you want to build or ask for help with your code...\\n\\nExample: 'Create a React component for user authentication with form validation'"
                ></textarea>
                
                <div class="controls">
                    <button class="generate-btn" id="generateBtn">Generate</button>
                </div>
            </div>
            
            <div class="output-section" id="outputSection">
                <div style="text-align: center; opacity: 0.5; padding: 40px;">
                    <h3>Ready to Generate</h3>
                    <p>Enter your prompt above and select voices to get started</p>
                </div>
            </div>
        </div>
    </div>
    
    <div class="status-indicator" id="statusIndicator">
        <span class="status-offline">● Connecting...</span>
    </div>

    <script src="/socket.io/socket.io.js"></script>
    <script>
        const socket = io();
        let currentMode = 'competitive';
        let selectedVoices = [];
        let isGenerating = false;
        
        const promptInput = document.getElementById('promptInput');
        const generateBtn = document.getElementById('generateBtn');
        const outputSection = document.getElementById('outputSection');
        const statusIndicator = document.getElementById('statusIndicator');
        const voiceSelector = document.getElementById('voiceSelector');
        
        // Load available voices
        fetch('/api/voices')
            .then(res => res.json())
            .then(data => {
                selectedVoices = [...data.default];
                renderVoiceSelector(data.available);
            });
        
        // Check status
        fetch('/api/status')
            .then(res => res.json())
            .then(data => {
                if (data.model.available) {
                    statusIndicator.innerHTML = '<span class="status-online">● Model Ready</span>';
                } else {
                    statusIndicator.innerHTML = '<span class="status-offline">● Model Offline</span>';
                }
            })
            .catch(() => {
                statusIndicator.innerHTML = '<span class="status-offline">● Connection Error</span>';
            });
        
        function renderVoiceSelector(voices) {
            voiceSelector.innerHTML = voices.map(voice => 
                \`<div class="voice-chip \${selectedVoices.includes(voice) ? 'active' : ''}" data-voice="\${voice}">
                    \${voice}
                </div>\`
            ).join('');
            
            // Add click handlers
            document.querySelectorAll('.voice-chip').forEach(chip => {
                chip.addEventListener('click', () => {
                    const voice = chip.dataset.voice;
                    if (selectedVoices.includes(voice)) {
                        selectedVoices = selectedVoices.filter(v => v !== voice);
                        chip.classList.remove('active');
                    } else {
                        selectedVoices.push(voice);
                        chip.classList.add('active');
                    }
                });
            });
        }
        
        // Mode selection
        document.querySelectorAll('.mode-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                currentMode = btn.dataset.mode;
            });
        });
        
        // Generate button
        generateBtn.addEventListener('click', generateCode);
        
        // Enter key to generate
        promptInput.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.key === 'Enter') {
                generateCode();
            }
        });
        
        function generateCode() {
            const prompt = promptInput.value.trim();
            if (!prompt || isGenerating) return;
            
            if (selectedVoices.length === 0) {
                alert('Please select at least one voice');
                return;
            }
            
            isGenerating = true;
            generateBtn.disabled = true;
            generateBtn.textContent = 'Generating...';
            
            outputSection.innerHTML = \`
                <div class="loading">
                    <div class="spinner"></div>
                    <div>Consulting \${selectedVoices.join(', ')} in \${currentMode} mode...</div>
                </div>
            \`;
            
            socket.emit('generate_code', {
                prompt,
                voices: selectedVoices,
                mode: currentMode
            });
        }
        
        socket.on('generation_complete', (data) => {
            isGenerating = false;
            generateBtn.disabled = false;
            generateBtn.textContent = 'Generate';
            
            if (data.success) {
                displayResults(data.result, data.responses);
            } else {
                outputSection.innerHTML = \`
                    <div class="result">
                        <h3 style="color: #ff6b6b;">Generation Failed</h3>
                        <p>\${data.error}</p>
                    </div>
                \`;
            }
        });
        
        function displayResults(synthesis, responses) {
            let html = '<div class="result">';
            
            // Synthesis result
            html += \`
                <h3>🎉 Synthesis Result</h3>
                <div class="confidence">
                    Quality Score: \${synthesis.qualityScore}/100 | 
                    Confidence: \${Math.round(synthesis.confidence * 100)}% |
                    Voices: \${synthesis.voicesUsed.join(' + ')}
                </div>
            \`;
            
            if (synthesis.combinedCode) {
                html += \`<div class="code-block">\${escapeHtml(synthesis.combinedCode)}</div>\`;
            }
            
            if (synthesis.reasoning) {
                html += \`<p><strong>Reasoning:</strong> \${synthesis.reasoning}</p>\`;
            }
            
            // Individual voice responses
            html += '<h4>Voice Contributions:</h4>';
            responses.forEach(response => {
                html += \`
                    <div class="voice-response">
                        <div class="voice-name">\${response.voice}</div>
                        <div class="confidence">Confidence: \${Math.round(response.confidence * 100)}%</div>
                        <div>\${escapeHtml(response.content)}</div>
                    </div>
                \`;
            });
            
            html += '</div>';
            outputSection.innerHTML = html;
        }
        
        function escapeHtml(text) {
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        }
        
        // Handle menu actions from Electron
        if (window.electronAPI) {
            window.electronAPI.onMenuAction((action, data) => {
                switch (action) {
                    case 'quick-generate':
                        promptInput.focus();
                        break;
                    case 'voice-council':
                        // Select all voices
                        selectedVoices = Array.from(document.querySelectorAll('.voice-chip')).map(chip => chip.dataset.voice);
                        renderVoiceSelector(selectedVoices);
                        break;
                }
            });
        }
    </script>
</body>
</html>
  `;
}
//# sourceMappingURL=desktop-app.js.map