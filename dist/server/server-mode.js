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
    // Validate context initialization
    if (!context) {
        throw new Error('CLI context is required for server mode');
    }
    if (!context.modelClient) {
        throw new Error('Model client not initialized');
    }
    if (!context.voiceSystem) {
        throw new Error('Voice system not initialized');
    }
    if (!context.config) {
        throw new Error('Configuration not loaded');
    }
    console.log(chalk.blue('🚀 Starting CodeCrucible Server Mode...'));
    // Initialize context components if needed
    try {
        await context.modelClient.initialize();
        logger.info('Model client initialized for server mode');
    }
    catch (error) {
        logger.warn('Model client initialization warning:', error);
    }
    const app = express();
    const server = createServer(app);
    const io = new SocketIOServer(server, {
        cors: options.cors ? { origin: '*' } : undefined
    });
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
                endpoint: context.config.model?.endpoint || 'http://localhost:11434',
                name: context.config.model?.name || 'llama2'
            }
        });
    });
    // Model status endpoint
    app.get('/api/model/status', async (req, res) => {
        try {
            const healthCheck = await context.modelClient.healthCheck();
            const isAvailable = Object.values(healthCheck).some(status => status);
            res.json({
                available: isAvailable,
                endpoint: context.config.model?.endpoint || 'http://localhost:11434',
                model: context.config.model?.name || 'llama2'
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
            available: context.config.voices?.available || ['explorer', 'maintainer', 'analyzer', 'developer', 'implementor', 'security', 'architect', 'designer', 'optimizer'],
            default: context.config.voices?.default || ['explorer', 'maintainer'],
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
            const { prompt, voices = context.config.voices?.default || ['explorer', 'maintainer'], mode = 'competitive', context: userContext = [], language: _language, file_path: _file_path } = req.body;
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
            const synthesis = await context.voiceSystem.synthesize(prompt, voices, mode, context.modelClient);
            res.json({
                success: true,
                result: {
                    code: synthesis.combinedCode || synthesis.content,
                    reasoning: synthesis.reasoning || 'No reasoning provided',
                    confidence: synthesis.confidence || 0.8,
                    quality_score: synthesis.qualityScore,
                    voices_used: synthesis.voicesUsed
                },
                individual_responses: (synthesis.responses || []).map(r => ({
                    voice: r.voice,
                    content: r.content,
                    confidence: r.confidence,
                    tokens_used: (r.tokens_used || 0)
                })),
                metadata: {
                    timestamp: Date.now(),
                    model: context.config.model?.name || 'llama2',
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
            const analysis = await context.modelClient.processRequest({
                prompt: `Analyze this ${language} code for quality, issues, and improvements:\n\n${code}`,
                temperature: 0.7
            });
            // Calculate quality score based on analysis content
            const qualityScore = calculateQualityScore(analysis.content);
            const recommendations = extractRecommendations(analysis.content);
            res.json({
                success: true,
                analysis: {
                    content: analysis.content,
                    quality_score: qualityScore,
                    recommendations: recommendations,
                    timestamp: new Date().toISOString()
                },
                metadata: {
                    file_path,
                    language,
                    code_length: code.length,
                    model: context.config.model?.name || 'llama2'
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
                    // Define the voice archetype for refactoring
                    const voice = {
                        id: 'refactoring-specialist',
                        name: 'Refactoring Specialist',
                        systemPrompt: 'You are a senior software engineer specializing in code refactoring. You excel at improving code structure, readability, and maintainability while preserving functionality. You provide clean, well-documented refactored code with clear explanations of changes made.',
                        temperature: 0.4,
                        style: 'methodical'
                    };
                    const refactorPrompt = `You are an expert ${language} developer specializing in code refactoring. Your task is to refactor the provided code based on the specific request: "${prompt}"

**Refactoring Context:**
- Language: ${language}
- File: ${file_path}
- Specific Request: ${prompt}

**Original Code:**
\`\`\`${language}
${originalContent}
\`\`\`

**Refactoring Guidelines:**
1. **Preserve Functionality** - Ensure all existing behavior is maintained
2. **Address the Request** - Specifically implement the requested changes
3. **Improve Code Quality** - Apply best practices and modern ${language} patterns
4. **Maintain API Compatibility** - Keep public interfaces unchanged unless specifically requested
5. **Add Documentation** - Include comments explaining significant changes

**Required Output:**
1. **Refactored Code** - Complete, working code in proper ${language} syntax
2. **Change Summary** - Brief explanation of what was modified and why
3. **Testing Notes** - Any testing considerations for the changes

Focus on delivering production-ready code that addresses the specific refactoring request while improving overall code quality.`;
                    const response = await context.modelClient.processRequest({
                        prompt: `${voice.systemPrompt}

${refactorPrompt}`,
                        temperature: voice.temperature
                    }, {
                        files: [{
                                path: file_path,
                                content: originalContent,
                                type: language,
                                language
                            }],
                        workingDirectory: context.config.workingDirectory || process.cwd(),
                        config: {},
                        structure: { directories: [], fileTypes: {} }
                    });
                    // Extract code from response
                    const codeMatch = response.content.match(/```[\w]*\n([\s\S]*?)\n```/);
                    const refactoredCode = codeMatch ? codeMatch[1] : response.content;
                    res.json({
                        success: true,
                        original_code: originalContent,
                        refactored_code: refactoredCode,
                        explanation: response.content.replace(/```[\s\S]*?```/g, '').trim(),
                        confidence: response.confidence || 0.8
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
            voices: context.config.voices?.available || ['explorer', 'maintainer', 'analyzer', 'developer', 'implementor', 'security', 'architect', 'designer', 'optimizer']
        });
        // Handle real-time code generation
        socket.on('generate_realtime', async (data) => {
            try {
                const { prompt, voices, mode, context: _userContext } = data;
                socket.emit('generation_started', { id: data.id });
                const synthesis = await context.voiceSystem.synthesize(prompt, voices || context.config.voices?.default || ['explorer', 'maintainer'], (mode || 'collaborative'), context.modelClient);
                socket.emit('generation_complete', {
                    id: data.id,
                    success: true,
                    result: synthesis,
                    responses: synthesis.responses || []
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
/**
 * Calculate quality score based on analysis content
 */
function calculateQualityScore(analysisContent) {
    let score = 0.5; // Base score
    // Positive indicators
    if (analysisContent.includes('good') || analysisContent.includes('well-written') || analysisContent.includes('excellent')) {
        score += 0.2;
    }
    if (analysisContent.includes('clean') || analysisContent.includes('readable') || analysisContent.includes('maintainable')) {
        score += 0.15;
    }
    if (analysisContent.includes('optimized') || analysisContent.includes('efficient')) {
        score += 0.1;
    }
    // Negative indicators
    if (analysisContent.includes('issues') || analysisContent.includes('problems') || analysisContent.includes('bugs')) {
        score -= 0.2;
    }
    if (analysisContent.includes('improve') || analysisContent.includes('fix') || analysisContent.includes('refactor')) {
        score -= 0.1;
    }
    if (analysisContent.includes('complex') || analysisContent.includes('difficult')) {
        score -= 0.05;
    }
    // Ensure score is between 0 and 1
    return Math.max(0, Math.min(1, score));
}
/**
 * Extract recommendations from analysis content
 */
function extractRecommendations(analysisContent) {
    const recommendations = [];
    // Split into sentences and look for recommendation patterns
    const sentences = analysisContent.split(/[.!?]+/).map(s => s.trim()).filter(s => s.length > 0);
    for (const sentence of sentences) {
        const lowerSentence = sentence.toLowerCase();
        // Look for recommendation patterns
        if (lowerSentence.includes('should') ||
            lowerSentence.includes('could') ||
            lowerSentence.includes('consider') ||
            lowerSentence.includes('recommend') ||
            lowerSentence.includes('suggest') ||
            lowerSentence.includes('improve') ||
            lowerSentence.includes('add') ||
            lowerSentence.includes('use') ||
            lowerSentence.includes('implement')) {
            // Clean up the sentence
            const recommendation = sentence.trim();
            if (recommendation.length > 10 && recommendation.length < 200) {
                recommendations.push(recommendation);
            }
        }
    }
    return recommendations.slice(0, 5); // Return top 5 recommendations
}
//# sourceMappingURL=server-mode.js.map