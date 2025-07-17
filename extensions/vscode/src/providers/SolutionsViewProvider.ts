// VS Code Extension - Solutions View Provider
// Following AI_INSTRUCTIONS.md security patterns and CodingPhilosophy.md consciousness principles

import * as vscode from 'vscode';
import { CodeCrucibleApi } from '../services/CodeCrucibleApi';

export interface Solution {
  id: number;
  code: string;
  explanation: string;
  voiceType: string;
  confidence: number;
  metadata?: any;
}

export class SolutionsViewProvider implements vscode.TreeDataProvider<SolutionItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<SolutionItem | undefined | null | void> = new vscode.EventEmitter<SolutionItem | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<SolutionItem | undefined | null | void> = this._onDidChangeTreeData.event;

  private solutions: Solution[] = [];
  private sessionId?: number;

  constructor(
    private context: vscode.ExtensionContext,
    private api: CodeCrucibleApi
  ) {}

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  setSolutions(solutions: Solution[], sessionId?: number): void {
    this.solutions = solutions;
    this.sessionId = sessionId;
    this.refresh();
  }

  getCurrentSolutions(): Solution[] {
    return this.solutions;
  }

  clearSolutions(): void {
    this.solutions = [];
    this.sessionId = undefined;
    this.refresh();
  }

  getTreeItem(element: SolutionItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: SolutionItem): Promise<SolutionItem[]> {
    if (!element) {
      // Root level - show solutions
      if (this.solutions.length === 0) {
        return [
          new SolutionItem(
            'No solutions generated yet',
            'Use "Generate with Council" to create solutions',
            vscode.TreeItemCollapsibleState.None,
            'empty',
            'info'
          )
        ];
      }

      const items: SolutionItem[] = [];

      // Add session info if available
      if (this.sessionId) {
        items.push(
          new SolutionItem(
            `Session #${this.sessionId}`,
            `${this.solutions.length} solutions generated`,
            vscode.TreeItemCollapsibleState.None,
            'session-info',
            'folder'
          )
        );
      }

      // Add solutions
      this.solutions.forEach((solution, index) => {
        const confidencePercent = Math.round(solution.confidence * 100);
        items.push(
          new SolutionItem(
            `${solution.voiceType} (${confidencePercent}%)`,
            solution.explanation.substring(0, 100) + '...',
            vscode.TreeItemCollapsibleState.Collapsed,
            'solution',
            this.getVoiceIcon(solution.voiceType),
            undefined,
            solution
          )
        );
      });

      // Add synthesis action if multiple solutions
      if (this.solutions.length >= 2) {
        items.push(
          new SolutionItem(
            '🔗 Synthesize Solutions',
            'Combine solutions into optimized result',
            vscode.TreeItemCollapsibleState.None,
            'action',
            'combine',
            {
              command: 'codecrucible.synthesizeSolutions',
              title: 'Synthesize Solutions',
              arguments: []
            }
          )
        );
      }

      return items;
    } else if (element.type === 'solution' && element.solution) {
      // Show solution details
      return this.getSolutionDetails(element.solution);
    }

    return [];
  }

  private getSolutionDetails(solution: Solution): SolutionItem[] {
    const items: SolutionItem[] = [];

    // Code preview
    const codePreview = solution.code.length > 150 
      ? solution.code.substring(0, 150) + '...' 
      : solution.code;
    
    items.push(
      new SolutionItem(
        'Code',
        codePreview,
        vscode.TreeItemCollapsibleState.None,
        'code',
        'code',
        {
          command: 'codecrucible.showSolutionCode',
          title: 'Show Code',
          arguments: [solution]
        }
      )
    );

    // Explanation
    items.push(
      new SolutionItem(
        'Explanation',
        solution.explanation,
        vscode.TreeItemCollapsibleState.None,
        'explanation',
        'book'
      )
    );

    // Confidence score
    items.push(
      new SolutionItem(
        `Confidence: ${Math.round(solution.confidence * 100)}%`,
        'AI confidence in this solution',
        vscode.TreeItemCollapsibleState.None,
        'confidence',
        'pulse'
      )
    );

    // Actions
    items.push(
      new SolutionItem(
        'Insert at Cursor',
        'Insert this solution at current cursor position',
        vscode.TreeItemCollapsibleState.None,
        'action',
        'insert',
        {
          command: 'codecrucible.insertSolution',
          title: 'Insert Solution',
          arguments: [solution]
        }
      )
    );

    items.push(
      new SolutionItem(
        'Open in New Document',
        'Open this solution in a new editor tab',
        vscode.TreeItemCollapsibleState.None,
        'action',
        'file-add',
        {
          command: 'codecrucible.openSolutionInNewDocument',
          title: 'Open in New Document',
          arguments: [solution]
        }
      )
    );

    return items;
  }

  private getVoiceIcon(voiceType: string): string {
    const iconMap: { [key: string]: string } = {
      'Explorer': 'search',
      'Maintainer': 'tools',
      'Analyzer': 'graph',
      'Developer': 'code',
      'Implementor': 'rocket',
      'Systems Architect': 'organization',
      'Security Engineer': 'shield',
      'Performance Engineer': 'pulse',
      'UI/UX Engineer': 'paintbrush'
    };

    return iconMap[voiceType] || 'brain';
  }
}

export class SolutionItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly tooltip: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly type: string,
    public readonly iconName: string,
    public readonly command?: vscode.Command,
    public readonly solution?: Solution
  ) {
    super(label, collapsibleState);
    this.tooltip = tooltip;
    this.iconPath = new vscode.ThemeIcon(iconName);
    if (command) {
      this.command = command;
    }
  }

  contextValue = this.type;
}