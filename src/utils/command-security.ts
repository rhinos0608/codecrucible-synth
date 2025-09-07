import fs from 'fs';
import path from 'path';

let allowedCommands: string[] = [];
const allowlistPath = path.resolve(process.cwd(), 'shared/command-allowlist.json');
try {
  const data = fs.readFileSync(allowlistPath, 'utf-8');
  allowedCommands = JSON.parse(data) as string[];
} catch (err) {
  console.error(`Failed to load allowlist from ${allowlistPath}:`, err);
  allowedCommands = [];
}

const dangerousPatterns = [/\brm\b/, /\bsudo\b/, /\bdel\b/, /&&/, /\|\|/, /;|\n/, /`/];

export function validateCommand(command: string): { isValid: boolean; reason?: string } {
  if (!command || command.trim() === '') {
    return { isValid: false, reason: 'Empty command' };
  }

  for (const pattern of dangerousPatterns) {
    if (pattern.test(command)) {
      return { isValid: false, reason: 'Command contains forbidden pattern' };
    }
  }

  const [baseCommand] = command.split(' ');
  if (!allowedCommands.includes(baseCommand)) {
    return { isValid: false, reason: `Command not allowed: ${baseCommand}` };
  }

  return { isValid: true };
}

export function isCommandAllowed(command: string): boolean {
  return allowedCommands.includes(command);
}
