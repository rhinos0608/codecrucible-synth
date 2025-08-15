import { join, relative, isAbsolute } from 'path';

function resolvePath(path: string, workingDirectory: string): string {
  // Convert to relative path to comply with MCP workspace restrictions
  let resolvedPath = path;
  
  // If path is absolute, convert to relative to working directory
  if (isAbsolute(path)) {
    try {
      resolvedPath = relative(workingDirectory, path);
      // If relative path starts with '..' it's outside working directory
      if (resolvedPath.startsWith('..')) {
        throw new Error(`Path ${path} is outside working directory`);
      }
    } catch (error) {
      // Fallback to using the path as-is but log the issue
      console.warn(`⚠️  Path conversion warning: ${error instanceof Error ? error.message : 'Unknown error'}`);
      resolvedPath = path;
    }
  }
  
  // Join with working directory to ensure proper resolution
  return join(workingDirectory, resolvedPath);
}

// Test cases
const workingDir = 'C:\\Users\\Admin\\Documents\\RST\\CodeCrucibleSynth';
const testCases = [
  'test.txt',
  'src/index.ts',
  'C:\\Users\\Admin\\Documents\\RST\\CodeCrucibleSynth\\src\\index.ts',
  'C:\\Users\\Admin\\Documents\\other\\file.txt'
];

console.log('Testing path resolution:');
testCases.forEach(testCase => {
  try {
    const result = resolvePath(testCase, workingDir);
    console.log(`  ${testCase} -> ${result}`);
  } catch (error) {
    console.log(`  ${testCase} -> Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
});