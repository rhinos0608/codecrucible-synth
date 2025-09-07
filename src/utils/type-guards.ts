/**
 * Type Guards and Type Assertions
 * Utility functions for safe type conversions to reduce TypeScript compilation errors
 */

/**
 * Safely converts an unknown value to an Error instance
 */
export function toError(value: unknown): Error {
  if (value instanceof Error) {
    return value;
  }
  if (typeof value === 'string') {
    return new Error(value);
  }
  if (value && typeof value === 'object') {
    const message = 'message' in value && typeof value.message === 'string' 
      ? value.message 
      : JSON.stringify(value);
    return new Error(message);
  }
  return new Error(String(value));
}

/**
 * Safely converts an unknown value to a Record<string, unknown>
 */
export function toRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return { value };
}

/**
 * Safely converts an unknown value to a readonly Record<string, unknown>
 */
export function toReadonlyRecord(value: unknown): Readonly<Record<string, unknown>> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Readonly<Record<string, unknown>>;
  }
  return { value };
}

/**
 * Checks if a value is a Record<string, unknown>
 */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Checks if a value is a string array
 */
export function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(item => typeof item === 'string');
}

/**
 * Converts string array to record for logging purposes
 */
export function stringArrayToRecord(arr: string[]): Record<string, unknown> {
  return arr.reduce((acc, item, index) => {
    acc[`item_${index}`] = item;
    return acc;
  }, {} as Record<string, unknown>);
}

/**
 * Safely converts an unknown value to Error | undefined for logger.error calls
 */
export function toErrorOrUndefined(value: unknown): Error | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  return toError(value);
}

/**
 * Safely converts string | undefined to proper type for logger calls
 */
export function stringToRecord(value: string | undefined): Readonly<Record<string, unknown>> | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  return { value };
}