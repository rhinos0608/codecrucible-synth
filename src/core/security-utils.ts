
export class SecurityUtils {
  static initializeEncryption(): void {
    // Initialize encryption system
  }

  static isEncrypted(data: string): boolean {
    return data.startsWith('encrypted:');
  }

  static encrypt(data: string): string {
    return 'encrypted:' + Buffer.from(data).toString('base64');
  }

  static decrypt(data: string): string {
    if (!this.isEncrypted(data)) return data;
    return Buffer.from(data.replace('encrypted:', ''), 'base64').toString();
  }
}
