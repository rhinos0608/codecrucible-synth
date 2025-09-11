/**
 * Core Tool Suite
 *
 * Provides first-class built-in tools for the CLI agent:
 * - bash_run: Execute shell commands (requires explicit consent)
 * - file_read: Read files
 * - file_write: Write files
 * - grep_search: Search for a pattern within files
 * - glob_search: List files matching glob patterns
 * - agent_spawn: Spawn an internal sub-agent (placeholder)
 */

import { promises as fs } from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import micromatch from 'micromatch';
import { ToolDefinition } from './tool-integration.js';
import type {
  ToolExecutionContext,
  ToolExecutionResult,
} from '../../domain/interfaces/tool-execution.js';
import { createToolResult } from '../../utils/tool-result.js';

function isWithin(baseDir: string, target: string): boolean {
  const rel = path.relative(baseDir, target);
  return !!rel && !rel.startsWith('..') && !path.isAbsolute(rel);
}

function ensureWorkspacePath(userPath: string, cwd = process.cwd()): string {
  const abs = path.isAbsolute(userPath) ? userPath : path.resolve(cwd, userPath);
  const ws = path.resolve(cwd);
  if (!isWithin(ws, abs) && abs !== ws) {
    throw new Error('Path escapes workspace root');
  }
  return abs;
}

async function collectFiles(dir: string, ignore: readonly string[] = []): Promise<string[]> {
  const out: string[] = [];
  async function walk(current: string): Promise<void> {
    let entries: import('fs').Dirent[];
    try {
      entries = await fs.readdir(current, { withFileTypes: true });
    } catch {
      return;
    }
    for (const ent of entries) {
      const full = path.join(current, ent.name);
      const rel = path.relative(process.cwd(), full);
      if (micromatch.any(rel.replace(/\\/g, '/'), ignore)) continue;
      if (ent.isDirectory()) {
        if (ent.name === 'node_modules' || ent.name.startsWith('.git')) continue;
        await walk(full);
      } else if (ent.isFile()) {
        out.push(full);
      }
    }
  }
  await walk(dir);
  return out;
}

export class CoreToolSuite {
  private consentEnv = 'ALLOW_SHELL_TOOL';

  public getTools(): ReadonlyArray<ToolDefinition> {
    const tools: ToolDefinition[] = [
      {
        id: 'bash_run',
        name: 'bash_run',
        description: 'Run a shell command safely (requires explicit consent)',
        inputSchema: {
          properties: {
            command: { type: 'string', description: 'Command to run (binary or shell builtin)' },
            args: { type: 'array', items: { type: 'string' }, description: 'Arguments list' },
            cwd: { type: 'string', description: 'Working directory (within workspace)' },
            timeoutMs: { type: 'number', description: 'Timeout in milliseconds (default 15000)' },
            consent: { type: 'boolean', description: 'Set true to confirm execution' },
          },
          required: ['command'],
        },
        execute: async (args: Readonly<Record<string, unknown>>): Promise<ToolExecutionResult> => {
          const start = Date.now();
          const consent = Boolean(args.consent) || process.env[this.consentEnv] === 'true';
          if (!consent) {
            return createToolResult({
              success: false,
              error: {
                code: 'CONSENT_REQUIRED',
                message:
                  'Consent required to run shell commands. Pass consent=true or set ALLOW_SHELL_TOOL=true.',
              },
              metadata: { executionTime: Date.now() - start },
            });
          }
          const cmd = String(args.command || '').trim();
          if (!cmd) {
            return createToolResult({
              success: false,
              error: { code: 'VALIDATION_ERROR', message: 'command is required' },
              metadata: { executionTime: Date.now() - start },
            });
          }
          const disallowed = ['rm', 'rmdir', 'del', 'mkfs', 'shutdown', 'reboot'];
          if (disallowed.includes(cmd)) {
            return createToolResult({
              success: false,
              error: { code: 'COMMAND_DISALLOWED', message: `Command '${cmd}' is disallowed` },
              metadata: { executionTime: Date.now() - start },
            });
          }
          const argsList = Array.isArray(args.args) ? (args.args as unknown[]).map(String) : [];
          const cwd = args.cwd ? ensureWorkspacePath(String(args.cwd)) : process.cwd();
          const timeoutMs = typeof args.timeoutMs === 'number' ? args.timeoutMs : 15000;
          const result = await new Promise<ToolExecutionResult>(resolve => {
            const child = spawn(cmd, argsList, { cwd, shell: process.platform === 'win32' });
            let stdout = '';
            let stderr = '';
            let finished = false;
            const killTimer = setTimeout(() => {
              if (finished) return;
              finished = true;
              child.kill('SIGKILL');
              resolve(
                createToolResult({
                  success: false,
                  error: { code: 'TIMEOUT', message: `Command timed out after ${timeoutMs}ms` },
                  metadata: { executionTime: Date.now() - start },
                })
              );
            }, timeoutMs);
            child.stdout?.on('data', (d: Buffer) => {
              stdout += d.toString();
            });
            child.stderr?.on('data', (d: Buffer) => {
              stderr += d.toString();
            });
            child.on('error', err => {
              if (finished) return;
              finished = true;
              clearTimeout(killTimer);
              resolve(
                createToolResult({
                  success: false,
                  error: { code: 'SPAWN_ERROR', message: err.message },
                  metadata: { executionTime: Date.now() - start },
                })
              );
            });
            child.on('close', code => {
              if (finished) return;
              finished = true;
              clearTimeout(killTimer);
              resolve(
                createToolResult({
                  success: code === 0,
                  data: { code, stdout, stderr },
                  metadata: { executionTime: Date.now() - start },
                })
              );
            });
          });
          return result;
        },
      },
      {
        id: 'file_read',
        name: 'file_read',
        description: 'Read the contents of a file',
        inputSchema: {
          properties: {
            path: { type: 'string', description: 'Path to file' },
            encoding: { type: 'string' },
          },
          required: ['path'],
        },
        execute: async (
          args: Readonly<Record<string, unknown>>
        ): Promise<ToolExecutionResult<string>> => {
          const start = Date.now();
          const p = ensureWorkspacePath(String(args.path || ''));
          const enc = (args.encoding as string) || 'utf-8';
          let content: string;
          try {
            content = await fs.readFile(p, enc as BufferEncoding);
          } catch (err) {
            return createToolResult({
              success: false,
              error: { code: 'READ_FAILED', message: (err as Error).message },
              metadata: { executionTime: Date.now() - start },
            });
          }
          return createToolResult({
            success: true,
            data: content,
            metadata: { executionTime: Date.now() - start },
          });
        },
      },
      {
        id: 'file_write',
        name: 'file_write',
        description: 'Write content to a file',
        inputSchema: {
          properties: {
            path: { type: 'string' },
            content: { type: 'string' },
            encoding: { type: 'string' },
          },
          required: ['path', 'content'],
        },
        execute: async (
          args: Readonly<Record<string, unknown>>
        ): Promise<ToolExecutionResult<string>> => {
          const start = Date.now();
          const p = ensureWorkspacePath(String(args.path || ''));
          const enc = (args.encoding as string) || 'utf-8';
          await fs.mkdir(path.dirname(p), { recursive: true });
          await fs.writeFile(p, String(args.content ?? ''), enc as BufferEncoding);
          return createToolResult({
            success: true,
            data: `Wrote ${p}`,
            metadata: { executionTime: Date.now() - start },
          });
        },
      },
      {
        id: 'glob_search',
        name: 'glob_search',
        description: 'Find files matching glob patterns within the workspace',
        inputSchema: {
          properties: {
            patterns: { type: 'array', items: { type: 'string' }, description: 'Glob patterns' },
            cwd: { type: 'string' },
            ignore: { type: 'array', items: { type: 'string' } },
            maxResults: { type: 'number' },
          },
          required: ['patterns'],
        },
        execute: async (
          args: Readonly<Record<string, unknown>>
        ): Promise<ToolExecutionResult<string[]>> => {
          const start = Date.now();
          const cwd = ensureWorkspacePath(String(args.cwd || process.cwd()));
          const ignore = Array.isArray(args.ignore)
            ? (args.ignore as string[])
            : ['**/node_modules/**', '**/.git/**'];
          const all = await collectFiles(cwd, ignore);
          const pats = (args.patterns as string[]).map(s => s.replace(/\\/g, '/'));
          const matches = micromatch(
            all.map(f => path.relative(cwd, f).replace(/\\/g, '/')),
            pats,
            { ignore }
          );
          const maxResults = typeof args.maxResults === 'number' ? args.maxResults : 5000;
          const resolved = matches.slice(0, maxResults).map(rel => path.resolve(cwd, rel));
          return createToolResult({
            success: true,
            data: resolved,
            metadata: { executionTime: Date.now() - start },
          });
        },
      },
      {
        id: 'grep_search',
        name: 'grep_search',
        description: 'Search for a pattern within files',
        inputSchema: {
          properties: {
            pattern: { type: 'string', description: 'Regex or literal pattern' },
            files: {
              type: 'array',
              items: { type: 'string' },
              description: 'Explicit files to search',
            },
            glob: {
              type: 'array',
              items: { type: 'string' },
              description: 'Glob patterns if files not provided',
            },
            literal: { type: 'boolean', description: 'Treat pattern as literal instead of regex' },
            ignore: { type: 'array', items: { type: 'string' } },
            maxResults: { type: 'number' },
          },
          required: ['pattern'],
        },
        execute: async (
          args: Readonly<Record<string, unknown>>
        ): Promise<ToolExecutionResult<Array<{ file: string; line: number; text: string }>>> => {
          const start = Date.now();
          const pattern = String(args.pattern || '');
          const ignore = Array.isArray(args.ignore)
            ? (args.ignore as string[])
            : ['**/node_modules/**', '**/.git/**'];
          let files: string[] = [];
          if (Array.isArray(args.files) && (args.files as string[]).length > 0) {
            files = (args.files as string[]).map(p => ensureWorkspacePath(p));
          } else if (Array.isArray(args.glob) && (args.glob as string[]).length > 0) {
            const all = await collectFiles(process.cwd(), ignore);
            const pats = (args.glob as string[]).map(s => s.replace(/\\/g, '/'));
            const rels = micromatch(
              all.map(f => path.relative(process.cwd(), f).replace(/\\/g, '/')),
              pats,
              { ignore }
            );
            files = rels.map(r => path.resolve(process.cwd(), r));
          } else {
            files = await collectFiles(process.cwd(), ignore);
          }
          const maxResults = typeof args.maxResults === 'number' ? args.maxResults : 1000;
          const results: Array<{ file: string; line: number; text: string }> = [];
          const literal = Boolean(args.literal);
          const regex = literal ? null : new RegExp(pattern, 'i');
          for (const file of files) {
            if (results.length >= maxResults) break;
            let content: string;
            try {
              content = await fs.readFile(file, 'utf-8');
            } catch {
              continue;
            }
            const lines = content.split(/\r?\n/);
            for (let i = 0; i < lines.length && results.length < maxResults; i++) {
              const line = lines[i];
              const match = literal ? line.includes(pattern) : regex!.test(line);
              if (match) {
                results.push({ file, line: i + 1, text: line.slice(0, 500) });
              }
            }
          }
          return createToolResult({
            success: true,
            data: results,
            metadata: { executionTime: Date.now() - start },
          });
        },
      },
      {
        id: 'agent_spawn',
        name: 'agent_spawn',
        description: 'Spawn an internal sub-agent for complex tasks',
        inputSchema: {
          properties: {
            goal: { type: 'string' },
            context: { type: 'object' },
            maxSteps: { type: 'number' },
            maxChars: { type: 'number' },
            model: { type: 'string' },
            provider: { type: 'string' },
          },
          required: ['goal'],
        },
        execute: async (args: Readonly<Record<string, unknown>>): Promise<ToolExecutionResult> => {
          const start = Date.now();
          const goal = String(args.goal || '').trim();
          if (!goal) {
            return createToolResult({
              success: false,
              error: { code: 'VALIDATION_ERROR', message: 'goal is required' },
              metadata: { executionTime: Date.now() - start },
            });
          }

          const { runSubAgent } = await import(
            '../../application/services/orchestrator/sub-agent-runtime.js'
          );
          const result = await runSubAgent(goal, {
            maxSteps: typeof args.maxSteps === 'number' ? (args.maxSteps as number) : undefined,
            maxChars: typeof args.maxChars === 'number' ? (args.maxChars as number) : undefined,
            model: typeof args.model === 'string' ? (args.model as string) : undefined,
            provider: typeof args.provider === 'string' ? (args.provider as string) : undefined,
          });

          return createToolResult({
            success: true,
            data: { content: result.content, steps: result.steps },
            metadata: { executionTime: Date.now() - start },
          });
        },
      },
    ];
    return tools;
  }
}
