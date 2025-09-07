/**
 * File Filter Manager Module
 * 
 * Manages file type filtering, exclusions, and smart filtering
 * based on project context and search requirements.
 */

export interface FileFilterOptions {
  includeExtensions?: string[];
  excludeExtensions?: string[];
  includeTypes?: string[];
  excludeTypes?: string[];
  includePatterns?: string[];
  excludePatterns?: string[];
  maxFileSize?: number;
  includeBinary?: boolean;
  followSymlinks?: boolean;
  respectGitignore?: boolean;
  customRules?: FilterRule[];
}

export interface FilterRule {
  type: 'include' | 'exclude';
  pattern: string;
  reason?: string;
  priority?: number;
}

export class FileFilterManager {
  private static readonly TYPE_MAPPINGS: Record<string, string[]> = {
    code: ['js', 'ts', 'jsx', 'tsx', 'py', 'java', 'cpp', 'c', 'rs', 'go', 'rb', 'php', 'cs'],
    web: ['html', 'css', 'scss', 'less', 'js', 'ts', 'jsx', 'tsx', 'vue', 'svelte'],
    docs: ['md', 'txt', 'rst', 'org', 'tex', 'pdf', 'docx'],
    config: ['json', 'yaml', 'yml', 'toml', 'ini', 'conf', 'cfg'],
    data: ['csv', 'xml', 'json', 'sql', 'db'],
    logs: ['log', 'out', 'err'],
  };

  public static applyFilters(
    baseOptions: Readonly<FileFilterOptions>,
    filterOptions: Readonly<FileFilterOptions>
  ): FileFilterOptions {
    const options: FileFilterOptions = { ...baseOptions };

    // Apply type-based filtering
    if (filterOptions.includeTypes && filterOptions.includeTypes.length > 0) {
      const extensions = this.expandTypes(filterOptions.includeTypes);
      options.includeExtensions = extensions;
    }

    if (filterOptions.excludeTypes && filterOptions.excludeTypes.length > 0) {
      const extensions = this.expandTypes(filterOptions.excludeTypes);
      options.excludeExtensions = extensions;
    }

    // Apply extension filtering
    if (filterOptions.includeExtensions && filterOptions.includeExtensions.length > 0) {
      options.includePatterns = filterOptions.includeExtensions.map(ext => `*.${ext}`);
    }

    if (filterOptions.excludeExtensions && filterOptions.excludeExtensions.length > 0) {
      options.excludePatterns = filterOptions.excludeExtensions.map(ext => `*.${ext}`);
    }

    return options;
  }

  private static expandTypes(types: ReadonlyArray<string>): string[] {
    const expanded = new Set<string>();
    for (const type of types) {
      const extensions = this.TYPE_MAPPINGS[type] ?? [type];
      extensions.forEach(ext => expanded.add(ext));
    }
    return Array.from(expanded);
  }
}