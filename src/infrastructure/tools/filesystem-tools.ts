/**
 * Filesystem Tools - Compatibility Stub
 * 
 * This is a minimal stub to maintain backward compatibility
 * during the architectural migration.
 * 
 * @deprecated Use domain tools instead
 */

export class FilesystemTools {
  async readFile(path: string): Promise<string> {
    // Stub implementation
    return '';
  }

  async writeFile(path: string, content: string): Promise<void> {
    // Stub implementation
    console.log(`Writing file: ${path}`);
  }

  async listFiles(directory: string): Promise<string[]> {
    // Stub implementation
    return [];
  }

  async exists(path: string): Promise<boolean> {
    // Stub implementation
    return false;
  }
}