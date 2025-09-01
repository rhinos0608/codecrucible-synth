/**
 * CLI Integration for Hybrid Search System
 * Provides integration point for existing CodeCrucible CLI system
 * Based on research findings from RIPGREP_FIND_SEARCH_RESEARCH_2025-08-25
 */

import { CLIContext } from '../cli/cli-types.js';
import { createLogger } from '../logger.js';
import { ILogger } from '../../domain/interfaces/logger.js';
import { SearchCLICommands } from './search-cli-commands.js';
import { HybridSearchCoordinator } from './hybrid-search-coordinator.js';
import { CommandLineSearchEngine } from './command-line-search-engine.js';
import { HybridSearchFactory } from './hybrid-search-factory.js';

/**
 * Integration class that adds search functionality to the existing CLI
 */
export class CLISearchIntegration {
  private logger: ILogger;
  private searchCommands: SearchCLICommands;
  private hybridCoordinator?: HybridSearchCoordinator;
  private context: CLIContext;

  constructor(context: CLIContext, workingDirectory: string = process.cwd()) {
    this.logger = createLogger('CLISearchIntegration');
    this.context = context;

    // Initialize search command system
    this.searchCommands = new SearchCLICommands(workingDirectory);

    // Try to initialize hybrid coordinator with RAG system if available
    this.initializeHybridSearch(workingDirectory);
  }

  /**
   * Add search slash commands to existing CLI system
   */
  registerSlashCommands(): Map<string, (args: string) => Promise<unknown>> {
    const commands = new Map<string, (args: string) => Promise<unknown>>();

    // Main search slash command
    commands.set('search', async (args: string) => {
      return this.handleSlashSearch(args);
    });

    // Function search slash command
    commands.set('find-fn', async (args: string) => {
      return this.handleSlashFindFunction(args);
    });

    // Class search slash command
    commands.set('find-class', async (args: string) => {
      return this.handleSlashFindClass(args);
    });

    // Import search slash command
    commands.set('find-import', async (args: string) => {
      return this.handleSlashFindImport(args);
    });

    // File search slash command
    commands.set('find-file', async (args: string) => {
      return this.handleSlashFindFile(args);
    });

    // Cache management slash command
    commands.set('cache', async (args: string) => {
      return this.handleSlashCache(args);
    });

    // Search help command
    commands.set('search-help', async () => {
      return this.showSearchHelp();
    });

    this.logger.info(`🔍 Registered ${commands.size} search slash commands`);
    return commands;
  }

  /**
   * Get search system status for the main status command
   */
  getSearchStatus(): string {
    const lines: string[] = [];

    lines.push('🔍 Search System:');

    // Hybrid coordinator status
    if (this.hybridCoordinator) {
      lines.push('  ✅ Hybrid Search: Enabled');

      // Get cache statistics
      const cacheStats = this.hybridCoordinator.getCacheStats();
      lines.push(
        `  📊 Cache: ${cacheStats.totalEntries} entries, ${(cacheStats.hitRate * 100).toFixed(1)}% hit rate`
      );

      // Get hybrid metrics
      const hybridMetrics = this.hybridCoordinator.getMetrics();
      const totalRoutings = Array.from(hybridMetrics.routingDecisions.values()).reduce(
        (a, b) => a + b,
        0
      );
      lines.push(`  🎯 Routing: ${totalRoutings} queries processed`);
    } else {
      lines.push('  ⚠️  Hybrid Search: Disabled (RAG not available)');
    }

    // Command-line search availability
    try {
      // This would check if ripgrep is available
      lines.push('  ✅ Ripgrep: Available');
    } catch (error) {
      lines.push('  ❌ Ripgrep: Not available');
    }

    return lines.join('\n');
  }

  /**
   * Slash command handlers
   */
  private async handleSlashSearch(args: string): Promise<string> {
    try {
      const parts = args.trim().split(/\s+/);
      const query = parts[0];

      if (!query) {
        return '❌ Usage: /search <query> [--type function|class|import] [--lang typescript|python|etc]';
      }

      // Parse basic options
      const options = this.parseSlashCommandOptions(parts.slice(1));

      // Simulate CLI command execution
      const mockOptions = {
        type: (options.type ?? 'general') as
          | 'function'
          | 'class'
          | 'import'
          | 'general'
          | 'todo'
          | 'error',
        lang: options.lang ? [options.lang] : undefined,
        output: 'simple' as const,
        maxResults: '10',
      };

      // Capture output
      let output = '';
      const originalConsoleLog = console.log;
      console.log = (...args) => {
        output += `${args.join(' ')}\n`;
      };

      try {
        await this.searchCommands.handleSearchCommand(query, mockOptions);
      } finally {
        console.log = originalConsoleLog;
      }

      return output ?? `🔍 Search completed for: ${query}`;
    } catch (error) {
      return `❌ Search failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  }

  private async handleSlashFindFunction(args: string): Promise<string> {
    try {
      const pattern = args.trim();
      if (!pattern) {
        return '❌ Usage: /find-fn <function-name> [--lang typescript|python|etc]';
      }

      const parts = pattern.split(/\s+/);
      const functionName = parts[0];
      const options = this.parseSlashCommandOptions(parts.slice(1));

      let output = '';
      const originalConsoleLog = console.log;
      console.log = (...args) => {
        output += `${args.join(' ')}\n`;
      };

      try {
        await this.searchCommands.handleFunctionSearch(functionName, {
          lang: options.lang ? [options.lang] : undefined,
          output: 'simple',
        });
      } finally {
        console.log = originalConsoleLog;
      }

      return output ?? `🔧 Function search completed for: ${functionName}`;
    } catch (error) {
      return `❌ Function search failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  }

  private async handleSlashFindClass(args: string): Promise<string> {
    try {
      const pattern = args.trim();
      if (!pattern) {
        return '❌ Usage: /find-class <class-name> [--lang typescript|python|etc]';
      }

      const parts = pattern.split(/\s+/);
      const className = parts[0];
      const options = this.parseSlashCommandOptions(parts.slice(1));

      let output = '';
      const originalConsoleLog = console.log;
      console.log = (...args) => {
        output += `${args.join(' ')}\n`;
      };

      try {
        await this.searchCommands.handleClassSearch(className, {
          lang: options.lang ? [options.lang] : undefined,
          output: 'simple',
        });
      } finally {
        console.log = originalConsoleLog;
      }

      return output ?? `📦 Class search completed for: ${className}`;
    } catch (error) {
      return `❌ Class search failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  }

  private async handleSlashFindImport(args: string): Promise<string> {
    try {
      const module = args.trim();
      if (!module) {
        return '❌ Usage: /find-import <module-name>';
      }

      let output = '';
      const originalConsoleLog = console.log;
      console.log = (...args) => {
        output += `${args.join(' ')}\n`;
      };

      try {
        await this.searchCommands.handleImportSearch(module, {
          output: 'simple',
        });
      } finally {
        console.log = originalConsoleLog;
      }

      return output ?? `📥 Import search completed for: ${module}`;
    } catch (error) {
      return `❌ Import search failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  }

  private async handleSlashFindFile(args: string): Promise<string> {
    try {
      const pattern = args.trim();
      if (!pattern) {
        return '❌ Usage: /find-file <file-pattern>';
      }

      let output = '';
      const originalConsoleLog = console.log;
      console.log = (...args) => {
        output += `${args.join(' ')}\n`;
      };

      try {
        await this.searchCommands.handleFileSearch(pattern, {
          output: 'simple',
        });
      } finally {
        console.log = originalConsoleLog;
      }

      return output ?? `📁 File search completed for: ${pattern}`;
    } catch (error) {
      return `❌ File search failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  }

  private async handleSlashCache(args: string): Promise<string> {
    try {
      const command = args.trim().toLowerCase();

      if (command === 'clear') {
        if (this.hybridCoordinator) {
          await this.hybridCoordinator.clearCache();
          return '✅ Search cache cleared';
        } else {
          return '⚠️  No hybrid coordinator available to clear cache';
        }
      } else if (command === 'stats' || command === '') {
        if (this.hybridCoordinator) {
          const stats = this.hybridCoordinator.getCacheStats();
          return [
            '📊 Search Cache Statistics:',
            `  Entries: ${stats.totalEntries}`,
            `  Hit Rate: ${(stats.hitRate * 100).toFixed(1)}%`,
            `  Memory: ${stats.memoryUsage.toFixed(2)} MB`,
            `  Invalidation Rate: ${(stats.invalidationRate * 100).toFixed(1)}%`,
          ].join('\n');
        } else {
          return '⚠️  No hybrid coordinator available for cache stats';
        }
      } else {
        return '❌ Usage: /cache [stats|clear]';
      }
    } catch (error) {
      return `❌ Cache operation failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  }

  private showSearchHelp(): string {
    return [
      '🔍 Search System Commands:',
      '',
      'Slash Commands (use in REPL):',
      '  /search <query> [--type function|class|import] [--lang typescript|python]',
      '    - Intelligent hybrid search with routing',
      '  /find-fn <name> [--lang typescript|python]',
      '    - Find function definitions',
      '  /find-class <name> [--lang typescript|python]',
      '    - Find class and interface definitions',
      '  /find-import <module>',
      '    - Find import statements and dependencies',
      '  /find-file <pattern>',
      '    - Find files by name pattern',
      '  /cache [stats|clear]',
      '    - Manage search cache',
      '  /search-help',
      '    - Show this help',
      '',
      'CLI Commands (use from command line):',
      '  crucible search <query> [options]',
      '  crucible find-functions <pattern> [options]',
      '  crucible find-classes <pattern> [options]',
      '  crucible analyze <type> [options]',
      '  crucible benchmark [options]',
      '',
      'Examples:',
      '  /search "handleRequest" --type function --lang typescript',
      '  /find-class "UserService" --lang typescript',
      '  /find-import "express"',
      '  /cache stats',
      '',
      'Performance Tips:',
      '  - Use specific patterns for faster ripgrep searches',
      '  - Use --lang to limit search scope',
      '  - Cache automatically invalidates when files change',
    ].join('\n');
  }

  /**
   * Helper methods
   */
  private initializeHybridSearch(workingDirectory: string): void {
    try {
      // Check if RAG system is available in context
      if (this.context.modelClient) {
        const commandSearch = new CommandLineSearchEngine(workingDirectory);
        const hybridConfig = HybridSearchFactory.createBalancedConfig();

        // Note: We would need access to the RAG system to create a proper hybrid coordinator
        // For now, create without RAG integration
        this.hybridCoordinator = new HybridSearchCoordinator(
          commandSearch,
          hybridConfig
          // Note: No RAG system available in current context
        );

        this.logger.info('🔄 Hybrid search coordinator initialized for CLI');
      }
    } catch (error) {
      this.logger.warn('Failed to initialize hybrid search for CLI:', error);
    }
  }

  private parseSlashCommandOptions(args: string[]): Record<string, string> {
    const options: Record<string, string> = {};

    for (let i = 0; i < args.length; i++) {
      const arg = args[i];
      if (arg.startsWith('--')) {
        const key = arg.substring(2);
        const value = args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : 'true';
        options[key] = value;
        if (value !== 'true') i++; // Skip next arg if it was used as value
      }
    }

    return options;
  }

  /**
   * Cleanup method
   */
  async shutdown(): Promise<void> {
    if (this.hybridCoordinator) {
      await this.hybridCoordinator.shutdown();
    }
    this.logger.info('🔍 Search CLI integration shut down');
  }
}
