import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { collectMetadata } from '@expressjs/perf-metadata';

export async function startServer (cwd, opts = {}) {
  if (opts.signal?.aborted) {
    return;
  }
  return new Promise((resolve, reject) => {
    const test = fileURLToPath(import.meta.resolve(opts.test));
    const cp = execFile(process.execPath, [ test ], { 
      cwd,
      env: {
        ...process.env,
        ...(opts.uws ? { USE_UWS: '1' } : {})
      }
    });

    const server = {
      metadata: {
        url: new URL('http://localhost:3000'),
        ...collectMetadata()
      },
      status: 'starting',
      close: () => {
        return new Promise((closeResolve) => {
          cp.on('exit', () => {
            closeResolve();
          });
          cp.kill('SIGINT');
        });
      },
      results: async () => {
        return { };
      }
    };

    opts.signal?.addEventListener('abort', () => {
      server.status = 'aborted';
      cp.kill('SIGINT');
      reject(new Error('aborted'));
    });
    cp.on('error', reject);
    cp.stdout.on('data', (d) => {
      process.stdout.write(d);
      if (server.status === 'starting' && d.toString('utf8').includes("startup:")) {
        server.status = 'started';
        resolve(server);
      }
    });
    cp.stderr.on('data', (d) => {
      process.stderr.write(d);
    });
  });
} 
