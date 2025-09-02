import { dirname } from 'path';
import type { UnifiedConfiguration } from '../interfaces/configuration.js';
import { validateConfiguration } from './config-validator.js';

export async function loadConfigFile(filePath: string): Promise<Partial<UnifiedConfiguration>> {
  try {
    const { readFile, access } = await import('fs/promises');
    const { default: YAML } = await import('yaml');
    await access(filePath);
    const content = await readFile(filePath, 'utf-8');
    const parsed = YAML.parse(content) as Partial<UnifiedConfiguration>;
    const validation = validateConfiguration(parsed);
    if (!validation.isValid) {
      throw new Error(`Invalid configuration: ${validation.errors.map(e => e.message).join(', ')}`);
    }
    return parsed;
  } catch {
    return {};
  }
}

export async function saveConfigFile(
  filePath: string,
  config: UnifiedConfiguration
): Promise<void> {
  const { writeFile, mkdir } = await import('fs/promises');
  const { default: YAML } = await import('yaml');
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, YAML.stringify(config), 'utf-8');
}
