import { readFile, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import {
  SecurityAuditLogger,
  AuditOutcome,
} from '../../../../src/infrastructure/security/security-audit-logger.js';

describe('SecurityAuditLogger', () => {
  it('writes audit events to file and cleans up', async () => {
    const file = join(tmpdir(), `audit-${Date.now()}.log`);
    process.env.AUDIT_LOG_PATH = file;
    const logger = SecurityAuditLogger.getInstance();
    logger.logAuthenticationEvent(AuditOutcome.SUCCESS, 'user1');
    await new Promise(res => setTimeout(res, 50));
    logger.cleanup();
    const content = await readFile(file, 'utf-8');
    expect(content).toContain('authentication');
    await rm(file);
  });
});
