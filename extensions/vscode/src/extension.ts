// VS Code Extension - Main entry point for CodeCrucible multi-voice AI integration
// Following AI_INSTRUCTIONS.md security patterns and CodingPhilosophy.md consciousness principles

import * as vscode from 'vscode';
import { CouncilPanelProvider } from './providers/CouncilPanelProvider';
import { SolutionsViewProvider } from './providers/SolutionsViewProvider';
import { SynthesisViewProvider } from './providers/SynthesisViewProvider';
import { DecisionHistoryProvider } from './providers/DecisionHistoryProvider';
import { CodeCrucibleApi } from './services/CodeCrucibleApi';
import { AuthenticationService } from './services/AuthenticationService';
import { TelemetryService } from './services/TelemetryService';
import { ContextExtractor } from './utils/ContextExtractor';
import { VoiceRecommendationService } from './services/VoiceRecommendationService';

export function activate(context: vscode.ExtensionContext) {
    console.log('CodeCrucible extension is now active');

    // Initialize services
    const authService = new AuthenticationService(context);
    const apiService = new CodeCrucibleApi(authService);
    const telemetryService = new TelemetryService(context);
    const contextExtractor = new ContextExtractor();
    const voiceRecommendationService = new VoiceRecommendationService(apiService);

    // Initialize providers
    const councilPanelProvider = new CouncilPanelProvider(context, apiService, voiceRecommendationService);
    const solutionsViewProvider = new SolutionsViewProvider(context, apiService);
    const synthesisViewProvider = new SynthesisViewProvider(context, apiService);
    const decisionHistoryProvider = new DecisionHistoryProvider(context, apiService);

    // Register tree data providers
    vscode.window.registerTreeDataProvider('codecrucible.councilPanel', councilPanelProvider);
    vscode.window.registerTreeDataProvider('codecrucible.solutionsView', solutionsViewProvider);
    vscode.window.registerTreeDataProvider('codecrucible.synthesisView', synthesisViewProvider);
    vscode.window.registerTreeDataProvider('codecrucible.decisionHistory', decisionHistoryProvider);

    // Register commands
    registerCommands(context, apiService, authService, telemetryService, contextExtractor, voiceRecommendationService);

    // Set context for conditional views
    updateContexts(authService);

    // Listen for authentication changes
    authService.onAuthenticationChanged(() => {
        updateContexts(authService);
        councilPanelProvider.refresh();
        solutionsViewProvider.refresh();
        synthesisViewProvider.refresh();
        decisionHistoryProvider.refresh();
    });

    // Track activation
    telemetryService.track('extension.activated', {
        version: context.extension.packageJSON.version
    });
}

function registerCommands(
    context: vscode.ExtensionContext,
    apiService: CodeCrucibleApi,
    authService: AuthenticationService,
    telemetryService: TelemetryService,
    contextExtractor: ContextExtractor,
    voiceRecommendationService: VoiceRecommendationService
) {
    
    // Authentication command
    const authenticateCommand = vscode.commands.registerCommand('codecrucible.authenticate', async () => {
        try {
            await authService.authenticate();
            vscode.window.showInformationMessage('Successfully authenticated with CodeCrucible!');
            telemetryService.track('authentication.success');
        } catch (error) {
            vscode.window.showErrorMessage(`Authentication failed: ${error}`);
            telemetryService.track('authentication.failed', { error: String(error) });
        }
    });

    // Generate with Council command
    const generateCommand = vscode.commands.registerCommand('codecrucible.generateWithCouncil', async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showWarningMessage('No active editor found');
            return;
        }

        if (!authService.isAuthenticated()) {
            const result = await vscode.window.showWarningMessage(
                'Please authenticate with CodeCrucible first',
                'Authenticate'
            );
            if (result === 'Authenticate') {
                await vscode.commands.executeCommand('codecrucible.authenticate');
            }
            return;
        }

        try {
            // Show input box for prompt
            const prompt = await vscode.window.showInputBox({
                prompt: 'Describe what you want the AI council to generate',
                placeHolder: 'e.g., Create a React component for user authentication...',
                validateInput: (value) => {
                    if (value.length < 10) {
                        return 'Please provide a more detailed description (at least 10 characters)';
                    }
                    return null;
                }
            });

            if (!prompt) {
                return;
            }

            // Extract context from current file and workspace
            const context = await contextExtractor.extractContext(editor);
            
            // Get voice recommendations
            const recommendations = await voiceRecommendationService.getRecommendations(prompt, context);
            
            // Show voice selection quick pick
            const voiceSelection = await showVoiceSelectionQuickPick(recommendations);
            if (!voiceSelection) {
                return;
            }

            // Show progress while generating
            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: 'Generating with AI Council...',
                cancellable: false
            }, async (progress) => {
                progress.report({ increment: 0, message: 'Initializing council...' });

                const response = await apiService.generate({
                    prompt,
                    context,
                    voices: voiceSelection,
                    synthesisMode: vscode.workspace.getConfiguration('codecrucible').get('synthesisMode', 'collaborative')
                });

                progress.report({ increment: 50, message: 'Processing solutions...' });

                // Display solutions in a new document or webview
                await displaySolutions(response.solutions, prompt);

                progress.report({ increment: 100, message: 'Complete!' });

                // Track usage
                telemetryService.track('generation.completed', {
                    promptLength: prompt.length,
                    voiceCount: voiceSelection.perspectives.length + voiceSelection.roles.length,
                    solutionCount: response.solutions.length
                });
            });

        } catch (error) {
            vscode.window.showErrorMessage(`Generation failed: ${error}`);
            telemetryService.track('generation.failed', { error: String(error) });
        }
    });

    // Synthesize Solutions command
    const synthesizeCommand = vscode.commands.registerCommand('codecrucible.synthesizeSolutions', async () => {
        try {
            // Get current solutions from provider
            const solutions = solutionsViewProvider.getCurrentSolutions();
            if (!solutions || solutions.length < 2) {
                vscode.window.showWarningMessage('At least 2 solutions are required for synthesis');
                return;
            }

            // Show synthesis goal selection
            const synthesisGoal = await vscode.window.showQuickPick([
                { label: 'Best Practices', value: 'best_practices' },
                { label: 'Performance', value: 'performance' },
                { label: 'Readability', value: 'readability' },
                { label: 'Maintainability', value: 'maintainability' }
            ], {
                placeHolder: 'Select synthesis goal'
            });

            if (!synthesisGoal) {
                return;
            }

            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: 'Synthesizing solutions...',
                cancellable: false
            }, async (progress) => {
                const result = await apiService.synthesize({
                    solutions: solutions.map(sol => ({
                        code: sol.code,
                        explanation: sol.explanation,
                        voiceType: sol.voiceType,
                        confidence: sol.confidence
                    })),
                    synthesisGoal: synthesisGoal.value as any
                });

                // Display synthesized result
                await displaySynthesisResult(result);

                telemetryService.track('synthesis.completed', {
                    solutionCount: solutions.length,
                    synthesisGoal: synthesisGoal.value
                });
            });

        } catch (error) {
            vscode.window.showErrorMessage(`Synthesis failed: ${error}`);
            telemetryService.track('synthesis.failed', { error: String(error) });
        }
    });

    // Open Council Panel command
    const openPanelCommand = vscode.commands.registerCommand('codecrucible.openCouncilPanel', () => {
        vscode.commands.executeCommand('workbench.view.extension.codecrucible-explorer');
        telemetryService.track('panel.opened');
    });

    // Review Current File command
    const reviewFileCommand = vscode.commands.registerCommand('codecrucible.reviewCurrentFile', async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showWarningMessage('No active editor found');
            return;
        }

        if (!authService.isAuthenticated()) {
            const result = await vscode.window.showWarningMessage(
                'Please authenticate with CodeCrucible first',
                'Authenticate'
            );
            if (result === 'Authenticate') {
                await vscode.commands.executeCommand('codecrucible.authenticate');
            }
            return;
        }

        try {
            const context = await contextExtractor.extractContext(editor);
            const fileContent = editor.document.getText();
            
            const prompt = `Review this ${context.language} code for potential improvements, best practices, and potential issues:\n\n${fileContent}`;

            // Auto-select appropriate voices for code review
            const voices = {
                perspectives: ['Analyzer', 'Maintainer'],
                roles: ['Security Engineer', 'Performance Engineer']
            };

            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: 'Reviewing file with AI Council...',
                cancellable: false
            }, async (progress) => {
                const response = await apiService.generate({
                    prompt,
                    context,
                    voices,
                    synthesisMode: 'consensus'
                });

                // Display review results
                await displayReviewResults(response.solutions, editor.document.fileName);

                telemetryService.track('file.reviewed', {
                    language: context.language,
                    fileSize: fileContent.length
                });
            });

        } catch (error) {
            vscode.window.showErrorMessage(`File review failed: ${error}`);
            telemetryService.track('file_review.failed', { error: String(error) });
        }
    });

    // Show Decision History command
    const historyCommand = vscode.commands.registerCommand('codecrucible.showDecisionHistory', () => {
        vscode.commands.executeCommand('workbench.view.extension.codecrucible-explorer');
        vscode.commands.executeCommand('codecrucible.decisionHistory.focus');
        telemetryService.track('decision_history.viewed');
    });

    // Register all commands
    context.subscriptions.push(
        authenticateCommand,
        generateCommand,
        synthesizeCommand,
        openPanelCommand,
        reviewFileCommand,
        historyCommand
    );
}

async function showVoiceSelectionQuickPick(recommendations: any[]): Promise<any> {
    const voiceOptions = [
        { label: '🔍 Explorer + 🏗️ Systems Architect', value: { perspectives: ['Explorer'], roles: ['Systems Architect'] } },
        { label: '🔧 Developer + ⚡ Performance Engineer', value: { perspectives: ['Developer'], roles: ['Performance Engineer'] } },
        { label: '🔬 Analyzer + 🛡️ Security Engineer', value: { perspectives: ['Analyzer'], roles: ['Security Engineer'] } },
        { label: '🌱 Maintainer + 🎨 UI/UX Engineer', value: { perspectives: ['Maintainer'], roles: ['UI/UX Engineer'] } },
        { label: '⚡ Implementor + 🏗️ Systems Architect', value: { perspectives: ['Implementor'], roles: ['Systems Architect'] } },
        { label: '🤖 Recommended Combination', value: recommendations[0]?.voices || { perspectives: ['Explorer'], roles: ['Systems Architect'] } },
        { label: '⚙️ Custom Selection...', value: 'custom' }
    ];

    const selected = await vscode.window.showQuickPick(voiceOptions, {
        placeHolder: 'Select voice combination for generation'
    });

    if (!selected) {
        return null;
    }

    if (selected.value === 'custom') {
        // Show custom voice selection (implementation would be more complex)
        return { perspectives: ['Explorer'], roles: ['Systems Architect'] };
    }

    return selected.value;
}

async function displaySolutions(solutions: any[], prompt: string) {
    // Create a new document to display solutions
    const doc = await vscode.workspace.openTextDocument({
        content: generateSolutionsContent(solutions, prompt),
        language: 'markdown'
    });
    
    await vscode.window.showTextDocument(doc);
}

async function displaySynthesisResult(result: any) {
    // Create a new document to display synthesis result
    const doc = await vscode.workspace.openTextDocument({
        content: generateSynthesisContent(result),
        language: 'markdown'
    });
    
    await vscode.window.showTextDocument(doc);
}

async function displayReviewResults(solutions: any[], fileName: string) {
    // Create a new document to display review results
    const doc = await vscode.workspace.openTextDocument({
        content: generateReviewContent(solutions, fileName),
        language: 'markdown'
    });
    
    await vscode.window.showTextDocument(doc);
}

function generateSolutionsContent(solutions: any[], prompt: string): string {
    let content = `# CodeCrucible AI Council Solutions\n\n`;
    content += `**Prompt**: ${prompt}\n\n`;
    content += `**Generated**: ${new Date().toLocaleString()}\n\n`;
    content += `---\n\n`;

    solutions.forEach((solution, index) => {
        content += `## Solution ${index + 1}: ${solution.voiceType}\n\n`;
        content += `**Confidence**: ${(solution.confidence * 100).toFixed(1)}%\n\n`;
        content += `**Explanation**: ${solution.explanation}\n\n`;
        content += `\`\`\`${detectLanguage(solution.code)}\n${solution.code}\n\`\`\`\n\n`;
        content += `---\n\n`;
    });

    return content;
}

function generateSynthesisContent(result: any): string {
    let content = `# CodeCrucible Synthesis Result\n\n`;
    content += `**Quality Score**: ${result.qualityScore}/100\n\n`;
    content += `**Synthesized**: ${new Date().toLocaleString()}\n\n`;
    content += `## Explanation\n\n${result.explanation}\n\n`;
    content += `## Synthesized Code\n\n`;
    content += `\`\`\`${detectLanguage(result.synthesizedCode)}\n${result.synthesizedCode}\n\`\`\`\n\n`;
    
    if (result.improvementSuggestions && result.improvementSuggestions.length > 0) {
        content += `## Improvement Suggestions\n\n`;
        result.improvementSuggestions.forEach((suggestion: string, index: number) => {
            content += `${index + 1}. ${suggestion}\n`;
        });
    }

    return content;
}

function generateReviewContent(solutions: any[], fileName: string): string {
    let content = `# Code Review Results: ${fileName}\n\n`;
    content += `**Reviewed**: ${new Date().toLocaleString()}\n\n`;
    content += `---\n\n`;

    solutions.forEach((solution, index) => {
        content += `## ${solution.voiceType} Analysis\n\n`;
        content += `**Confidence**: ${(solution.confidence * 100).toFixed(1)}%\n\n`;
        content += `${solution.explanation}\n\n`;
        
        if (solution.code && solution.code.trim()) {
            content += `### Suggested Improvements\n\n`;
            content += `\`\`\`${detectLanguage(solution.code)}\n${solution.code}\n\`\`\`\n\n`;
        }
        
        content += `---\n\n`;
    });

    return content;
}

function detectLanguage(code: string): string {
    // Simple language detection based on code patterns
    if (code.includes('import React') || code.includes('useState') || code.includes('jsx')) {
        return 'typescript';
    } else if (code.includes('def ') || code.includes('import numpy')) {
        return 'python';
    } else if (code.includes('function') || code.includes('const ') || code.includes('let ')) {
        return 'javascript';
    } else if (code.includes('class') && code.includes('public')) {
        return 'java';
    }
    return 'text';
}

function updateContexts(authService: AuthenticationService) {
    vscode.commands.executeCommand('setContext', 'codecrucible.authenticated', authService.isAuthenticated());
    vscode.commands.executeCommand('setContext', 'codecrucible.hasSolutions', false);
    vscode.commands.executeCommand('setContext', 'codecrucible.hasSynthesis', false);
}

export function deactivate() {
    console.log('CodeCrucible extension is now deactivated');
}