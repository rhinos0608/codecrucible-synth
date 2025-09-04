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

  test('should create validation error correctly', () => {
    const error = new ValidationError('Invalid input', { field: 'email' });

    expect(error instanceof ApplicationError).toBe(true);
    expect(error instanceof ValidationError).toBe(true);
    expect(error.name).toBe('ValidationError');
    expect(error.code).toBe('VALIDATION_ERROR');
    expect(error.statusCode).toBe(400);
  });

  test('should create security error correctly', () => {
    const error = new SecurityError('Access denied', { userId: '123' });

    expect(error instanceof SecurityError).toBe(true);
    expect(error.code).toBe('SECURITY_ERROR');
    expect(error.statusCode).toBe(403);
  });
});

describe('Result Type System', () => {
  test('should create successful result', () => {
    const result = Ok('success value');

    expect(result.success).toBe(true);
    expect((result as any).value).toBe('success value');
  });

  test('should create error result', () => {
    const error = new Error('Something went wrong');
    const result = Err(error);

    expect(result.success).toBe(false);
    expect((result as any).error).toBe(error);
  });
});

describe('Type Guards', () => {
  test('should identify Error instances', () => {
    expect(isError(new Error('test'))).toBe(true);
    expect(isError(new ValidationError('test'))).toBe(true);
    expect(isError('string')).toBe(false);
  });

  test('should identify string values', () => {
    expect(isString('hello')).toBe(true);
    expect(isString(123)).toBe(false);
  });

  test('should identify number values', () => {
    expect(isNumber(123)).toBe(true);
    expect(isNumber(NaN)).toBe(false);
    expect(isNumber('123')).toBe(false);
  });

  test('should identify object values', () => {
    expect(isObject({})).toBe(true);
    expect(isObject([])).toBe(false);
    expect(isObject(null)).toBe(false);
  });

  test('should identify defined values', () => {
    expect(isDefined('')).toBe(true);
    expect(isDefined(null)).toBe(true);
    expect(isDefined(undefined)).toBe(false);
  });

  test('should identify non-null values', () => {
    expect(isNotNull('')).toBe(true);
    expect(isNotNull(undefined)).toBe(true);
    expect(isNotNull(null)).toBe(false);
  });
});
