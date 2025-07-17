// VS Code Extension - Synthesis View Provider
// Following AI_INSTRUCTIONS.md security patterns and CodingPhilosophy.md consciousness principles

import * as vscode from 'vscode';
import { CodeCrucibleApi } from '../services/CodeCrucibleApi';

export interface SynthesisResult {
  synthesizedCode: string;
  explanation: string;
  qualityScore: number;
  improvementSuggestions: string[];
  metadata?: any;
}

export class SynthesisViewProvider implements vscode.TreeDataProvider<SynthesisItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<SynthesisItem | undefined | null | void> = new vscode.EventEmitter<SynthesisItem | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<SynthesisItem | undefined | null | void> = this._onDidChangeTreeData.event;

  private synthesisResult?: SynthesisResult;

  constructor(
    private context: vscode.ExtensionContext,
    private api: CodeCrucibleApi
  ) {}

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  setSynthesisResult(result: SynthesisResult): void {
    this.synthesisResult = result;
    this.refresh();
  }

  clearSynthesis(): void {
    this.synthesisResult = undefined;
    this.refresh();
  }

  getSynthesisResult(): SynthesisResult | undefined {
    return this.synthesisResult;
  }

  getTreeItem(element: SynthesisItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: SynthesisItem): Promise<SynthesisItem[]> {
    if (!element) {
      // Root level - show synthesis result
      if (!this.synthesisResult) {
        return [
          new SynthesisItem(
            'No synthesis result yet',
            'Use "Synthesize Solutions" to combine multiple solutions',
            vscode.TreeItemCollapsibleState.None,
            'empty',
            'info'
          )
        ];
      }

      const items: SynthesisItem[] = [];

      // Quality score
      items.push(
        new SynthesisItem(
          `Quality Score: ${this.synthesisResult.qualityScore}/100`,
          'Overall quality assessment of the synthesized solution',
          vscode.TreeItemCollapsibleState.None,
          'quality-score',
          this.getQualityIcon(this.synthesisResult.qualityScore)
        )
      );

      // Synthesized code
      items.push(
        new SynthesisItem(
          'Synthesized Code',
          'The combined and optimized code solution',
          vscode.TreeItemCollapsibleState.Collapsed,
          'synthesized-code',
          'code',
          {
            command: 'codecrucible.showSynthesisCode',
            title: 'Show Synthesized Code',
            arguments: [this.synthesisResult]
          }
        )
      );

      // Explanation
      items.push(
        new SynthesisItem(
          'Explanation',
          this.synthesisResult.explanation,
          vscode.TreeItemCollapsibleState.Collapsed,
          'explanation',
          'book'
        )
      );

      // Improvement suggestions
      if (this.synthesisResult.improvementSuggestions.length > 0) {
        items.push(
          new SynthesisItem(
            `Improvement Suggestions (${this.synthesisResult.improvementSuggestions.length})`,
            'AI recommendations for further improvements',
            vscode.TreeItemCollapsibleState.Collapsed,
            'suggestions',
            'lightbulb'
          )
        );
      }

      // Actions
      items.push(
        new SynthesisItem(
          'Insert Synthesis Result',
          'Insert the synthesized code at current cursor position',
          vscode.TreeItemCollapsibleState.None,
          'action',
          'insert',
          {
            command: 'codecrucible.insertSynthesis',
            title: 'Insert Synthesis',
            arguments: [this.synthesisResult]
          }
        )
      );

      items.push(
        new SynthesisItem(
          'Save as New Project',
          'Save the synthesis result as a new project',
          vscode.TreeItemCollapsibleState.None,
          'action',
          'save',
          {
            command: 'codecrucible.saveSynthesisAsProject',
            title: 'Save as Project',
            arguments: [this.synthesisResult]
          }
        )
      );

      return items;
    } else {
      switch (element.type) {
        case 'synthesized-code':
          return this.getCodeDetails();
        case 'explanation':
          return this.getExplanationDetails();
        case 'suggestions':
          return this.getSuggestionDetails();
        default:
          return [];
      }
    }
  }

  private getCodeDetails(): SynthesisItem[] {
    if (!this.synthesisResult) return [];

    const codeLength = this.synthesisResult.synthesizedCode.length;
    const linesCount = this.synthesisResult.synthesizedCode.split('\n').length;

    return [
      new SynthesisItem(
        `Code Length: ${codeLength} characters`,
        'Total character count of synthesized code',
        vscode.TreeItemCollapsibleState.None,
        'info',
        'info'
      ),
      new SynthesisItem(
        `Lines: ${linesCount}`,
        'Total line count of synthesized code',
        vscode.TreeItemCollapsibleState.None,
        'info',
        'info'
      ),
      new SynthesisItem(
        'View Full Code',
        'Open synthesized code in new document',
        vscode.TreeItemCollapsibleState.None,
        'action',
        'file-add',
        {
          command: 'codecrucible.openSynthesisInNewDocument',
          title: 'Open in New Document',
          arguments: [this.synthesisResult]
        }
      ),
      new SynthesisItem(
        'Copy to Clipboard',
        'Copy synthesized code to clipboard',
        vscode.TreeItemCollapsibleState.None,
        'action',
        'clippy',
        {
          command: 'codecrucible.copySynthesisToClipboard',
          title: 'Copy to Clipboard',
          arguments: [this.synthesisResult]
        }
      )
    ];
  }

  private getExplanationDetails(): SynthesisItem[] {
    if (!this.synthesisResult) return [];

    // Split explanation into sentences for better readability
    const sentences = this.synthesisResult.explanation
      .split(/[.!?]+/)
      .filter(s => s.trim().length > 0)
      .slice(0, 5); // Limit to first 5 sentences

    return sentences.map((sentence, index) => 
      new SynthesisItem(
        `${index + 1}. ${sentence.trim()}`,
        sentence.trim(),
        vscode.TreeItemCollapsibleState.None,
        'explanation-detail',
        'circle'
      )
    );
  }

  private getSuggestionDetails(): SynthesisItem[] {
    if (!this.synthesisResult) return [];

    return this.synthesisResult.improvementSuggestions.map((suggestion, index) => 
      new SynthesisItem(
        `${index + 1}. ${suggestion}`,
        suggestion,
        vscode.TreeItemCollapsibleState.None,
        'suggestion',
        'arrow-right'
      )
    );
  }

  private getQualityIcon(score: number): string {
    if (score >= 90) return 'star-full';
    if (score >= 80) return 'star-half';
    if (score >= 70) return 'circle-filled';
    if (score >= 60) return 'circle-outline';
    return 'warning';
  }
}

export class SynthesisItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly tooltip: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly type: string,
    public readonly iconName: string,
    public readonly command?: vscode.Command
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