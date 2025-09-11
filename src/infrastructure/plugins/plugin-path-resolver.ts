/**
 * Plugin Path Resolver
 * Centralizes discovery of plugin directories with cross-platform defaults.
 */
import { join } from 'path';
import { existsSync } from 'fs';
import { normalizeAIPath, resolveSafePath } from '../../utils/path-utilities.js';
import { PathUtilities } from '../../utils/path-utilities.js';

export interface PluginPathOptions {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
}

export function resolvePluginDirectories(options: Readonly<PluginPathOptions> = {}): string[] {
  const cwd = options.cwd ?? process.cwd();
  const env = options.env ?? process.env;

  const dirs: string[] = [];

  // 1) Explicit env vars
  const fromEnv = env.CRUCIBLE_PLUGINS_DIR || env.PLUGINS_DIR;
  if (fromEnv) {
    const p = resolveSafePath(normalizeAIPath(fromEnv), cwd);
    if (existsSync(p)) dirs.push(p);
  }

  // 2) Project-local defaults (dist then src)
  const distPlugins = PathUtilities.resolveCaseInsensitivePath(cwd, 'dist/plugins');
  if (distPlugins) dirs.push(distPlugins);
  const srcPlugins = PathUtilities.resolveCaseInsensitivePath(cwd, 'src/plugins');
  if (srcPlugins) dirs.push(srcPlugins);

  // 3) User-level locations
  const home = env.HOME || env.USERPROFILE;
  if (home) {
    const xdg = env.XDG_DATA_HOME || join(home, '.local', 'share');
    const userPluginsLinux = join(xdg, 'CodeCrucible', 'plugins');
    if (existsSync(userPluginsLinux)) dirs.push(userPluginsLinux);

    const appData = env.APPDATA || join(home, 'AppData', 'Roaming');
    const userPluginsWin = join(appData, 'CodeCrucible', 'plugins');
    if (existsSync(userPluginsWin)) dirs.push(userPluginsWin);
  }

  // 4) Deduplicate while preserving order
  return Array.from(new Set(dirs));
}

export function getDefaultPluginDirectories(): string[] {
  return resolvePluginDirectories();
}
