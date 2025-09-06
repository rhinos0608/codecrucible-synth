import type { CLIOperationRequest } from '../services/unified-cli-coordinator.js';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { PathUtilities } from '../../utils/path-utilities.js';

interface Enriched {
  context?: {
    timestamp: string;
    cwd: string;
    git?: {
      branch?: string;
      revision?: string;
      user?: string;
      lastCommitDate?: string;
      isDirty?: boolean;
    };
    packageJson?: {
      name?: string;
      version?: string;
      dependenciesCount?: number;
      devDependenciesCount?: number;
    };
    config?: unknown;
    env?: Record<string, string>;
    docs?: {
      summaries: Array<{ file: string; excerpt: string }>;
      totalFiles: number;
    };
    commands?: string[];
    notes?: string[];
  };
}

const MAX_DOC_FILES = 8;
const MAX_DOC_BYTES = 2_500;
const ENV_PREFIXES = ['CODECRUCIBLE_', 'SYNTH_'];

function safeExec(cmd: string): string | undefined {
  try {
    return execSync(cmd, { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
  } catch {
    return undefined;
  }
}

function gatherGitMeta(root: string) {
  if (!fs.existsSync(path.join(root, '.git'))) return undefined;
  const revision = safeExec('git describe --always --dirty') ?? safeExec('git rev-parse --short HEAD');
  const branch = safeExec('git rev-parse --abbrev-ref HEAD');
  const user = safeExec('git config user.name');
  const lastCommitDate = safeExec('git log -1 --format=%cI');
  const isDirty = revision?.includes('-dirty');
  return { branch, revision, user, lastCommitDate, isDirty };
}

function readJSON(file: string): unknown {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return undefined;
  }
}

interface PackageJson {
  name?: string;
  version?: string;
  dependencies?: Record<string, unknown>;
  devDependencies?: Record<string, unknown>;
}

function gatherPackageJson(root: string): {
  name?: string;
  version?: string;
  dependenciesCount?: number;
  devDependenciesCount?: number;
} | undefined {
  const pj = readJSON(path.join(root, 'package.json')) as PackageJson | undefined;
  if (!pj) return undefined;
  return {
    name: pj.name,
    version: pj.version,
    dependenciesCount: pj.dependencies ? Object.keys(pj.dependencies).length : 0,
    devDependenciesCount: pj.devDependencies ? Object.keys(pj.devDependencies).length : 0,
  };
}

function gatherConfig(root: string) {
  const candidates = [
    'codecrucible.config.json',
    '.codecruciblerc',
    '.codecruciblerc.json',
  ];
  for (const c of candidates) {
    const p = path.join(root, c);
    if (fs.existsSync(p)) {
      return readJSON(p) ?? fs.readFileSync(p, 'utf8');
    }
  }
  return undefined;
}

function gatherEnv() {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(process.env)) {
    if (v && ENV_PREFIXES.some(p => k.startsWith(p))) {
      out[k] = v;
    }
  }
  return Object.keys(out).length ? out : undefined;
}

function listCommandNames(root: string) {
  const commandsDir = path.join(root, 'src', 'commands');
  if (!fs.existsSync(commandsDir)) return [];
  const acc: string[] = [];
  const stack: string[] = [commandsDir];
  while (stack.length) {
    const dir = stack.pop();
    if (!dir) continue;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        stack.push(path.join(dir, entry.name));
      } else if (entry.isFile() && /\.(c|m)?tsx?$/.test(entry.name)) {
        acc.push(entry.name.replace(/\.(c|m)?tsx?$/, ''));
      }
    }
  }
  return acc.sort();
}

function gatherDocs(root: string) {
  // Use case-insensitive path resolution for better cross-platform compatibility
  const docsDirCandidates = ['docs', 'Docs', 'documentation'];
  let docsDir: string | null = null;
  
  for (const candidate of docsDirCandidates) {
    docsDir = PathUtilities.resolveCaseInsensitivePath(root, candidate);
    if (docsDir) {
      break;
    }
  }
  
  if (!docsDir) {
    return { summaries: [], totalFiles: 0 };
  }
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) walk(full);
      else if (e.isFile() && /\.(md|mdx|txt)$/i.test(e.name)) files.push(full);
    }
  };
  walk(docsDir);
  const chosen = files.slice(0, MAX_DOC_FILES);
  const summaries = chosen.map(f => {
    let content = '';
    try {
      content = fs.readFileSync(f, 'utf8').slice(0, MAX_DOC_BYTES);
    } catch {
      content = '';
    }
    // crude trimming at line boundary
    const lines = content.split(/\r?\n/).slice(0, 40).join('\n');
    return {
      file: path.relative(root, f),
      excerpt: lines,
    };
  });
  return { summaries, totalFiles: files.length };
}

function createNotes(meta: {
  docs: { totalFiles: number };
  commandsLength: number;
}) {
  const notes: string[] = [];
  if (!meta.docs.totalFiles) notes.push('No docs directory detected');
  if (!meta.commandsLength) notes.push('No commands discovered in src/commands');
  return notes;
}

export function enrichContext(request: CLIOperationRequest): CLIOperationRequest {
  const root = process.cwd();

  const git = gatherGitMeta(root);
  const packageJson = gatherPackageJson(root);
  const config = gatherConfig(root);
  const env = gatherEnv();
  const docs = gatherDocs(root);
  const commands = listCommandNames(root);
  const notes = createNotes({ docs, commandsLength: commands.length });

  const enriched: Enriched = {
    context: {
      timestamp: new Date().toISOString(),
      cwd: root,
      git,
      packageJson,
      config,
      env,
      docs,
      commands,
      notes,
    },
  };

  return { ...request, ...enriched };
}
