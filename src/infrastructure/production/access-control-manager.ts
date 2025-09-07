import { logger } from '../logging/logger.js';

export class AccessControlManager {
  private readonly accessMap: Map<string, Set<string>> = new Map();

  public grant(userId: string, permission: string): void {
    if (!this.accessMap.has(userId)) {
      this.accessMap.set(userId, new Set());
    }
    this.accessMap.get(userId)!.add(permission);
  }

  public checkAccess(userId: string, permission: string): void {
    const perms = this.accessMap.get(userId);
    if (!perms || !perms.has(permission)) {
      logger.warn(`Access denied for user ${userId} attempting ${permission}`);
      throw new Error('Access denied');
    }
  }
}
