#!/usr/bin/env node
// Build tree-sitter grammars to WASM using the tree-sitter CLI, if available.
// Expects source repos in vendor/ts-grammars/<lang>/ with a grammar.js.
// Outputs WASM to vendor/ts-wasm/.

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const langs = [
  { key: 'go', dir: 'tree-sitter-go', out: 'tree-sitter-go.wasm' },
  { key: 'rust', dir: 'tree-sitter-rust', out: 'tree-sitter-rust.wasm' },
  { key: 'java', dir: 'tree-sitter-java', out: 'tree-sitter-java.wasm' },
  { key: 'c_sharp', dir: 'tree-sitter-c-sharp', out: 'tree-sitter-c_sharp.wasm' },
  { key: 'ruby', dir: 'tree-sitter-ruby', out: 'tree-sitter-ruby.wasm' },
];

function exec(cmd, args, cwd) {
  return new Promise(resolve => {
    const child = spawn(cmd, args, { cwd, stdio: 'inherit', shell: process.platform === 'win32' });
    child.on('close', code => resolve(code === 0));
    child.on('error', () => resolve(false));
  });
}

async function main() {
  const srcRoot = path.join(process.cwd(), 'vendor', 'ts-grammars');
  const outRoot = path.join(process.cwd(), 'vendor', 'ts-wasm');
  if (!fs.existsSync(srcRoot)) {
    console.log('[tree-sitter] No vendor/ts-grammars source directory found. Skipping build.');
    return;
  }
  if (!fs.existsSync(outRoot)) fs.mkdirSync(outRoot, { recursive: true });

  // Verify CLI
  const haveTS = await exec('npx', ['tree-sitter', '--version'], process.cwd());
  if (!haveTS) {
    console.log('[tree-sitter] tree-sitter CLI not available (npx tree-sitter). Skipping build.');
    return;
  }

  let built = 0;
  for (const l of langs) {
    const srcDir = path.join(srcRoot, l.dir);
    const outFile = path.join(outRoot, l.out);
    if (!fs.existsSync(srcDir)) continue;
    console.log(`[tree-sitter] Building ${l.key} grammar at ${srcDir}`);
    const ok = await exec('npx', ['tree-sitter', 'build-wasm'], srcDir);
    if (!ok) continue;
    const wasmPath = path.join(srcDir, 'tree-sitter.wasm');
    if (fs.existsSync(wasmPath)) {
      fs.copyFileSync(wasmPath, outFile);
      built++;
      console.log(`[tree-sitter] Wrote ${outFile}`);
    }
  }
  console.log(`[tree-sitter] Built ${built} grammar(s).`);
}

main().catch(() => {});

