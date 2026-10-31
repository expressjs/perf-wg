import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { collectMetadata } from '@expressjs/perf-metadata';
import { createProfiler } from './flamegraph.mjs';

export async function startServer (cwd, opts = {}) {
  if (opts.signal?.aborted) {
    return;
  }
  const test = fileURLToPath(import.meta.resolve(opts.test));
  const profiler = opts.flamegraph ? await createProfiler() : null;
  let cp;
  try {
    cp = profiler
      ? profiler.start(test, cwd)
      : spawn(process.execPath, [test], { cwd, stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (error) {
    await profiler?.cleanup();
    throw error;
  }

  let finished = false;
  const exited = new Promise((resolve) => {
    cp.once('error', error => resolve({ error }));
    cp.once('close', (code, signal) => {
      finished = true;
      resolve({ code, signal });
    });
  });
  let closePromise;
  let results = {};
  const server = {
    metadata: {
      url: new URL('http://localhost:3000'),
      ...collectMetadata()
    },
    status: 'starting',
    close () {
      closePromise ??= (async () => {
        try {
          if (!finished) cp.kill('SIGINT');
          const { error, code, signal } = await exited;
          if (error) throw error;
          if ((code !== null && code !== 0) || (signal && signal !== 'SIGINT')) {
            throw new Error(`Server exited with ${signal || `code ${code}`}`);
          }
          if (profiler && !opts.signal?.aborted) {
            results = await profiler.results();
          }
        } finally {
          opts.signal?.removeEventListener('abort', onAbort);
          await profiler?.cleanup();
          server.status = 'stopped';
        }
      })();
      return closePromise;
    },
    async results () {
      await server.close();
      return results;
    }
  };

  function onAbort () {
    cp.kill('SIGINT');
  }
  opts.signal?.addEventListener('abort', onAbort, { once: true });
  if (opts.signal?.aborted) onAbort();

  try {
    await new Promise((resolve, reject) => {
      let startup = '';
      cp.once('error', reject);
      cp.once('close', (code, signal) => {
        reject(new Error(`Server exited before startup (${signal || code})`));
      });
      cp.stdout.on('data', (d) => {
        process.stdout.write(d);
        startup = (startup + d.toString('utf8')).slice(-1024);
        if (server.status === 'starting' && startup.includes('startup:')) {
          server.status = 'started';
          resolve();
        }
      });
      cp.stderr.on('data', (d) => {
        process.stderr.write(d);
      });
    });
    return server;
  } catch (error) {
    await server.close().catch(() => {});
    throw error;
  }
}
