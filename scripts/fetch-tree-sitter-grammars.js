#!/usr/bin/env node
// Fetch tree-sitter WASM grammars to vendor/ts-wasm for portable runtime loading.
// This script is best-effort: it will try TS_WASM_BASE_URL if provided; otherwise it
// creates the directory and prints guidance. This keeps installs fast and resilient.

import fs from 'fs';
import path from 'path';
import https from 'https';

const destDir = path.join(process.cwd(), 'vendor', 'ts-wasm');
const files = [
  { name: 'tree-sitter-go.wasm', langs: ['go'] },
  { name: 'tree-sitter-rust.wasm', langs: ['rust','rs'] },
  { name: 'tree-sitter-java.wasm', langs: ['java'] },
  { name: 'tree-sitter-c_sharp.wasm', langs: ['csharp','cs'] },
  { name: 'tree-sitter-ruby.wasm', langs: ['ruby','rb'] },
];

function ensureDir(d) {
  if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
}

function download(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https
      .get(url, res => {
        if (res.statusCode !== 200) {
          file.close(() => fs.unlink(dest, () => resolve(false)));
          return;
        }
        res.pipe(file);
        file.on('finish', () => file.close(() => resolve(true)));
      })
      .on('error', err => {
        file.close(() => fs.unlink(dest, () => resolve(false)));
      });
  });
}

async function main() {
  ensureDir(destDir);
  const base = process.env.TS_WASM_BASE_URL || '';
  let downloaded = 0;
  for (const f of files) {
    const dest = path.join(destDir, f.name);
    if (fs.existsSync(dest)) continue;
    if (!base) continue;
    const url = `${base.replace(/\/$/, '')}/${f.name}`;
    // eslint-disable-next-line no-console
    console.log(`Fetching ${url} -> ${dest}`);
    try {
      const ok = await download(url, dest);
      if (ok) downloaded++;
    } catch {}
  }

  if (!downloaded && !process.env.TS_WASM_BASE_URL) {
    // eslint-disable-next-line no-console
    console.log('[tree-sitter] No TS_WASM_BASE_URL set. Place WASM grammars into vendor/ts-wasm/ to enable chunking for Go/Rust/Java/C#/Ruby.');
  } else {
    // eslint-disable-next-line no-console
    console.log(`[tree-sitter] Downloaded ${downloaded} grammar(s) to ${destDir}`);
  }
}

main().catch(() => {});

