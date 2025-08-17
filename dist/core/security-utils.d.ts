export declare class SecurityUtils {
    static initializeEncryption(): void;
    static isEncrypted(data: string): boolean;
    static encrypt(data: string): string;
    static decrypt(data: string): string;
}
