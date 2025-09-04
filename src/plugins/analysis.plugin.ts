import type { IPlugin, PluginContext } from '../domain/interfaces/plugin.js';

export default function createAnalysisPlugin(): IPlugin {
  return {
    meta: {
      name: 'analysis-plugin',
      version: '1.0.0',
      description: 'Provides analysis-related commands',
      lifecycle: 'both',
      tags: ['analysis'],
    },
    async initialize(ctx: PluginContext) {
      if (ctx.registerCommand) {
        ctx.registerCommand('analysis:refresh-index', async () => {
          return { success: true, message: 'Index refreshed' };
        });
      }
    },
  };
}
