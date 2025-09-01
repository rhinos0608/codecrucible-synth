import fs from 'fs';
import path from 'path';
import url from 'url';
import type { IPlugin } from '../../domain/interfaces/plugin.js';

function toFileUrl(p: string): string {
  const abs = path.resolve(p);
  const href = url.pathToFileURL(abs).href;
  return href;
}

export async function discoverPlugins(directories: string[]): Promise<Array<() => Promise<IPlugin>>> {
  const factories: Array<() => Promise<IPlugin>> = [];

  for (const dir of directories) {
    if (!fs.existsSync(dir)) continue;
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isFile()) continue;
      const ext = path.extname(entry.name).toLowerCase();
      if (!['.js', '.mjs', '.cjs', '.ts'].includes(ext)) continue;

      const filePath = path.join(dir, entry.name);
      factories.push(async () => {
        const mod = await import(toFileUrl(filePath));
        const plugin: IPlugin = typeof mod.default === 'function' ? await mod.default() : mod.plugin ?? mod.default ?? mod;
        return plugin;
      });
    }
  }

  return factories;
}

