import type { IPlugin, PluginContext } from '../domain/interfaces/plugin.js';

export default function createSecurityPlugin(): IPlugin {
  return {
    meta: {
      name: 'security-plugin',
      version: '1.0.0',
      description: 'Security checks and auditing',
      lifecycle: 'both',
      tags: ['security'],
    },
    initialize(ctx: Readonly<PluginContext>): void {
      if (ctx.registerCommand) {
        ctx.registerCommand('security:audit', () => ({ success: true, issues: [] as [] }));
      }
    },
  };
}
