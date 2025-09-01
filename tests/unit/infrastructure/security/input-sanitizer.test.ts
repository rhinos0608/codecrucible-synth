import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { InputSanitizer } from '../../../../src/infrastructure/security/input-sanitizer.js';
import { SecurityPolicyLoader } from '../../../../src/infrastructure/security/security-policy-loader.js';

describe('InputSanitizer initialization', () => {
  beforeEach(() => {
    (InputSanitizer as any).allowedCommands = null;
    (InputSanitizer as any).dangerousPatterns = null;
    (InputSanitizer as any).policyInitialization = null;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('shares policy initialization across concurrent calls', async () => {
    const loader = (InputSanitizer as any).policyLoader as SecurityPolicyLoader;
    const allowedSpy = jest
      .spyOn(loader, 'getAllowedCommands')
      .mockResolvedValue(new Set(['/help']));
    const patternSpy = jest.spyOn(loader, 'getDangerousPatterns').mockResolvedValue([]);

    await Promise.all([
      InputSanitizer.sanitizeSlashCommand('/help'),
      InputSanitizer.sanitizeSlashCommand('/help'),
    ]);

    expect(allowedSpy).toHaveBeenCalledTimes(1);
    expect(patternSpy).toHaveBeenCalledTimes(1);
  });
});

describe('InputSanitizer dangerous pattern coverage', () => {
  it('blocks legacy dangerous commands', async () => {
    const result = await InputSanitizer.sanitizeSlashCommand('/help rm -rf /');
    expect(result.isValid).toBe(false);
  });

  it('blocks script injection patterns', async () => {
    const result = await InputSanitizer.sanitizeSlashCommand('/help <script>alert(1)</script>');
    expect(result.isValid).toBe(false);
  });
});
