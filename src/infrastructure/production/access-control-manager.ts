import { logger } from '../logging/logger.js';

export class AccessControlManager {
  private readonly accessMap: Map<string, Set<string>> = new Map();

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
      logger.warn(
        `Access denied for user ${userId} attempting ${permission}: no permissions configured`
      );
      throw new Error('Access denied: no permissions configured');
    }
    const perms = this.accessMap.get(userId);
    if (!perms?.has(permission)) {
      logger.warn(`Access denied for user ${userId} attempting ${permission}`);
      throw new Error('Access denied');
    }
  }
}
