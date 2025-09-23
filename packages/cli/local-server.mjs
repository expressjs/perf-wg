import { join } from 'node:path';
import { spawn } from 'node:child_process';

// TODO: add options to load different servers
export function help () {
  return `$ expf local-server

  Start Express local HTTP server
`
}

export function startServer () {
  const server = spawn(
    process.execPath,
    [
      join(import.meta.dirname, '../../servers/node-http/index.mjs'),
    ],
    {
      env: {
        ...process.env,
        PORT: 3000
      },
      stdio: ['inherit', 'inherit', 'inherit']
    }
  );

  return new Promise((resolve, reject) => {
    server.on('error', reject);
    server.on('close', resolve);

    process.on('beforeExit', () => {
      server.close();
    });
  })
}

export default async function main (_opts = {}) {
  await startServer();
}
