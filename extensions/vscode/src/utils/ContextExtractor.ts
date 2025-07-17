// VS Code Extension - Context Extractor
// Following AI_INSTRUCTIONS.md security patterns and CodingPhilosophy.md consciousness principles

import * as vscode from 'vscode';
import * as path from 'path';

export interface CodeContext {
  language: string;
  filePath: string;
  projectType: string;
  dependencies: string[];
  surroundingCode: string;
  selectedText?: string;
  cursorPosition?: vscode.Position;
  imports?: string[];
  functions?: string[];
  classes?: string[];
}

export class ContextExtractor {
  
  async extractContext(editor: vscode.TextEditor): Promise<CodeContext> {
    const document = editor.document;
    const selection = editor.selection;
    const position = selection.active;

    // Basic context information
    const context: CodeContext = {
      language: document.languageId,
      filePath: document.fileName,
      projectType: await this.detectProjectType(document.uri),
      dependencies: await this.extractDependencies(document.uri),
      surroundingCode: this.extractSurroundingCode(document, position),
      selectedText: selection.isEmpty ? undefined : document.getText(selection),
      cursorPosition: position
    };

    // Language-specific analysis
    switch (document.languageId) {
      case 'javascript':
      case 'typescript':
      case 'javascriptreact':
      case 'typescriptreact':
        Object.assign(context, await this.analyzeJavaScriptTypeScript(document));
        break;
      case 'python':
        Object.assign(context, await this.analyzePython(document));
        break;
      case 'java':
        Object.assign(context, await this.analyzeJava(document));
        break;
      default:
        context.imports = this.extractImports(document.getText());
        break;
    }

    return context;
  }

  private extractSurroundingCode(document: vscode.TextDocument, position: vscode.Position, contextLines: number = 20): string {
    const startLine = Math.max(0, position.line - contextLines);
    const endLine = Math.min(document.lineCount - 1, position.line + contextLines);
    
    const range = new vscode.Range(startLine, 0, endLine, document.lineAt(endLine).text.length);
    return document.getText(range);
  }

  private async detectProjectType(uri: vscode.Uri): Promise<string> {
    try {
      const workspaceFolder = vscode.workspace.getWorkspaceFolder(uri);
      if (!workspaceFolder) {
        return 'single-file';
      }

      const workspacePath = workspaceFolder.uri.fsPath;

      // Check for specific project files
      const projectIndicators = [
        { file: 'package.json', type: 'nodejs' },
        { file: 'requirements.txt', type: 'python' },
        { file: 'pom.xml', type: 'java-maven' },
        { file: 'build.gradle', type: 'java-gradle' },
        { file: 'Cargo.toml', type: 'rust' },
        { file: 'go.mod', type: 'go' },
        { file: '.csproj', type: 'dotnet' },
        { file: 'composer.json', type: 'php' }
      ];

      for (const indicator of projectIndicators) {
        try {
          const filePath = path.join(workspacePath, indicator.file);
          const fileUri = vscode.Uri.file(filePath);
          await vscode.workspace.fs.stat(fileUri);
          return indicator.type;
        } catch {
          // File doesn't exist, continue checking
        }
      }

      return 'unknown';
    } catch (error) {
      return 'unknown';
    }
  }

  private async extractDependencies(uri: vscode.Uri): Promise<string[]> {
    try {
      const workspaceFolder = vscode.workspace.getWorkspaceFolder(uri);
      if (!workspaceFolder) {
        return [];
      }

      const workspacePath = workspaceFolder.uri.fsPath;
      const dependencies: string[] = [];

      // Check package.json for Node.js projects
      try {
        const packageJsonPath = path.join(workspacePath, 'package.json');
        const packageJsonUri = vscode.Uri.file(packageJsonPath);
        const packageJsonContent = await vscode.workspace.fs.readFile(packageJsonUri);
        const packageJson = JSON.parse(packageJsonContent.toString());
        
        if (packageJson.dependencies) {
          dependencies.push(...Object.keys(packageJson.dependencies));
        }
        if (packageJson.devDependencies) {
          dependencies.push(...Object.keys(packageJson.devDependencies));
        }
      } catch {
        // package.json doesn't exist or is invalid
      }

      // Check requirements.txt for Python projects
      try {
        const requirementsPath = path.join(workspacePath, 'requirements.txt');
        const requirementsUri = vscode.Uri.file(requirementsPath);
        const requirementsContent = await vscode.workspace.fs.readFile(requirementsUri);
        const requirements = requirementsContent.toString().split('\n')
          .filter(line => line.trim() && !line.startsWith('#'))
          .map(line => line.split('==')[0].split('>=')[0].split('<=')[0].trim());
        dependencies.push(...requirements);
      } catch {
        // requirements.txt doesn't exist
      }

      return dependencies.slice(0, 20); // Limit to first 20 dependencies
    } catch (error) {
      return [];
    }
  }

  private async analyzeJavaScriptTypeScript(document: vscode.TextDocument): Promise<Partial<CodeContext>> {
    const text = document.getText();
    
    return {
      imports: this.extractJSImports(text),
      functions: this.extractJSFunctions(text),
      classes: this.extractJSClasses(text)
    };
  }

  private async analyzePython(document: vscode.TextDocument): Promise<Partial<CodeContext>> {
    const text = document.getText();
    
    return {
      imports: this.extractPythonImports(text),
      functions: this.extractPythonFunctions(text),
      classes: this.extractPythonClasses(text)
    };
  }

  private async analyzeJava(document: vscode.TextDocument): Promise<Partial<CodeContext>> {
    const text = document.getText();
    
    return {
      imports: this.extractJavaImports(text),
      functions: this.extractJavaMethods(text),
      classes: this.extractJavaClasses(text)
    };
  }

  private extractImports(text: string): string[] {
    const imports: string[] = [];
    
    // Generic import patterns
    const importRegex = /(?:import|from|#include|using)\s+([^\s;]+)/gi;
    let match;
    
    while ((match = importRegex.exec(text)) !== null) {
      imports.push(match[1]);
    }
    
    return imports.slice(0, 10);
  }

  private extractJSImports(text: string): string[] {
    const imports: string[] = [];
    
    // ES6 imports
    const importRegex = /import\s+(?:{[^}]+}|\*\s+as\s+\w+|\w+)\s+from\s+['"]([^'"]+)['"]/gi;
    let match;
    
    while ((match = importRegex.exec(text)) !== null) {
      imports.push(match[1]);
    }
    
    // CommonJS requires
    const requireRegex = /require\(['"]([^'"]+)['"]\)/gi;
    while ((match = requireRegex.exec(text)) !== null) {
      imports.push(match[1]);
    }
    
    return imports.slice(0, 10);
  }

  private extractJSFunctions(text: string): string[] {
    const functions: string[] = [];
    
    // Function declarations and expressions
    const functionRegex = /(?:function\s+(\w+)|const\s+(\w+)\s*=\s*(?:async\s+)?(?:\([^)]*\)\s*=>|function))/gi;
    let match;
    
    while ((match = functionRegex.exec(text)) !== null) {
      functions.push(match[1] || match[2]);
    }
    
    return functions.slice(0, 10);
  }

  private extractJSClasses(text: string): string[] {
    const classes: string[] = [];
    
    const classRegex = /class\s+(\w+)/gi;
    let match;
    
    while ((match = classRegex.exec(text)) !== null) {
      classes.push(match[1]);
    }
    
    return classes.slice(0, 10);
  }

  private extractPythonImports(text: string): string[] {
    const imports: string[] = [];
    
    const importRegex = /(?:import\s+(\w+)|from\s+(\w+)\s+import)/gi;
    let match;
    
    while ((match = importRegex.exec(text)) !== null) {
      imports.push(match[1] || match[2]);
    }
    
    return imports.slice(0, 10);
  }

  private extractPythonFunctions(text: string): string[] {
    const functions: string[] = [];
    
    const functionRegex = /def\s+(\w+)\s*\(/gi;
    let match;
    
    while ((match = functionRegex.exec(text)) !== null) {
      functions.push(match[1]);
    }
    
    return functions.slice(0, 10);
  }

  private extractPythonClasses(text: string): string[] {
    const classes: string[] = [];
    
    const classRegex = /class\s+(\w+)/gi;
    let match;
    
    while ((match = classRegex.exec(text)) !== null) {
      classes.push(match[1]);
    }
    
    return classes.slice(0, 10);
  }

  private extractJavaImports(text: string): string[] {
    const imports: string[] = [];
    
    const importRegex = /import\s+(?:static\s+)?([^;]+);/gi;
    let match;
    
    while ((match = importRegex.exec(text)) !== null) {
      imports.push(match[1]);
    }
    
    return imports.slice(0, 10);
  }

  private extractJavaMethods(text: string): string[] {
    const methods: string[] = [];
    
    const methodRegex = /(?:public|private|protected|static)\s+(?:\w+\s+)*(\w+)\s*\(/gi;
    let match;
    
    while ((match = methodRegex.exec(text)) !== null) {
      if (match[1] !== 'class' && match[1] !== 'interface') {
        methods.push(match[1]);
      }
    }
    
    return methods.slice(0, 10);
  }

  private extractJavaClasses(text: string): string[] {
    const classes: string[] = [];
    
    const classRegex = /(?:class|interface)\s+(\w+)/gi;
    let match;
    
    while ((match = classRegex.exec(text)) !== null) {
      classes.push(match[1]);
    }
    
    return classes.slice(0, 10);
  }
}