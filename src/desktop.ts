#!/usr/bin/env node

import { startDesktopApp } from './desktop/desktop-app.js';
import { initializeCLIContext } from "./index.js";

/**
 * Desktop application entry point
 */
async function main() {
  try {
    console.log('🚀 Starting CodeCrucible Desktop Application...');
    
    // Initialize the CLI context (model client, voice system, etc.)
    const {cli, context} = await initializeCLIContext();
    
    // Start the desktop app with the CLI context
    await startDesktopApp(context, {
      port: 3001,
      width: 1400,
      height: 900
    });
    
  } catch (error) {
    console.error('❌ Failed to start desktop application:', error);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export default main;