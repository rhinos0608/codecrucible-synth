// VS Code Extension - Decision History Provider
// Following AI_INSTRUCTIONS.md security patterns and CodingPhilosophy.md consciousness principles

import * as vscode from 'vscode';
import { CodeCrucibleApi } from '../services/CodeCrucibleApi';

export interface DecisionHistoryEntry {
  id: string;
  timestamp: string;
  action: string;
  prompt?: string;
  voicesUsed: string[];
  outcome: 'success' | 'failed' | 'cancelled';
  metadata?: any;
}

export class DecisionHistoryProvider implements vscode.TreeDataProvider<DecisionHistoryItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<DecisionHistoryItem | undefined | null | void> = new vscode.EventEmitter<DecisionHistoryItem | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<DecisionHistoryItem | undefined | null | void> = this._onDidChangeTreeData.event;

  private history: DecisionHistoryEntry[] = [];

  constructor(
    private context: vscode.ExtensionContext,
    private api: CodeCrucibleApi
  ) {
    this.loadHistory();
  }

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  addEntry(entry: DecisionHistoryEntry): void {
    this.history.unshift(entry); // Add to beginning
    
    // Keep only last 50 entries
    if (this.history.length > 50) {
      this.history = this.history.slice(0, 50);
    }
    
    this.saveHistory();
    this.refresh();
  }

  clearHistory(): void {
    this.history = [];
    this.saveHistory();
    this.refresh();
  }

  getTreeItem(element: DecisionHistoryItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: DecisionHistoryItem): Promise<DecisionHistoryItem[]> {
    if (!element) {
      // Root level - show history entries grouped by date
      if (this.history.length === 0) {
        return [
          new DecisionHistoryItem(
            'No decisions recorded yet',
            'Decision history will appear here as you use CodeCrucible',
            vscode.TreeItemCollapsibleState.None,
            'empty',
            'info'
          )
        ];
      }

      // Group by date
      const groupedByDate = this.groupHistoryByDate();
      const items: DecisionHistoryItem[] = [];

      // Add clear history action
      items.push(
        new DecisionHistoryItem(
          '🗑️ Clear History',
          'Clear all decision history',
          vscode.TreeItemCollapsibleState.None,
          'action',
          'trash',
          {
            command: 'codecrucible.clearDecisionHistory',
            title: 'Clear History',
            arguments: []
          }
        )
      );

      // Add date groups
      for (const [date, entries] of Object.entries(groupedByDate)) {
        items.push(
          new DecisionHistoryItem(
            `${date} (${entries.length} decisions)`,
            `Decisions made on ${date}`,
            vscode.TreeItemCollapsibleState.Collapsed,
            'date-group',
            'calendar',
            undefined,
            entries
          )
        );
      }

      return items;
    } else if (element.type === 'date-group' && element.entries) {
      // Show entries for a specific date
      return element.entries.map(entry => 
        new DecisionHistoryItem(
          `${this.formatTime(entry.timestamp)} - ${entry.action}`,
          this.getEntryTooltip(entry),
          vscode.TreeItemCollapsibleState.Collapsed,
          'history-entry',
          this.getOutcomeIcon(entry.outcome),
          undefined,
          undefined,
          entry
        )
      );
    } else if (element.type === 'history-entry' && element.entry) {
      // Show entry details
      return this.getEntryDetails(element.entry);
    }

    return [];
  }

  private getEntryDetails(entry: DecisionHistoryEntry): DecisionHistoryItem[] {
    const items: DecisionHistoryItem[] = [];

    // Action details
    items.push(
      new DecisionHistoryItem(
        `Action: ${entry.action}`,
        'The action that was performed',
        vscode.TreeItemCollapsibleState.None,
        'detail',
        'gear'
      )
    );

    // Outcome
    items.push(
      new DecisionHistoryItem(
        `Outcome: ${entry.outcome.toUpperCase()}`,
        'The result of the action',
        vscode.TreeItemCollapsibleState.None,
        'detail',
        this.getOutcomeIcon(entry.outcome)
      )
    );

    // Voices used
    if (entry.voicesUsed.length > 0) {
      items.push(
        new DecisionHistoryItem(
          `Voices: ${entry.voicesUsed.join(', ')}`,
          'AI voices that were used',
          vscode.TreeItemCollapsibleState.None,
          'detail',
          'brain'
        )
      );
    }

    // Prompt (if available)
    if (entry.prompt) {
      const promptPreview = entry.prompt.length > 100 
        ? entry.prompt.substring(0, 100) + '...' 
        : entry.prompt;
      
      items.push(
        new DecisionHistoryItem(
          `Prompt: ${promptPreview}`,
          entry.prompt,
          vscode.TreeItemCollapsibleState.None,
          'detail',
          'quote'
        )
      );
    }

    // Metadata (if available)
    if (entry.metadata) {
      items.push(
        new DecisionHistoryItem(
          'View Metadata',
          'Additional details about this decision',
          vscode.TreeItemCollapsibleState.None,
          'action',
          'json',
          {
            command: 'codecrucible.showDecisionMetadata',
            title: 'Show Metadata',
            arguments: [entry]
          }
        )
      );
    }

    return items;
  }

  private groupHistoryByDate(): { [date: string]: DecisionHistoryEntry[] } {
    const groups: { [date: string]: DecisionHistoryEntry[] } = {};
    
    for (const entry of this.history) {
      const date = new Date(entry.timestamp).toDateString();
      if (!groups[date]) {
        groups[date] = [];
      }
      groups[date].push(entry);
    }
    
    return groups;
  }

  private formatTime(timestamp: string): string {
    return new Date(timestamp).toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  private getEntryTooltip(entry: DecisionHistoryEntry): string {
    let tooltip = `${entry.action} - ${entry.outcome}`;
    if (entry.voicesUsed.length > 0) {
      tooltip += `\nVoices: ${entry.voicesUsed.join(', ')}`;
    }
    if (entry.prompt) {
      tooltip += `\nPrompt: ${entry.prompt.substring(0, 50)}${entry.prompt.length > 50 ? '...' : ''}`;
    }
    return tooltip;
  }

  private getOutcomeIcon(outcome: string): string {
    switch (outcome) {
      case 'success': return 'check';
      case 'failed': return 'error';
      case 'cancelled': return 'circle-slash';
      default: return 'question';
    }
  }

  private async loadHistory(): Promise<void> {
    try {
      const stored = this.context.globalState.get<DecisionHistoryEntry[]>('codecrucible-decision-history', []);
      this.history = stored;
    } catch (error) {
      console.error('Failed to load decision history:', error);
      this.history = [];
    }
  }

  private async saveHistory(): Promise<void> {
    try {
      await this.context.globalState.update('codecrucible-decision-history', this.history);
    } catch (error) {
      console.error('Failed to save decision history:', error);
    }
  }
}

export class DecisionHistoryItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly tooltip: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly type: string,
    public readonly iconName: string,
    public readonly command?: vscode.Command,
    public readonly entries?: DecisionHistoryEntry[],
    public readonly entry?: DecisionHistoryEntry
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