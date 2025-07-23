import { normalize, join, dirname } from 'node:path';
import { writeFile, mkdir } from 'node:fs/promises';
import { inspect } from 'node:util';

export function help () {
  return `$ expf load [flags]

  Run a load test.

  Flags:

    --cwd
    --runner=docker
    --repo=https://github.com/expressjs/perf-wg.git
    --repo-ref=master
    --test=example`;
}

export default function main (_opts = {}) {
  if (_opts.help) {
    console.log(help());
    return;
  }
  return new Promise(async (resolve, reject) => {
    const opts = {
      cwd: normalize(join(import.meta.dirname, '..', '..')),
      repo: 'https://github.com/expressjs/perf-wg.git',
      repoRef: 'master',
      runner: '@expressjs/perf-runner-docker',
      test: '@expressjs/perf-load-example',
      ..._opts,
      // Map CLI parameter names to expected names
      repoRef: _opts['repo-ref'] || _opts.repoRef || 'master'
    };

    let completed = false;

    // Setup some process and error handling
    const ac = opts.abortController ?? new AbortController();
    process.on('SIGINT', () => {
      ac.abort();
    });
    process.on('SIGTERM', () => {
      ac.abort();
    });
    if (ac.signal.aborted) {
      return reject(ac.signal.reason);
    }
    ac.signal.addEventListener('abort', () => {
      reject(ac.signal.reason);
    });

    // Import and start the runner
    const runner = (await import(opts.runner)).default;

    try {
      const results = await runner({
        cwd: opts.cwd,
        repo: opts.repo,
        repoRef: opts.repoRef,
        test: opts.test,
        signal: ac.signal
      });
      console.log('end');

      const outputFile = join(dirname(import.meta.resolve(opts.test).replace(/^file:/, '')), 'results', 'result-' + Date.now() + '.json');
      await mkdir(dirname(outputFile), { recursive: true });
      await writeFile(outputFile, JSON.stringify(results, null, 2));
      console.log(inspect(results, { depth: null }));
      console.log(`written to: ${outputFile}`);
      
      completed = true;
      resolve();
    } catch (e) {
      console.error('Load test failed:', e.message);
      completed = true;
      reject(e);
    }
  });
}
