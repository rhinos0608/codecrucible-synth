import { Server } from '@modelcontextprotocol/sdk/server/index.js';
export interface SmitheryMCPConfig {
    apiKey?: string;
    profile?: string;
    baseUrl: string;
}
export declare class SmitheryMCPServer {
    private server;
    private config;
    constructor(config: SmitheryMCPConfig);
    private initializeServer;
    private handleWebSearchExa;
    getServer(): Server;
}
