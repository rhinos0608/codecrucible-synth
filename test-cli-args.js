#!/usr/bin/env node

/**
 * Test CLI argument parsing
 */

console.log('CLI Arguments Test');
console.log('process.argv:', process.argv);
console.log('args:', process.argv.slice(2));

const args = process.argv.slice(2);
console.log('First arg:', args[0]);
console.log('Args length:', args.length);

if (args[0] && args[0].startsWith('/')) {
  console.log('✅ Detected slash command:', args[0]);
} else {
  console.log('❌ Not a slash command');
}