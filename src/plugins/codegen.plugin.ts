import type { IPlugin, PluginContext } from '../domain/interfaces/plugin.js';

export default function createCodegenPlugin(): IPlugin {
  return {
    meta: {
      name: 'codegen-plugin',
      version: '1.0.0',
      description: 'Provides code generation commands',
      lifecycle: 'both',
      tags: ['codegen'],
    },
    async initialize(ctx: PluginContext) {
      if (ctx.registerCommand) {
        ctx.registerCommand('codegen:scaffold', async (template: string, target: string) => {
          return { success: true, template, target };
        });
      }
    },
  };
}
