import os from 'node:os';

export function collectMetadata () {
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