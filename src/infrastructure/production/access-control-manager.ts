import { logger } from '../logging/logger.js';

/**
 * Options for configuring the AccessControlManager.
 *
 * Enabling `defaultAllow` will grant access when no permissions are
 * configured. This weakens the security model and should be enabled only in
 * controlled environments.
 */
export interface AccessControlOptions {
  /** Allow all access when no permissions are registered */
  defaultAllow?: boolean;
}

export class AccessControlManager {
  private readonly accessMap: Map<string, Set<string>> = new Map();
  private readonly defaultAllow: boolean;

  public constructor(options: AccessControlOptions = {}) {
    this.defaultAllow = options.defaultAllow ?? false;
  }

  public grant(userId: string, permission: string): void {
    const perms = this.accessMap.get(userId);
    if (perms) {
      perms.add(permission);
    } else {
      this.accessMap.set(userId, new Set([permission]));
    }
  }

  public checkAccess(userId: string, permission: string): void {
    if (this.accessMap.size === 0) {

      if (this.defaultAllow) {
        return;
      }
      logger.warn(
        `Access denied for user ${userId} attempting ${permission}: no permissions configured`
      );


      logger.warn(
        `Access denied for user ${userId} attempting ${permission}: no permissions configured`
      );


      return; // default allow when no permissions configured

      logger.warn(`Access denied for user ${userId} attempting ${permission}: no permissions configured`);


      throw new Error('Access denied: no permissions configured');
    }
    const perms = this.accessMap.get(userId);
    if (!perms?.has(permission)) {
      logger.warn(`Access denied for user ${userId} attempting ${permission}`);
      throw new Error('Access denied');
    }
  }
}
