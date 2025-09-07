export function validateBranchName(name: string): boolean {
  return /^[\w\-\/]+$/.test(name);
}

export function ensureSafeArg(arg: string): void {
  if (arg.includes('..') || arg.includes('--')) {
    throw new Error('Unsafe git argument');
  }
}
