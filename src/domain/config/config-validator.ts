import {
  UnifiedConfiguration,
  ConfigurationValidation,
  ConfigurationError,
  ConfigurationWarning,
} from '../interfaces/configuration.js';

export function validateConfiguration(
  config: Partial<UnifiedConfiguration>
): ConfigurationValidation {
  const errors: ConfigurationError[] = [];
  const warnings: ConfigurationWarning[] = [];

  if (config.application) {
    if (!config.application.name) {
      errors.push({
        field: 'application.name',
        message: 'App name is required',
        severity: 'error',
      });
    }
    const envs = ['development', 'production', 'testing', 'staging'];
    if (!envs.includes(config.application.environment)) {
      errors.push({
        field: 'application.environment',
        message: 'Invalid environment',
        severity: 'error',
      });
    }
  }

  if (config.model?.providers && config.model.providers.length === 0) {
    warnings.push({
      field: 'model.providers',
      message: 'No model providers configured',
      suggestion: 'Add at least one provider',
    });
  }

  if (config.model?.timeout && config.model.timeout < 1000) {
    warnings.push({
      field: 'model.timeout',
      message: 'Timeout very low',
      suggestion: 'Consider increasing timeout',
    });
  }

  if (config.security?.securityLevel === 'low') {
    warnings.push({
      field: 'security.securityLevel',
      message: 'Low security level enabled',
    });
  }

  if (config.performance?.maxConcurrentRequests && config.performance.maxConcurrentRequests > 10) {
    warnings.push({
      field: 'performance.maxConcurrentRequests',
      message: 'High concurrency may cause issues',
    });
  }

  return { isValid: errors.length === 0, errors, warnings };
}
