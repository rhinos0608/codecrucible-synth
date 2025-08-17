export class SecurityUtils {
    static initializeEncryption() {
        // Initialize encryption system
    }
    static isEncrypted(data) {
        return data.startsWith('encrypted:');
    }
    static encrypt(data) {
        return 'encrypted:' + Buffer.from(data).toString('base64');
    }
    static decrypt(data) {
        if (!this.isEncrypted(data))
            return data;
        return Buffer.from(data.replace('encrypted:', ''), 'base64').toString();
    }
}
//# sourceMappingURL=security-utils.js.map