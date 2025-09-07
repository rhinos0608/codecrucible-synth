import { logger } from '../logging/logger.js';

export class AccessControlManager {
  private readonly accessMap: Map<string, Set<string>> = new Map();

  public grant(userId: string, permission: string): void {
    let perms = this.accessMap.get(userId);
    if (!perms) {
      perms = new Set();
      this.accessMap.set(userId, perms);
    }
    perms.add(permission);
  }

  public checkAccess(userId: string, permission: string): void {
    if (this.accessMap.size === 0) {
      return; // default allow when no permissions configured
    }
    const perms = this.accessMap.get(userId);
    if (!perms || !perms.has(permission)) {
      logger.warn(`Access denied for user ${userId} attempting ${permission}`);
      throw new Error('Access denied');
    }
  }
}
