import express from 'express';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { logger } from '../core/logger.js';
import chalk from 'chalk';
import { readFile, writeFile, stat } from 'fs/promises';
import { join, extname } from 'path';
/**
 * Server Mode for IDE Integration
 *
 * Provides HTTP and WebSocket APIs for IDE extensions and external tools
 * Compatible with VS Code, JetBrains IDEs, and other development environments
 */
export async function startServerMode(context, options) {
    const app = express();
    const server = createServer(app);
    const io = new SocketIOServer(server, {
        cors: options.cors ? { origin: '*' } : undefined
    });
    console.log(chalk.blue('🚀 Starting CodeCrucible Server Mode...'));
    // Middleware
    app.use(express.json({ limit: '50mb' }));
    app.use(express.urlencoded({ extended: true }));
    if (options.cors) {
        app.use((req, res, next) => {
            res.header('Access-Control-Allow-Origin', '*');
            res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS');
            res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Content-Length, X-Requested-With');
            if (req.method === 'OPTIONS') {
                res.sendStatus(200);
            }
            else {
                next();
            }
        });
    }
    // Authentication middleware
    if (options.auth?.enabled) {
        app.use((req, res, next) => {
            const token = req.headers.authorization?.replace('Bearer ', '');
            if (token !== options.auth.token) {
                return res.status(401).json({ error: 'Unauthorized' });
            }
            next();
        });
    }
    // Health check endpoint
    app.get('/health', (req, res) => {
        res.json({
            status: 'healthy',
            version: '2.0.0',
            timestamp: Date.now(),
            model: {
                endpoint: context.config.model.endpoint,
                name: context.config.model.name
            }
        });
    });
    // Model status endpoint
    app.get('/api/model/status', async (req, res) => {
        try {
            const isAvailable = await context.modelClient.checkConnection();
            res.json({
                available: isAvailable,
                endpoint: context.config.model.endpoint,
                model: context.config.model.name
            });
        }
        catch (error) {
            res.status(500).json({
                error: 'Model status check failed',
                available: false
            });
        }
    });
    // Voice information endpoint
    app.get('/api/voices', (req, res) => {
        res.json({
            available: context.config.voices.available,
            default: context.config.voices.default,
            descriptions: {
                explorer: 'Innovation and creative solutions',
                maintainer: 'Stability and long-term maintenance',
                analyzer: 'Performance and architectural insights',
                developer: 'Developer experience and usability',
                implementor: 'Practical implementation and delivery',
                security: 'Secure coding practices',
                architect: 'Scalable architecture and design',
                designer: 'UI/UX and interface design',
                optimizer: 'Performance optimization'
            }
        });
    });
    // Code generation endpoint
    app.post('/api/generate', async (req, res) => {
        try {
            const { prompt, voices = context.config.voices.default, mode = 'competitive', context: userContext = [], language, file_path } = req.body;
            if (!prompt) {
                return res.status(400).json({ error: 'Prompt is required' });
            }
            logger.info('Code generation request', {
                prompt: prompt.substring(0, 100),
                voices,
                mode,
                contextFiles: userContext.length
            });
            // Generate responses from selected voices
            const responses = await context.voiceSystem.generateMultiVoiceSolutions(prompt, voices, {
                files: userContext.map((ctx) => ({
                    path: ctx.path || file_path || 'untitled',
                    content: ctx.content || '',
                    language: ctx.language || language || 'text'
                }))
            });
            // Synthesize responses
            const synthesis = await context.voiceSystem.synthesizeVoiceResponses(responses, mode);
            res.json({
                success: true,
                result: {
                    code: synthesis.combinedCode,
                    reasoning: synthesis.reasoning,
                    confidence: synthesis.confidence,
                    quality_score: synthesis.qualityScore,
                    voices_used: synthesis.voicesUsed
                },
                individual_responses: responses.map(r => ({
                    voice: r.voice,
                    content: r.content,
                    confidence: r.confidence,
                    tokens_used: r.tokens_used
                })),
                metadata: {
                    timestamp: Date.now(),
                    model: context.config.model.name,
                    mode,
                    voices
                }
            });
        }
        catch (error) {
            logger.error('Code generation failed:', error);
            res.status(500).json({
                success: false,
                error: error instanceof Error ? error.message : 'Generation failed'
            });
        }
    });
    // Code analysis endpoint
    app.post('/api/analyze', async (req, res) => {
        try {
            const { code, language = 'text', file_path } = req.body;
            if (!code) {
                return res.status(400).json({ error: 'Code is required' });
            }
            const analysis = await context.modelClient.analyzeCode(code, language);
            res.json({
                success: true,
                analysis: {
                    content: analysis.analysis,
                    quality_score: analysis.qualityScore,
                    recommendations: analysis.recommendations,
                    timestamp: analysis.timestamp
                },
                metadata: {
                    file_path,
                    language,
                    code_length: code.length,
                    model: context.config.model.name
                }
            });
        }
        catch (error) {
            logger.error('Code analysis failed:', error);
            res.status(500).json({
                success: false,
                error: error instanceof Error ? error.message : 'Analysis failed'
            });
        }
    });
    // File operations endpoint
    app.post('/api/file/:operation', async (req, res) => {
        try {
            const { operation } = req.params;
            const { file_path, content, prompt } = req.body;
            switch (operation) {
                case 'read':
                    if (!file_path) {
                        return res.status(400).json({ error: 'file_path is required' });
                    }
                    try {
                        const fileContent = await readFile(file_path, 'utf8');
                        const stats = await stat(file_path);
                        res.json({
                            success: true,
                            content: fileContent,
                            metadata: {
                                size: stats.size,
                                modified: stats.mtime,
                                language: detectLanguage(extname(file_path))
                            }
                        });
                    }
                    catch (error) {
                        res.status(404).json({
                            success: false,
                            error: 'File not found'
                        });
                    }
                    break;
                case 'write':
                    if (!file_path || content === undefined) {
                        return res.status(400).json({ error: 'file_path and content are required' });
                    }
                    await writeFile(file_path, content, 'utf8');
                    res.json({
                        success: true,
                        message: `File written to ${file_path}`
                    });
                    break;
                case 'refactor':
                    if (!file_path || !prompt) {
                        return res.status(400).json({ error: 'file_path and prompt are required' });
                    }
                    const originalContent = await readFile(file_path, 'utf8');
                    const language = detectLanguage(extname(file_path));
                    const refactorPrompt = `Refactor this ${language} code based on the request: "${prompt}"

Current code:
\`\`\`${language}
${originalContent}
\`\`\`

Provide the complete refactored code.`;
                    const response = await context.modelClient.generateVoiceResponse({
                        id: 'maintainer',
                        name: 'Maintainer',
                        systemPrompt: 'You are a code refactoring specialist. Provide clean, maintainable code.',
                        temperature: 0.5,
                        style: 'conservative'
                    }, refactorPrompt, {
                        files: [{
                                path: file_path,
                                content: originalContent,
                                language
                            }]
                    });
                    // Extract code from response
                    const codeMatch = response.content.match(/```[\w]*\n([\s\S]*?)\n```/);
                    const refactoredCode = codeMatch ? codeMatch[1] : response.content;
                    res.json({
                        success: true,
                        original_code: originalContent,
                        refactored_code: refactoredCode,
                        explanation: response.content.replace(/```[\s\S]*?```/g, '').trim(),
                        confidence: response.confidence
                    });
                    break;
                default:
                    res.status(400).json({ error: `Unknown operation: ${operation}` });
            }
        }
        catch (error) {
            logger.error(`File operation ${req.params.operation} failed:`, error);
            res.status(500).json({
                success: false,
                error: error instanceof Error ? error.message : 'Operation failed'
            });
        }
    });
    // Project scanning endpoint
    app.post('/api/project/scan', async (req, res) => {
        try {
            const { directory = process.cwd(), pattern = '**/*.{js,ts,jsx,tsx,py}' } = req.body;
            const { glob } = await import('glob');
            const files = await glob(pattern, {
                cwd: directory,
                ignore: ['node_modules/**', '.git/**', 'dist/**', 'build/**']
            });
            const projectStructure = await Promise.all(files.slice(0, 50).map(async (file) => {
                try {
                    const fullPath = join(directory, file);
                    const stats = await stat(fullPath);
                    return {
                        path: file,
                        full_path: fullPath,
                        size: stats.size,
                        modified: stats.mtime,
                        language: detectLanguage(extname(file))
                    };
                }
                catch (error) {
                    return null;
                }
            }));
            res.json({
                success: true,
                directory,
                files: projectStructure.filter(Boolean),
                total_files: files.length,
                scanned_files: projectStructure.filter(Boolean).length
            });
        }
        catch (error) {
            logger.error('Project scan failed:', error);
            res.status(500).json({
                success: false,
                error: error instanceof Error ? error.message : 'Scan failed'
            });
        }
    });
    // Configuration endpoints
    app.get('/api/config', (req, res) => {
        res.json(context.config);
    });
    app.post('/api/config', async (req, res) => {
        try {
            const { key, value } = req.body;
            if (!key) {
                return res.status(400).json({ error: 'Key is required' });
            }
            const { ConfigManager } = await import('../config/config-manager.js');
            const configManager = await ConfigManager.getInstance();
            await configManager.set(key, value);
            res.json({
                success: true,
                message: `Configuration updated: ${key}`
            });
        }
        catch (error) {
            res.status(500).json({
                success: false,
                error: error instanceof Error ? error.message : 'Config update failed'
            });
        }
    });
    // WebSocket handling for real-time communication
    io.on('connection', (socket) => {
        console.log(chalk.gray(`🔌 IDE client connected: ${socket.id}`));
        // Send initial status
        socket.emit('status', {
            connected: true,
            model_available: true, // Will be updated by actual check
            voices: context.config.voices.available
        });
        // Handle real-time code generation
        socket.on('generate_realtime', async (data) => {
            try {
                const { prompt, voices, mode, context: userContext } = data;
                socket.emit('generation_started', { id: data.id });
                const responses = await context.voiceSystem.generateMultiVoiceSolutions(prompt, voices || context.config.voices.default, { files: userContext || [] });
                const synthesis = await context.voiceSystem.synthesizeVoiceResponses(responses, mode || 'competitive');
                socket.emit('generation_complete', {
                    id: data.id,
                    success: true,
                    result: synthesis,
                    responses
                });
            }
            catch (error) {
                socket.emit('generation_complete', {
                    id: data.id,
                    success: false,
                    error: error instanceof Error ? error.message : 'Generation failed'
                });
            }
        });
        // Handle file watching requests
        socket.on('watch_file', (data) => {
            const { file_path } = data;
            // Implement file watching logic here
            console.log(chalk.gray(`👀 Watching file: ${file_path}`));
        });
        socket.on('disconnect', () => {
            console.log(chalk.gray(`🔌 IDE client disconnected: ${socket.id}`));
        });
    });
    // Start server
    return new Promise((resolve) => {
        server.listen(options.port, options.host, () => {
            console.log(chalk.green(`✅ Server running on http://${options.host}:${options.port}`));
            console.log(chalk.gray('   Available endpoints:'));
            console.log(chalk.gray('   • GET  /health'));
            console.log(chalk.gray('   • GET  /api/model/status'));
            console.log(chalk.gray('   • GET  /api/voices'));
            console.log(chalk.gray('   • POST /api/generate'));
            console.log(chalk.gray('   • POST /api/analyze'));
            console.log(chalk.gray('   • POST /api/file/:operation'));
            console.log(chalk.gray('   • POST /api/project/scan'));
            console.log(chalk.gray('   • WebSocket support for real-time communication'));
            logger.info('Server mode started', {
                host: options.host,
                port: options.port,
                cors: options.cors,
                auth: options.auth?.enabled
            });
            resolve();
        });
    });
}
/**
 * Detect programming language from file extension
 */
function detectLanguage(ext) {
    const langMap = {
        '.js': 'javascript',
        '.ts': 'typescript',
        '.jsx': 'jsx',
        '.tsx': 'tsx',
        '.py': 'python',
        '.java': 'java',
        '.cpp': 'cpp',
        '.c': 'c',
        '.h': 'c',
        '.cs': 'csharp',
        '.php': 'php',
        '.rb': 'ruby',
        '.go': 'go',
        '.rs': 'rust',
        '.html': 'html',
        '.css': 'css',
        '.scss': 'scss',
        '.vue': 'vue',
        '.svelte': 'svelte'
    };
    return langMap[ext.toLowerCase()] || 'text';
}
//# sourceMappingURL=server-mode.js.map