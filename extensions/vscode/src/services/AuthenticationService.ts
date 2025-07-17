// VS Code Extension - Authentication Service
// Following AI_INSTRUCTIONS.md security patterns

import * as vscode from 'vscode';
import axios from 'axios';

export class AuthenticationService {
  private context: vscode.ExtensionContext;
  private authChangeListeners: Array<() => void> = [];

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
  }

  async authenticate(): Promise<void> {
    try {
      // Get user credentials
      const userId = await vscode.window.showInputBox({
        prompt: 'Enter your CodeCrucible User ID',
        placeHolder: 'Your user ID from CodeCrucible dashboard',
        ignoreFocusOut: true
      });

      if (!userId) {
        throw new Error('User ID is required');
      }

      // For extension authentication, we'll use a simpler approach
      // In production, this would involve OAuth or API key generation
      const platform = 'vscode';
      const version = '1.0.0';
      
      // Generate API key request
      const config = vscode.workspace.getConfiguration('codecrucible');
      const apiUrl = config.get('apiUrl', 'https://api.codecrucible.com');
      
      const response = await axios.post(`${apiUrl}/api/extensions/auth`, {
        platform,
        version,
        userId,
        clientId: `vscode-${Date.now()}`
      });

      const { apiKey, features } = response.data;

      // Store API key securely
      await this.context.secrets.store('codecrucible-api-key', apiKey);
      await this.context.globalState.update('codecrucible-user-id', userId);
      await this.context.globalState.update('codecrucible-features', features);

      // Notify listeners
      this.authChangeListeners.forEach(listener => listener());

      vscode.window.showInformationMessage(
        `Successfully authenticated with CodeCrucible! Features: ${Object.keys(features).join(', ')}`
      );

    } catch (error: any) {
      const errorMessage = error.response?.data?.error || error.message;
      vscode.window.showErrorMessage(`Authentication failed: ${errorMessage}`);
      throw error;
    }
  }

  async getApiKey(): Promise<string | undefined> {
    return await this.context.secrets.get('codecrucible-api-key');
  }

  async clearApiKey(): Promise<void> {
    await this.context.secrets.delete('codecrucible-api-key');
    await this.context.globalState.update('codecrucible-user-id', undefined);
    await this.context.globalState.update('codecrucible-features', undefined);
    
    // Notify listeners
    this.authChangeListeners.forEach(listener => listener());
  }

  async getUserId(): Promise<string | undefined> {
    return this.context.globalState.get('codecrucible-user-id');
  }

  async getFeatures(): Promise<any> {
    return this.context.globalState.get('codecrucible-features', {});
  }

  isAuthenticated(): boolean {
    return !!this.context.globalState.get('codecrucible-user-id');
  }

  onAuthenticationChanged(listener: () => void): void {
    this.authChangeListeners.push(listener);
  }

  async logout(): Promise<void> {
    await this.clearApiKey();
    vscode.window.showInformationMessage('Logged out from CodeCrucible');
  }

  // Check if a specific feature is available
  async hasFeature(featureName: string): Promise<boolean> {
    const features = await this.getFeatures();
    return features[featureName] === true;
  }

  // Get authentication status for display
  async getAuthStatus(): Promise<{
    authenticated: boolean;
    userId?: string;
    features?: string[];
  }> {
    const authenticated = this.isAuthenticated();
    if (!authenticated) {
      return { authenticated: false };
    }

    const userId = await this.getUserId();
    const features = await this.getFeatures();
    
    return {
      authenticated: true,
      userId,
      features: Object.keys(features).filter(key => features[key])
    };
  }
}