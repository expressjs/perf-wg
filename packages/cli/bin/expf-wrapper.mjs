#!/usr/bin/env node
import { realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { spawn } from 'node:child_process';

// Resolve symlinks to get the actual file location
const scriptPath = fileURLToPath(import.meta.url);
const actualPath = realpathSync(scriptPath);
const actualDir = dirname(actualPath);
const expfPath = join(actualDir, 'expf.mjs');

// Spawn the actual expf.mjs with all arguments
const child = spawn(process.execPath, [expfPath, ...process.argv.slice(2)], {
  stdio: 'inherit'
});

child.on('exit', (code) => {
  process.exit(code || 0);
});
