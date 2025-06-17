import process from 'node:process';
import os from 'node:os';

process.stdout.write(JSON.stringify({
  cpus: os.cpus(),
  totalmem: os.totalmem(),
  arch: os.arch(),
  machine: os.machine(),
  platform: os.platform(),
  release: os.release(),
  type: os.type(),
  version: os.version()
}));
