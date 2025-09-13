import { RustBridgeManager, type BridgeConfiguration } from './rust-bridge-manager.js';

export async function initializeRustBridge(
  config: Partial<BridgeConfiguration> = {}
): Promise<RustBridgeManager> {
  const ok = await RustBridgeManager.initializeInstance(config);
  if (!ok) {
    throw new Error('Failed to initialize Rust bridge');
  }
  return RustBridgeManager.getInstance();
}
