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

  getTools(): Array<any> {
    // Return basic filesystem tools
    return [
      {
        id: 'read_file',
        name: 'Read File',
        description: 'Read contents of a file',
        execute: this.readFile.bind(this),
      },
      {
        id: 'write_file',
        name: 'Write File',
        description: 'Write content to a file',
        execute: this.writeFile.bind(this),
      },
      {
        id: 'list_files',
        name: 'List Files',
        description: 'List files in a directory',
        execute: this.listFiles.bind(this),
      },
      {
        id: 'file_exists',
        name: 'File Exists',
        description: 'Check if a file exists',
        execute: this.exists.bind(this),
      },
    ];
  }
}
