// Real Rust NAPI module integration
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { createRequire } from 'module';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const require = createRequire(import.meta.url);

let rustModule;

try {
  // Try to load the actual NAPI module using require (needed for .node files)
  const modulePath = join(__dirname, '../../../../rust-executor.node');
  rustModule = require(modulePath);
  console.log('✅ Rust executor module loaded successfully');
} catch (error) {
  console.warn('⚠️ Failed to load Rust executor module:', error.message);
  
  // Fallback exports with error messages
  rustModule = {
    RustExecutor: class RustExecutor {
      constructor() {
        throw new Error(`Rust module not available: ${error.message}`);
      }
      
      static create() {
        throw new Error(`Rust module not available: ${error.message}`);
      }
    },
    
    createRustExecutor() {
      throw new Error(`Rust module not available: ${error.message}`);
    },
    
    initLogging() {
      console.warn('Rust logging not available - module failed to load');
    }
  };
}

// Export the module interfaces
export const RustExecutor = rustModule.RustExecutor;
export const createRustExecutor = rustModule.createRustExecutor || rustModule.create_rust_executor;
export const initLogging = rustModule.initLogging || rustModule.init_logging;