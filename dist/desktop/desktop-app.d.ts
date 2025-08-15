import { CLIContext } from '../core/cli.js';
export interface DesktopOptions {
    port: number;
    width?: number;
    height?: number;
    devMode?: boolean;
}
/**
 * Start the desktop application
 */
export declare function startDesktopApp(context: CLIContext, options: DesktopOptions): Promise<void>;
