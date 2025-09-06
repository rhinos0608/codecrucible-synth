import type { ILogger } from '../../domain/interfaces/logger.js';
import { PathUtilities } from '../../utils/path-utilities.js';

/**
 * Normalize file paths using centralized PathUtilities.
 * Extracted from ToolIntegration for reuse and easier testing.
 */
export function normalizePath(filePath: unknown, logger: ILogger): string | unknown {
  if (typeof filePath !== 'string') {
    logger.debug('[PATH DEBUG] Non-string path, using as-is:', filePath);
    return filePath;
  }

  logger.debug(`[PATH DEBUG] Original path: "${filePath}"`);

  if (filePath === '/project' || filePath === '/project/' || filePath === 'codecrucible') {
    logger.debug('[PATH DEBUG] Repository root placeholder detected, converting to "."');
    return '.';
  }

  if (filePath.startsWith('/project/') && filePath.length > 9) {
    const relativePath = filePath.substring(9);
    logger.debug(
      `[PATH DEBUG] Extracted relative path from placeholder: "${filePath}" → "${relativePath}"`
    );
    filePath = relativePath;
  }

  const normalizedPath = PathUtilities.normalizeAIPath(filePath, {
    allowAbsolute: true,
    allowRelative: true,
    allowTraversal: false,
    basePath: process.cwd(),
  });

  logger.debug(`[PATH DEBUG] Normalized: "${filePath}" → "${normalizedPath}"`);
  return normalizedPath;
}
