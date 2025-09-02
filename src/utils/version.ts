import { readFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

let cachedVersion: string | undefined;

export async function getVersion(): Promise<string> {
  if (cachedVersion) {
    return cachedVersion;
  }

  try {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    const packagePath = join(__dirname, '..', '..', 'package.json');
    const packageData = await readFile(packagePath, 'utf-8');
    const { version } = JSON.parse(packageData) as { version?: string };

    if (typeof version !== 'string') {
      throw new Error('Version not found in package.json');
    }

    cachedVersion = version;
    return version;
  } catch {
    return 'unknown';
  }
}
