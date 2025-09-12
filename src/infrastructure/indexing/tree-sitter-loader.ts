import type ParserNS from 'web-tree-sitter';
import { existsSync } from 'fs';
import { join } from 'path';
import { ProjectPaths } from '../../utils/project-paths.js';
import { logger } from '../logging/logger.js';

type TSParser = typeof ParserNS;

export type SupportedTSLang = 'go' | 'rust' | 'java' | 'csharp' | 'ruby';

class TreeSitterManager {
  private parserLib: TSParser | null = null;
  private languages = new Map<SupportedTSLang, any>();
  private initialized = false;

  public async init(): Promise<boolean> {
    if (this.initialized) return true;
    try {
      // Dynamic import to avoid hard dependency when unused
      const Parser = (await import('web-tree-sitter')) as unknown as TSParser;
      await Parser.init();
      this.parserLib = Parser;
      this.initialized = true;
      return true;
    } catch (error) {
      logger.warn('Tree-sitter initialization failed; AST chunking for extra languages disabled', {
        error: (error as Error)?.message,
      });
      return false;
    }
  }

  private wasmPath(lang: SupportedTSLang): string {
    // Look under vendor/ts-wasm for shipped grammars
    // Filenames expected:
    //  - tree-sitter-go.wasm
    //  - tree-sitter-rust.wasm
    //  - tree-sitter-java.wasm
    //  - tree-sitter-c_sharp.wasm (common naming)
    //  - tree-sitter-ruby.wasm
    const base = ProjectPaths.resolveFromRoot('vendor/ts-wasm');
    const fileMap: Record<SupportedTSLang, string[]> = {
      go: ['tree-sitter-go.wasm'],
      rust: ['tree-sitter-rust.wasm'],
      java: ['tree-sitter-java.wasm'],
      csharp: ['tree-sitter-c_sharp.wasm', 'tree-sitter-csharp.wasm'],
      ruby: ['tree-sitter-ruby.wasm'],
    };
    for (const name of fileMap[lang]) {
      const p = join(base, name);
      if (existsSync(p)) return p;
    }
    return join(base, `tree-sitter-${lang}.wasm`);
  }

  public async getLanguage(lang: SupportedTSLang): Promise<any | null> {
    if (!this.initialized) {
      const ok = await this.init();
      if (!ok) return null;
    }
    if (this.languages.has(lang)) return this.languages.get(lang) ?? null;
    try {
      const Parser = this.parserLib!;
      const langPath = this.wasmPath(lang);
      const language = await (Parser as any).Language.load(langPath);
      this.languages.set(lang, language);
      return language;
    } catch (error) {
      logger.warn(`Tree-sitter language load failed for ${lang}`, {
        error: (error as Error)?.message,
      });
      return null;
    }
  }

  public async parse(lang: SupportedTSLang, code: string): Promise<{ rootNode: any; parser: any } | null> {
    const Parser = this.parserLib;
    if (!Parser) return null;
    const language = await this.getLanguage(lang);
    if (!language) return null;
    const parser = new (Parser as any)();
    parser.setLanguage(language);
    const tree = parser.parse(code);
    return { rootNode: tree.rootNode, parser };
  }
}

export const tsManager = new TreeSitterManager();

export default tsManager;

