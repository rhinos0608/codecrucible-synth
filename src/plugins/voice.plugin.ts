import type { IPlugin, PluginContext } from '../domain/interfaces/plugin.js';

export default function createVoicePlugin(): IPlugin {
  return {
    meta: {
      name: 'voice-plugin',
      version: '1.0.0',
      description: 'Voice synthesis helpers',
      lifecycle: 'both',
      tags: ['voice'],
    },
    initialize(ctx: Readonly<PluginContext>): void {
      if (ctx.registerCommand) {
        ctx.registerCommand('voice:list-voices', () => ({ voices: [] as string[] }));
      }
    },
  };
}
