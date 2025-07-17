// VS Code Extension - Telemetry Service
// Following AI_INSTRUCTIONS.md security patterns and CodingPhilosophy.md consciousness principles

import * as vscode from 'vscode';

export class TelemetryService {
  private context: vscode.ExtensionContext;
  private enabled: boolean;

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
    
    // Check if telemetry is enabled in configuration
    const config = vscode.workspace.getConfiguration('codecrucible');
    this.enabled = config.get('enableTelemetry', true);
  }

  track(event: string, properties?: { [key: string]: any }): void {
    if (!this.enabled) {
      return;
    }

    try {
      // In a real implementation, this would send to analytics service
      // For now, we'll just log to console and store locally
      const telemetryData = {
        event,
        properties: {
          ...properties,
          timestamp: new Date().toISOString(),
          sessionId: this.getSessionId(),
          extensionVersion: this.context.extension.packageJSON.version,
          vscodeVersion: vscode.version
        }
      };

      // Log for development
      console.log('📊 Telemetry:', telemetryData);

      // Store locally for analytics
      this.storeEvent(telemetryData);

    } catch (error) {
      console.error('Telemetry tracking failed:', error);
    }
  }

  private getSessionId(): string {
    let sessionId = this.context.globalState.get<string>('codecrucible-session-id');
    if (!sessionId) {
      sessionId = `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      this.context.globalState.update('codecrucible-session-id', sessionId);
    }
    return sessionId;
  }

  private async storeEvent(data: any): Promise<void> {
    try {
      // Get existing events
      const events = this.context.globalState.get<any[]>('codecrucible-telemetry-events', []);
      
      // Add new event
      events.push(data);
      
      // Keep only last 100 events to avoid storage bloat
      if (events.length > 100) {
        events.splice(0, events.length - 100);
      }
      
      // Store back
      await this.context.globalState.update('codecrucible-telemetry-events', events);
    } catch (error) {
      console.error('Failed to store telemetry event:', error);
    }
  }

  async getStoredEvents(): Promise<any[]> {
    return this.context.globalState.get<any[]>('codecrucible-telemetry-events', []);
  }

  async clearStoredEvents(): Promise<void> {
    await this.context.globalState.update('codecrucible-telemetry-events', []);
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  isEnabled(): boolean {
    return this.enabled;
  }
}