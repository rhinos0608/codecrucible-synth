/**
 * Safe JSON Serialization Utility
 *
 * Prevents "Converting circular structure to JSON" errors by handling circular references,
 * functions, symbols, and other non-serializable values safely.
 *
 * Addresses Issue: Unsafe result serialization in MCPServerManager.executeTool
 */

export interface SafeSerializationOptions {
  /** Maximum depth to traverse when serializing nested objects */
  maxDepth?: number;
  /** Maximum string length for truncation */
  maxStringLength?: number;
  /** Whether to include function information */
  includeFunctions?: boolean;
  /** Custom replacer for specific value types */
  customReplacer?: (key: string, value: unknown) => unknown;
  /** Whether to show detailed type information for non-serializable values */
  showTypeInfo?: boolean;
}

const DEFAULT_OPTIONS: Required<SafeSerializationOptions> = {
  maxDepth: 10,
  maxStringLength: 1000,
  includeFunctions: false,
  customReplacer: (key, value) => value,
  showTypeInfo: true,
};

/**
 * Safely serialize any value to JSON string, handling circular references and non-serializable types
 */
export function safeStringify(value: unknown, options: SafeSerializationOptions = {}): string {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const seen = new WeakSet<object>();
  let currentDepth = 0;

  const replacer = (key: string, val: unknown): unknown => {
    // Apply custom replacer first
    val = opts.customReplacer(key, val);

    // Handle circular references
    if (val !== null && typeof val === 'object') {
      if (seen.has(val)) {
        return opts.showTypeInfo
          ? { [Symbol.toStringTag]: '[Circular Reference]', key }
          : '[Circular]';
      }
      seen.add(val);
    }

    // Handle depth limit
    currentDepth++;
    if (currentDepth > opts.maxDepth && val !== null && typeof val === 'object') {
      currentDepth--;
      return opts.showTypeInfo
        ? { [Symbol.toStringTag]: '[Max Depth Reached]', type: typeof val }
        : '[MaxDepth]';
    }

    // Handle different value types safely
    if (val === undefined) {
      return opts.showTypeInfo ? '[Undefined]' : null;
    }

    if (typeof val === 'function') {
      if (opts.includeFunctions) {
        return opts.showTypeInfo
          ? { [Symbol.toStringTag]: '[Function]', name: val.name || 'anonymous' }
          : '[Function]';
      }
      return opts.showTypeInfo ? '[Function]' : null;
    }

    if (typeof val === 'symbol') {
      return opts.showTypeInfo
        ? { [Symbol.toStringTag]: '[Symbol]', description: val.description }
        : val.toString();
    }

    if (typeof val === 'bigint') {
      return opts.showTypeInfo
        ? { [Symbol.toStringTag]: '[BigInt]', value: val.toString() }
        : val.toString();
    }

    if (typeof val === 'string' && val.length > opts.maxStringLength) {
      const truncated = val.substring(0, opts.maxStringLength);
      return opts.showTypeInfo
        ? {
            [Symbol.toStringTag]: '[Truncated String]',
            value: truncated,
            originalLength: val.length,
          }
        : `${truncated}...[truncated]`;
    }

    if (val instanceof Error) {
      return {
        [Symbol.toStringTag]: '[Error]',
        name: val.name,
        message: val.message,
        stack: opts.showTypeInfo ? val.stack : undefined,
      };
    }

    if (val instanceof Date) {
      return {
        [Symbol.toStringTag]: '[Date]',
        value: val.toISOString(),
      };
    }

    if (val instanceof RegExp) {
      return {
        [Symbol.toStringTag]: '[RegExp]',
        pattern: val.source,
        flags: val.flags,
      };
    }

    if (val instanceof Map) {
      return {
        [Symbol.toStringTag]: '[Map]',
        entries: Array.from(val.entries()),
      };
    }

    if (val instanceof Set) {
      return {
        [Symbol.toStringTag]: '[Set]',
        values: Array.from(val.values()),
      };
    }

    if (ArrayBuffer.isView(val)) {
      const isDataView = typeof DataView !== 'undefined' && val instanceof DataView;
      const typedArrayLength =
        !isDataView && typeof (val as unknown as { length?: number }).length === 'number'
          ? (val as unknown as { length: number }).length
          : undefined;
      return {
        [Symbol.toStringTag]: isDataView ? '[DataView]' : '[TypedArray]',
        type: (val as { constructor?: { name?: string } }).constructor?.name ?? 'ArrayBufferView',
        ...(typedArrayLength !== undefined ? { length: typedArrayLength } : {}),
        byteLength: val.byteLength,
        buffer: `[ArrayBuffer ${val.byteLength} bytes]`,
      };
    }

    if (val instanceof ArrayBuffer) {
      return {
        [Symbol.toStringTag]: '[ArrayBuffer]',
        byteLength: val.byteLength,
      };
    }

    // Reset depth counter when going back up
    if (typeof val === 'object' && val !== null) {
      setTimeout(() => {
        currentDepth--;
      }, 0);
    }

    return val;
  };

  try {
    return JSON.stringify(value, replacer, 2);
  } catch (error) {
    // Final fallback for any remaining serialization errors
    return JSON.stringify(
      {
        [Symbol.toStringTag]: '[Serialization Error]',
        error: error instanceof Error ? error.message : String(error),
        type: typeof value,
        constructor: value?.constructor?.name,
      },
      null,
      2
    );
  }
}

/**
 * Safely parse a JSON string, handling any parsing errors gracefully
 */
export function safeParse<T = unknown>(
  json: string
): { success: true; data: T } | { success: false; error: string } {
  try {
    const parsed = JSON.parse(json);
    return { success: true, data: parsed };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Create a safe version of an object for serialization by removing circular references
 * and non-serializable values
 */
type Serializable = Record<string, unknown> | unknown[] | string | number | boolean | null;

export function createSerializableObject(
  obj: unknown,
  options: SafeSerializationOptions = {}
): Serializable {
  if (obj === null || obj === undefined) {
    return null;
  }

  if (typeof obj !== 'object') {
    // Handle primitives and non-objects
    if (typeof obj === 'function') {
      return options.includeFunctions ? `[Function: ${obj.name || 'anonymous'}]` : null;
    }
    if (typeof obj === 'symbol') {
      return `[Symbol: ${obj.description || 'unnamed'}]`;
    }
    if (typeof obj === 'bigint') {
      return obj.toString();
    }
    return obj as string | number | boolean;
  }

  const opts = { ...DEFAULT_OPTIONS, ...options };
  const seen = new WeakSet<object>();

  const processValue = (value: unknown, depth: number): Serializable => {
    if (depth > opts.maxDepth) {
      return '[MaxDepth]';
    }

    if (value === null || value === undefined) {
      return null;
    }

    if (typeof value !== 'object') {
      if (typeof value === 'function') {
        return opts.includeFunctions ? (`[Function: ${(value as Function).name}]` as const) : null;
      }
      if (typeof value === 'symbol') {
        return `[Symbol: ${(value as symbol).description}]`;
      }
      if (typeof value === 'bigint') {
        return (value as bigint).toString();
      }
      if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
        return value;
      }
      return null;
    }

    if (seen.has(value)) {
      return '[Circular]';
    }
    seen.add(value);

    if (Array.isArray(value)) {
      return value.map((item, index) => {
        try {
          return processValue(item, depth + 1);
        } catch {
          return `[Error processing array item ${index}]`;
        }
      });
    }

    if (value instanceof Error) {
      return {
        type: 'Error',
        name: value.name,
        message: value.message,
        ...(opts.showTypeInfo && { stack: value.stack }),
      };
    }

    if (value instanceof Date) {
      return { type: 'Date', value: value.toISOString() };
    }

    if (value instanceof RegExp) {
      return { type: 'RegExp', pattern: value.source, flags: value.flags };
    }

    // Handle plain objects
    const result: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value)) {
      try {
        result[key] = processValue(val, depth + 1);
      } catch {
        result[key] = '[Error processing property]';
      }
    }

    seen.delete(value);
    return result;
  };

  return processValue(obj, 0);
}

/**
 * Safe logger utility that prevents circular reference errors in log statements
 */
export function createSafeLogger() {
  return {
    stringify: (value: unknown, options?: SafeSerializationOptions): string =>
      safeStringify(value, options),

    serialize: (value: unknown, options?: SafeSerializationOptions): unknown =>
      createSerializableObject(value, options),

    toLogSafe: (value: unknown): string =>
      safeStringify(value, { maxDepth: 5, maxStringLength: 200, showTypeInfo: false }),
  };
}

// Export a default instance for convenience
export const safeLogger = createSafeLogger();
