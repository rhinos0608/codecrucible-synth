export function validateBranchName(name: string): boolean {
  // Allow alphanumeric, underscore, dash, and slash in branch names
  return /^[\w\-/]+$/.test(name);
}

export function ensureSafeArg(arg: string): void {
  // Block path traversal, double-dash, and dangerous shell metacharacters
  if (arg.includes('..') || arg.includes('--') || /[;|&`$><]/.test(arg)) {
    throw new Error('Unsafe git argument');
  }
}
