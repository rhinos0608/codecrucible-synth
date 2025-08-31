typescript: src/config.ts
import * as fs from 'fs';

async function loadConfig(): Promise<Record<string, any>> {
  const configFile = './config.json';
  if (!fs.existsSync(configFile)) {
    throw new Error(`Configuration file not found at ${configFile}`);
  }
  return JSON.parse(fs.readFileSync(configFile, 'utf8'));
}

export default { loadConfig };