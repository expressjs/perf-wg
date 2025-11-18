import process from 'node:process';
import os from 'node:os';

function collectMetadata () {
  return {
    arch: os.arch(),
    cpus: os.cpus(),
    machine: os.machine(),
    platform: os.platform(),
    release: os.release(),
    totalmem: os.totalmem(),
    type: os.type(),
    version: os.version()
  };
}

process.stdout.write(JSON.stringify(collectMetadata()));
