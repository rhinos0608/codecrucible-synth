// VS Code Extension - Council Panel Tree Data Provider
// Following AI_INSTRUCTIONS.md security patterns and CodingPhilosophy.md consciousness principles

import * as vscode from 'vscode';
import { CodeCrucibleApi } from '../services/CodeCrucibleApi';
import { VoiceRecommendationService } from '../services/VoiceRecommendationService';

export class CouncilPanelProvider implements vscode.TreeDataProvider<CouncilPanelItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<CouncilPanelItem | undefined | null | void> = new vscode.EventEmitter<CouncilPanelItem | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<CouncilPanelItem | undefined | null | void> = this._onDidChangeTreeData.event;

  constructor(
    private context: vscode.ExtensionContext,
    private api: CodeCrucibleApi,
    private voiceRecommendationService: VoiceRecommendationService
  ) {}

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: CouncilPanelItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: CouncilPanelItem): Promise<CouncilPanelItem[]> {
    if (!element) {
      // Root level items
      return [
        new CouncilPanelItem(
          'Voice Selection',
          'Select AI voices for generation',
          vscode.TreeItemCollapsibleState.Expanded,
          'voice-selection',
          'brain'
        ),
        new CouncilPanelItem(
          'Quick Actions',
          'Common generation actions',
          vscode.TreeItemCollapsibleState.Expanded,
          'quick-actions',
          'zap'
        ),
        new CouncilPanelItem(
          'API Status',
          'CodeCrucible API connection status',
          vscode.TreeItemCollapsibleState.Collapsed,
          'api-status',
          'cloud'
        )
      ];
    } else {
      switch (element.type) {
        case 'voice-selection':
          return this.getVoiceSelectionItems();
        case 'quick-actions':
          return this.getQuickActionItems();
        case 'api-status':
          return this.getApiStatusItems();
        default:
          return [];
      }
    }
  }

  private getVoiceSelectionItems(): CouncilPanelItem[] {
    return [
      new CouncilPanelItem(
        'Code Analysis Engines',
        'Select perspective voices',
        vscode.TreeItemCollapsibleState.Expanded,
        'perspectives',
        'search'
      ),
      new CouncilPanelItem(
        'Code Specialization Engines',
        'Select role-based voices',
        vscode.TreeItemCollapsibleState.Expanded,
        'roles',
        'gear'
      ),
      new CouncilPanelItem(
        'Get Recommendations',
        'AI-powered voice suggestions',
        vscode.TreeItemCollapsibleState.None,
        'action',
        'lightbulb',
        {
          command: 'codecrucible.getVoiceRecommendations',
          title: 'Get Voice Recommendations',
          arguments: []
        }
      )
    ];
  }

  private getQuickActionItems(): CouncilPanelItem[] {
    const quickActions = this.voiceRecommendationService.getQuickRecommendations();
    
    return [
      ...quickActions.map(action => 
        new CouncilPanelItem(
          action.label,
          action.description,
          vscode.TreeItemCollapsibleState.None,
          'quick-action',
          'rocket',
          {
            command: 'codecrucible.generateWithQuickAction',
            title: action.label,
            arguments: [action.voices]
          }
        )
      ),
      new CouncilPanelItem(
        '⚙️ Custom Generation',
        'Configure custom voice combination',
        vscode.TreeItemCollapsibleState.None,
        'action',
        'settings',
        {
          command: 'codecrucible.generateWithCouncil',
          title: 'Custom Generation',
          arguments: []
        }
      )
    ];
  }

  private async getApiStatusItems(): Promise<CouncilPanelItem[]> {
    try {
      const status = await this.api.getApiStatus();
      const items: CouncilPanelItem[] = [];

      items.push(
        new CouncilPanelItem(
          `Connection: ${status.connected ? '✅ Connected' : '❌ Disconnected'}`,
          status.error || 'API connection status',
          vscode.TreeItemCollapsibleState.None,
          'status',
          status.connected ? 'check' : 'x'
        )
      );

      items.push(
        new CouncilPanelItem(
          `Authentication: ${status.authenticated ? '✅ Authenticated' : '❌ Not Authenticated'}`,
          'Authentication status',
          vscode.TreeItemCollapsibleState.None,
          'status',
          status.authenticated ? 'key' : 'lock'
        )
      );

      if (!status.authenticated) {
        items.push(
          new CouncilPanelItem(
            'Authenticate',
            'Click to authenticate with CodeCrucible',
            vscode.TreeItemCollapsibleState.None,
            'action',
            'sign-in',
            {
              command: 'codecrucible.authenticate',
              title: 'Authenticate',
              arguments: []
            }
          )
        );
      }

      return items;
    } catch (error) {
      return [
        new CouncilPanelItem(
          '❌ Status Check Failed',
          'Failed to check API status',
          vscode.TreeItemCollapsibleState.None,
          'error',
          'error'
        )
      ];
    }
  }
}

export class CouncilPanelItem extends vscode.TreeItem {
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