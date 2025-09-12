import { unifiedToolRegistry } from '../../infrastructure/tools/unified-tool-registry.js';

export interface ToolsCommandOptions {
  json?: boolean;
  limit?: number;
}

export class ToolsCommand {
  public async execute(options: Readonly<ToolsCommandOptions> = {}): Promise<void> {
    const names = unifiedToolRegistry.getAvailableToolNames();
    const status = unifiedToolRegistry.getRegistryStatus();
    const limit = typeof options.limit === 'number' && options.limit > 0 ? options.limit : 50;

    const output = {
      totalTools: names.length,
      sample: names.slice(0, limit),
      categories: status.categories,
      unknownToolAttempts: status.unknownToolAttempts,
      recentUnknownTools: status.recentUnknownTools,
    };

    if (options.json) {
      console.log(JSON.stringify(output, null, 2));
      return;
    }

    console.log(`Available tools: ${names.length}`);
    if (names.length) {
      console.log(`\nSample (${Math.min(limit, names.length)}):`);
      console.log('  ' + output.sample.join(', '));
    }
    console.log('\nCategories:');
    for (const [cat, count] of Object.entries(output.categories)) {
      console.log(`  - ${cat}: ${count}`);
    }
    console.log(`\nUnknown tool attempts: ${output.unknownToolAttempts}`);
    if (output.recentUnknownTools.length) {
      console.log('Recent unknown tool requests: ' + output.recentUnknownTools.join(', '));
    }
  }
}

export function parseToolsArgs(argv: readonly string[]): ToolsCommandOptions {
  const opts: ToolsCommandOptions = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--json') opts.json = true;
    if (a === '--limit' && typeof argv[i + 1] === 'string') {
      const n = parseInt(argv[i + 1] as string, 10);
      if (!Number.isNaN(n)) opts.limit = n;
      i++;
    }
  }
  return opts;
}

