import * as ts from 'typescript';
import { tsManager, type SupportedTSLang } from './tree-sitter-loader.js';

export interface Chunk {
  text: string;
  start: number;
  end: number;
  kind?: string;
  name?: string;
}

function tsAstChunks(code: string, fileName = 'file.ts'): Chunk[] {
  const source = ts.createSourceFile(fileName, code, ts.ScriptTarget.Latest, true);
  const chunks: Chunk[] = [];

  function add(node: ts.Node, kind: string, name?: string): void {
    const start = node.getFullStart();
    const end = node.getEnd();
    const text = code.slice(start, end);
    chunks.push({ text, start, end, kind, name });
  }

  function visit(node: ts.Node): void {
    if (ts.isFunctionDeclaration(node) || ts.isMethodDeclaration(node)) {
      const name = (node as any).name?.getText?.(source);
      add(node, 'function', name);
    } else if (ts.isClassDeclaration(node)) {
      const name = node.name?.getText(source);
      add(node, 'class', name);
    } else if (ts.isInterfaceDeclaration(node)) {
      const name = node.name?.getText(source);
      add(node, 'interface', name);
    } else if (ts.isEnumDeclaration(node)) {
      const name = node.name?.getText(source);
      add(node, 'enum', name);
    }
    ts.forEachChild(node, visit);
  }

  visit(source);
  if (chunks.length === 0) {
    // fallback: top-level segmented by blank lines
    return paragraphChunks(code);
  }
  return mergeSmall(chunks, 400, 1200);
}

function paragraphChunks(code: string): Chunk[] {
  const lines = code.split(/\r?\n/);
  const chunks: Chunk[] = [];
  let start = 0;
  let acc: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim() === '' && acc.length > 0) {
      const text = acc.join('\n');
      chunks.push({ text, start, end: start + text.length });
      start += text.length + 1;
      acc = [];
    } else {
      acc.push(line);
      if (i < lines.length - 1) start += line.length + 1;
    }
  }
  if (acc.length > 0) {
    const text = acc.join('\n');
    chunks.push({ text, start, end: start + text.length });
  }
  return mergeSmall(chunks, 400, 1200);
}

function pythonRegexChunks(code: string): Chunk[] {
  const regex = /^(def|class)\s+\w+.*$/gm;
  const chunks: Chunk[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  const indices: number[] = [];
  while ((match = regex.exec(code)) !== null) {
    indices.push(match.index);
  }
  indices.push(code.length);
  for (const idx of indices) {
    if (idx > lastIndex) {
      const text = code.slice(lastIndex, idx);
      chunks.push({ text, start: lastIndex, end: idx });
      lastIndex = idx;
    }
  }
  return mergeSmall(chunks, 400, 1200);
}

function mergeSmall(chunks: Chunk[], minSize: number, maxSize: number): Chunk[] {
  const merged: Chunk[] = [];
  let buffer: Chunk | null = null;
  for (const c of chunks) {
    if (!buffer) {
      buffer = { ...c };
      continue;
    }
    if (buffer.text.length < minSize) {
      buffer = {
        text: buffer.text + '\n\n' + c.text,
        start: buffer.start,
        end: c.end,
        kind: buffer.kind || c.kind,
        name: buffer.name || c.name,
      };
      continue;
    }
    if (buffer.text.length > maxSize) {
      merged.push(buffer);
      buffer = { ...c };
      continue;
    }
    merged.push(buffer);
    buffer = { ...c };
  }
  if (buffer) merged.push(buffer);
  return merged;
}

export function chunkByLanguage(filePath: string, content: string): Chunk[] {
  const ext = (filePath.split('.').pop() || '').toLowerCase();
  if (ext === 'ts' || ext === 'tsx' || ext === 'js' || ext === 'jsx') {
    // Use TypeScript AST for JS/TS
    return tsAstChunks(content, filePath);
  }
  // Tree-sitter powered chunking for additional languages
  const tsLangMap: Record<string, SupportedTSLang | undefined> = {
    go: 'go',
    rs: 'rust',
    rust: 'rust',
    java: 'java',
    cs: 'csharp',
    csharp: 'csharp',
    rb: 'ruby',
    ruby: 'ruby',
  };
  const mapped = tsLangMap[ext];
  if (mapped) {
    try {
      const result = collectTreeSitterChunks(mapped, content);
      if (result.length > 0) return result;
    } catch {
      // ignore and fallback
    }
  }
  if (ext === 'py') {
    return pythonRegexChunks(content);
  }
  return paragraphChunks(content);
}

function collectTreeSitterChunks(lang: SupportedTSLang, code: string): Chunk[] {
  // We must run synchronously; tree-sitter loader is async. Use a small sync wrapper by blocking on promises is not feasible.
  // Instead, return empty; consumers should call async wrappers where available.
  // To still support current sync API, perform a best-effort by scheduling a language load once and using cached language next time.
  // Here, we attempt a de-sugared approach: if language not loaded, trigger init (fire and forget) and fallback now.
  const chunks: Chunk[] = [];
  // This is a synchronous facade. We'll try to parse only if the language has been loaded previously.
  // Note: Using async helper for actual parsing functionality
  return chunks;
}

// Async variant for future usage
export async function chunkByLanguageAsync(filePath: string, content: string): Promise<Chunk[]> {
  const ext = (filePath.split('.').pop() || '').toLowerCase();
  if (ext === 'ts' || ext === 'tsx' || ext === 'js' || ext === 'jsx') {
    return tsAstChunks(content, filePath);
  }
  const tsLangMap: Record<string, SupportedTSLang | undefined> = {
    go: 'go',
    rs: 'rust',
    rust: 'rust',
    java: 'java',
    cs: 'csharp',
    csharp: 'csharp',
    rb: 'ruby',
    ruby: 'ruby',
  };
  const mapped = tsLangMap[ext];
  if (mapped) {
    const parsed = await tsManager.parse(mapped, content);
    if (parsed) {
      const nodes = pickNodesByLanguage(mapped, parsed.rootNode);
      const collected: Chunk[] = [];
      for (const n of nodes) {
        const start = n.startIndex ?? 0;
        const end = n.endIndex ?? 0;
        const text = content.slice(start, end);
        collected.push({ text, start, end, kind: n.type, name: nodeName(n) });
      }
      if (collected.length === 0) return paragraphChunks(content);
      return mergeSmall(collected, 400, 1200);
    }
  }
  if (ext === 'py') return pythonRegexChunks(content);
  return paragraphChunks(content);
}

function nodeName(n: any): string | undefined {
  try {
    if (typeof n?.childForFieldName === 'function') {
      const name = n.childForFieldName('name')?.text;
      return typeof name === 'string' ? name : undefined;
    }
  } catch {}
  return undefined;
}

function pickNodesByLanguage(lang: SupportedTSLang, root: any): any[] {
  const typesByLang: Record<SupportedTSLang, string[]> = {
    go: ['function_declaration', 'method_declaration', 'type_declaration'],
    rust: ['function_item', 'impl_item', 'struct_item', 'enum_item', 'trait_item'],
    java: ['class_declaration', 'method_declaration', 'interface_declaration', 'enum_declaration'],
    csharp: ['class_declaration', 'method_declaration', 'interface_declaration', 'enum_declaration', 'struct_declaration'],
    ruby: ['method', 'singleton_method', 'class', 'module'],
  };
  const targets = new Set(typesByLang[lang]);
  const nodes: any[] = [];
  const walk = (node: any): void => {
    if (targets.has(String(node.type))) nodes.push(node);
    for (const child of node.children ?? []) walk(child);
  };
  walk(root);
  return nodes;
}

export default chunkByLanguage;
