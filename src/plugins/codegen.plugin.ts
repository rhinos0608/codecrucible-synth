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
    initialize(ctx: Readonly<PluginContext>): void {
      if (ctx.registerCommand) {
        ctx.registerCommand('codegen:scaffold', (...args: readonly unknown[]) => {
          // Type guard to ensure we have the expected parameters
          if (args.length < 2 || typeof args[0] !== 'string' || typeof args[1] !== 'string') {
            throw new Error('codegen:scaffold requires two string arguments: template and target');
          }

          const [template, target] = args as [string, string];

          return { success: true, template, target };
        });
      }
    },
  };
}
