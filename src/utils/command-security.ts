import fs from 'fs';
import path from 'path';

let allowedCommands: string[] = [];
const envAllowlist = process.env.COMMAND_ALLOWLIST;

if (envAllowlist) {
  allowedCommands = envAllowlist
    .split(',')
    .map(cmd => cmd.trim())
    .filter(Boolean);
} else if (process.env.COMMAND_ALLOWLIST_FILE) {
  const allowlistPath = path.resolve(process.cwd(), process.env.COMMAND_ALLOWLIST_FILE);
  try {
    const data = fs.readFileSync(allowlistPath, 'utf-8');
    allowedCommands = JSON.parse(data);
  } catch (err) {
    console.error(`Failed to load allowlist from ${allowlistPath}:`, err);
    allowedCommands = [];
  }
}

const dangerousPatterns = [/^rm\b/, /\bsudo\b/, /\bdel\b/, /&&/, /\|\|/, /;|\n/, /`/];

export function validateCommand(command: string): { isValid: boolean; reason?: string } {
  if (!command || command.trim() === '') {
    return { isValid: false, reason: 'Empty command' };
  }

  for (const pattern of dangerousPatterns) {
    if (pattern.test(command)) {
      return { isValid: false, reason: 'Command contains forbidden pattern' };
    }
  }

  const baseCommand = command.split(' ')[0];
  if (!allowedCommands.includes(baseCommand)) {
    return { isValid: false, reason: `Command not allowed: ${baseCommand}` };
  }

  return { isValid: true };
}

export function isCommandAllowed(command: string): boolean {
  return allowedCommands.includes(command);
}
