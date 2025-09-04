/**
 * Global Types Test Suite - Enterprise Type Safety
 * Testing comprehensive type definitions and error handling
 */

import {
  ApplicationError,
  ValidationError,
  SecurityError,
  NotFoundError,
  RateLimitError,
  Ok,
  Err,
  isError,
  isString,
  isNumber,
  isObject,
  isDefined,
  isNotNull,
} from '../../../src/core/types/global.types';

describe('Enterprise Error Types', () => {
  describe('ApplicationError', () => {
    test('should create application error with all properties', () => {
      const error = new ApplicationError('Test error message', 'TEST_ERROR', 500, {
        additional: 'data',
      });

      expect(error.message).toBe('Test error message');
      expect(error.code).toBe('TEST_ERROR');
      expect(error.statusCode).toBe(500);
      expect(error.details).toEqual({ additional: 'data' });
      expect(error.name).toBe('ApplicationError');
      expect(error instanceof Error).toBe(true);
    });

    test('should have default status code', () => {
      const error = new ApplicationError('Test', 'TEST');
      expect(error.statusCode).toBe(500);
    });

    test('should capture stack trace', () => {
      const error = new ApplicationError('Test', 'TEST');
      expect(error.stack).toBeDefined();
      expect(typeof error.stack).toBe('string');
    });
  });

  describe('ValidationError', () => {
    test('should extend ApplicationError correctly', () => {
      const error = new ValidationError('Invalid input', { field: 'email' });

      expect(error instanceof ApplicationError).toBe(true);
      expect(error instanceof ValidationError).toBe(true);
      expect(error.name).toBe('ValidationError');
      expect(error.code).toBe('VALIDATION_ERROR');
      expect(error.statusCode).toBe(400);
      expect(error.details).toEqual({ field: 'email' });
    });
  });

  describe('SecurityError', () => {
    test('should extend ApplicationError correctly', () => {
      const error = new SecurityError('Access denied', { userId: '123' });

      expect(error instanceof ApplicationError).toBe(true);
      expect(error instanceof SecurityError).toBe(true);
      expect(error.name).toBe('SecurityError');
      expect(error.code).toBe('SECURITY_ERROR');
      expect(error.statusCode).toBe(403);
      expect(error.details).toEqual({ userId: '123' });
    });
  });

  describe('NotFoundError', () => {
    test('should extend ApplicationError correctly', () => {
      const error = new NotFoundError('Resource not found', { resourceId: 'abc123' });

      expect(error instanceof ApplicationError).toBe(true);
      expect(error instanceof NotFoundError).toBe(true);
      expect(error.name).toBe('NotFoundError');
      expect(error.code).toBe('NOT_FOUND');
      expect(error.statusCode).toBe(404);
      expect(error.details).toEqual({ resourceId: 'abc123' });
    });
  });

  describe('RateLimitError', () => {
    test('should extend ApplicationError correctly', () => {
      const error = new RateLimitError('Rate limit exceeded', { limit: 100 });

      expect(error instanceof ApplicationError).toBe(true);
      expect(error instanceof RateLimitError).toBe(true);
      expect(error.name).toBe('RateLimitError');
      expect(error.code).toBe('RATE_LIMIT_EXCEEDED');
      expect(error.statusCode).toBe(429);
      expect(error.details).toEqual({ limit: 100 });
    });
  });
});

describe('Result Type System', () => {
  describe('Ok function', () => {
    test('should create successful result', () => {
      const result = Ok('success value');

      expect(result.success).toBe(true);
      expect((result as any).value).toBe('success value');
      expect((result as any).error).toBeUndefined();
    });

    test('should work with complex objects', () => {
      const data = { id: 1, name: 'Test', items: [1, 2, 3] };
      const result = Ok(data);

      expect(result.success).toBe(true);
      expect((result as any).value).toEqual(data);
    });
  });

  describe('Err function', () => {
    test('should create error result', () => {
      const error = new Error('Something went wrong');
      const result = Err(error);

      expect(result.success).toBe(false);
      expect((result as any).error).toBe(error);
      expect((result as any).value).toBeUndefined();
    });

    test('should work with custom error types', () => {
      const error = new ValidationError('Invalid data');
      const result = Err(error);

      expect(result.success).toBe(false);
      expect((result as any).error).toBe(error);
      expect((result as any).error instanceof ValidationError).toBe(true);
    });
  });

  describe('Result type usage patterns', () => {
    function divide(a: number, b: number) {
      if (b === 0) {
        return Err(new Error('Division by zero'));
      }
      return Ok(a / b);
    }

    test('should handle successful operations', () => {
      const result = divide(10, 2);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value).toBe(5);
      }
    });

    test('should handle error operations', () => {
      const result = divide(10, 0);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toBe('Division by zero');
      }
    });
  });
});

describe('Type Guards', () => {
  describe('isError', () => {
    test('should identify Error instances', () => {
      expect(isError(new Error('test'))).toBe(true);
      expect(isError(new ValidationError('test'))).toBe(true);
      expect(isError(new ApplicationError('test', 'TEST'))).toBe(true);
    });

    test('should reject non-Error values', () => {
      expect(isError('string')).toBe(false);
      expect(isError(123)).toBe(false);
      expect(isError({})).toBe(false);
      expect(isError(null)).toBe(false);
      expect(isError(undefined)).toBe(false);
    });
  });

  describe('isString', () => {
    test('should identify string values', () => {
      expect(isString('hello')).toBe(true);
      expect(isString('')).toBe(true);
      expect(isString('123')).toBe(true);
    });

    test('should reject non-string values', () => {
      expect(isString(123)).toBe(false);
      expect(isString(true)).toBe(false);
      expect(isString({})).toBe(false);
      expect(isString(null)).toBe(false);
      expect(isString(undefined)).toBe(false);
    });
  });

  describe('isNumber', () => {
    test('should identify number values', () => {
      expect(isNumber(123)).toBe(true);
      expect(isNumber(0)).toBe(true);
      expect(isNumber(-456)).toBe(true);
      expect(isNumber(3.14)).toBe(true);
    });

    test('should reject NaN', () => {
      expect(isNumber(NaN)).toBe(false);
    });

    test('should reject non-number values', () => {
      expect(isNumber('123')).toBe(false);
      expect(isNumber(true)).toBe(false);
      expect(isNumber({})).toBe(false);
      expect(isNumber(null)).toBe(false);
      expect(isNumber(undefined)).toBe(false);
    });
  });

  describe('isObject', () => {
    test('should identify object values', () => {
      expect(isObject({})).toBe(true);
      expect(isObject({ key: 'value' })).toBe(true);
      expect(isObject(new Date())).toBe(true);
      expect(isObject(new Error())).toBe(true);
    });

    test('should reject null', () => {
      expect(isObject(null)).toBe(false);
    });

    test('should reject arrays', () => {
      expect(isObject([])).toBe(false);
      expect(isObject([1, 2, 3])).toBe(false);
    });

    test('should reject primitive values', () => {
      expect(isObject('string')).toBe(false);
      expect(isObject(123)).toBe(false);
      expect(isObject(true)).toBe(false);
      expect(isObject(undefined)).toBe(false);
    });
  });

  describe('isDefined', () => {
    test('should identify defined values', () => {
      expect(isDefined('')).toBe(true);
      expect(isDefined(0)).toBe(true);
      expect(isDefined(false)).toBe(true);
      expect(isDefined(null)).toBe(true);
      expect(isDefined({})).toBe(true);
    });

    test('should reject undefined', () => {
      expect(isDefined(undefined)).toBe(false);
    });
  });

  describe('isNotNull', () => {
    test('should identify non-null values', () => {
      expect(isNotNull('')).toBe(true);
      expect(isNotNull(0)).toBe(true);
      expect(isNotNull(false)).toBe(true);
      expect(isNotNull(undefined)).toBe(true);
      expect(isNotNull({})).toBe(true);
    });

    test('should reject null', () => {
      expect(isNotNull(null)).toBe(false);
    });
  });
});

describe('Type Guard Usage in Real Code', () => {
  test('should narrow types correctly with isString', () => {
    function processValue(value: unknown): string {
      if (isString(value)) {
        // TypeScript should know this is a string
        return value.toUpperCase();
      }
      return 'Not a string';
    }

    expect(processValue('hello')).toBe('HELLO');
    expect(processValue(123)).toBe('Not a string');
  });

  test('should narrow types correctly with isNumber', () => {
    function doubleIfNumber(value: unknown): number | null {
      if (isNumber(value)) {
        // TypeScript should know this is a number
        return value * 2;
      }
      return null;
    }

    expect(doubleIfNumber(5)).toBe(10);
    expect(doubleIfNumber('5')).toBe(null);
  });

  test('should narrow types correctly with isObject', () => {
    function getObjectKeys(value: unknown): string[] {
      if (isObject(value)) {
        // TypeScript should know this is an object
        return Object.keys(value);
      }
      return [];
    }

    expect(getObjectKeys({ a: 1, b: 2 })).toEqual(['a', 'b']);
    expect(getObjectKeys('string')).toEqual([]);
  });

  test('should work with optional chain patterns', () => {
    interface User {
      name?: string;
      age?: number;
    }

    function getUserName(user: User | undefined): string {
      if (isDefined(user) && isDefined(user.name)) {
        return user.name;
      }
      return 'Unknown';
    }

    expect(getUserName({ name: 'John' })).toBe('John');
    expect(getUserName({ age: 25 })).toBe('Unknown');
    expect(getUserName(undefined)).toBe('Unknown');
  });

  test('should handle error checking patterns', () => {
    function handleResult(result: unknown): string {
      if (isError(result)) {
        return `Error: ${result.message}`;
      }
      return 'Success';
    }

    expect(handleResult(new Error('Failed'))).toBe('Error: Failed');
    expect(handleResult('success')).toBe('Success');
  });
});
