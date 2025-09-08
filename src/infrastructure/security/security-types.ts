// Infrastructure Security Types
// Migrated from src/core/types.ts - Security and error handling types

// Security Types
export interface SecurityValidation {
  isValid: boolean;
  reason?: string;
  sanitizedInput?: string;
  riskLevel?: 'low' | 'medium' | 'high';
}

export interface ISecurityError extends Error {
  code: string;
  risk: string;
}

export class SecurityError extends Error {
  public code: string;
  public risk: string;

  public constructor(message: string, code: string = 'SECURITY_ERROR', risk: string = 'medium') {
    super(message);
    this.name = 'SecurityError';
    this.code = code;
    this.risk = risk;
  }
}

// CLI Error Types
export interface ICLIError extends Error {
  code: string;
  exitCode: number;
}

export class CLIError extends Error implements ICLIError {
  public code: string;
  public exitCode: number;

  public constructor(message: string, exitCode: number, code: string = 'CLI_ERROR') {
    super(message);
    this.name = 'CLIError';
    this.code = code;
    this.exitCode = exitCode;
  }

  public static timeout(operation: string): CLIError {
    return new CLIError(
      `Timeout occurred during ${operation}`,
      CLIExitCode.NETWORK_ERROR,
      'TIMEOUT'
    );
  }

  public static networkError(message: string): CLIError {
    return new CLIError(`Network error: ${message}`, CLIExitCode.NETWORK_ERROR, 'NETWORK_ERROR');
  }
}

export enum CLIExitCode {
  SUCCESS = 0,
  GENERAL_ERROR = 1,
  INVALID_ARGS = 2,
  CONFIG_ERROR = 3,
  NETWORK_ERROR = 4,
  INVALID_INPUT = 5,
  EXECUTION_FAILED = 6,
  INITIALIZATION_FAILED = 7,
  AUTHENTICATION_REQUIRED = 8,
  AUTHENTICATION_FAILED = 9,
  PERMISSION_DENIED = 10,
  SECURITY_VIOLATION = 11,
  UNEXPECTED_ERROR = 99,
}
