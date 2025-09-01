/**
 * Entry point for the CodeCrucible Synth CLI application.
 * @module index
 */

import { generateCode } from './codeGenerator';
import { analyzeCode } from './codeAnalyzer';

/**
 * Main function to run the CLI application.
 */
async function main() {
  try {
    const code = await generateCode('someInput');
    const analysis = await analyzeCode(code);

    console.log('Generated Code:', code);
    console.log('Analysis:', analysis);
  } catch (error) {
    console.error('Error:', error.message);
  }
}

main();
