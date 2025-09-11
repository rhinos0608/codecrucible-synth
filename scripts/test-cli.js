// Simple script to spawn the CLI, send a prompt, and print output for ~20s
const { spawn } = require('child_process');

const child = spawn(process.execPath, ['dist/index.js'], {
  stdio: ['pipe', 'pipe', 'pipe'],
});

let buf = '';
child.stdout.on('data', d => {
  buf += d.toString();
  process.stdout.write(d);
});
child.stderr.on('data', d => {
  process.stderr.write(d);
});

// Send a prompt a couple seconds after startup
setTimeout(() => {
  const prompt = 'Could you do a thorough audit of the rust execution layer? scan the files for issues\n';
  try {
    child.stdin.write(prompt);
  } catch {}
}, 2500);

// Stop after 25s
setTimeout(() => {
  try { child.kill(); } catch {}
  process.exit(0);
}, 25000);

