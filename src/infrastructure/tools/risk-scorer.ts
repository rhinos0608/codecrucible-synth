/**
 * Simple heuristics for estimating risk level and duration of tool calls.
 * Extracted from ToolIntegration for reuse.
 */
export function inferRiskLevel(functionName: string): 'low' | 'medium' | 'high' | 'critical' {
  if (
    functionName.includes('write') ||
    functionName.includes('execute') ||
    functionName.includes('command')
  ) {
    return 'high';
  }
  if (functionName.includes('git') || functionName.includes('npm')) {
    return 'medium';
  }
  return 'low';
}

export function inferDuration(functionName: string): number {
  if (functionName.includes('npm') || functionName.includes('execute')) return 5000; // 5 seconds
  if (functionName.includes('git')) return 2000; // 2 seconds
  return 1000; // 1 second default
}
