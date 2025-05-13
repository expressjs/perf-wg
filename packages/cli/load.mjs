import { normalize, join, dirname } from 'node:path';
import { writeFile } from 'node:fs/promises';
import { inspect } from 'node:util';

/**
  * NOTE: CLI Example Usage
  *
  * $ cli load \
  *   --cwd
  *
  *   # The runner is what starts the server and request processes
  *   # collects all the information and reports it back to the cli
  *   --runner=docker \
  *
  *   # The git repo url to checkout as a source for all the things
  *   --repo=https://github.com/expressjs/perf-wg.git
  *   --repo-ref=master
  *
  *   # The test to run. Can be a path relative to the repo or
  *   # a package name from within the repo which can be imported
  *   --test=example \
  *
  *   # Features to enable
  *   --flamegraph \
  *   --heap-profile \
  *   --heap-snapshot \
  *   --cpu-profile \
  */
export default async function main (_opts = {}) {
  return new Promise(async (resolve, reject) => {
    const opts = {
      cwd: normalize(join(import.meta.dirname, '..', '..')),
      repo: 'https://github.com/expressjs/perf-wg.git',
      repoRef: 'master',
      runner: '@expressjs/perf-runner-docker',
      test: '@expressjs/perf-load-example',
      ..._opts
    };

    let completed = false;

    // Setup some process and error handling
    const ac = opts.abortController ?? new AbortController();
    process.on('uncaughtException', () => {
      ac.abort();
    });
    process.on('unhandledRejection', () => {
      ac.abort();
    });
    process.on('SIGINT', () => {
      ac.abort();
    });
    process.on('SIGTERM', () => {
      ac.abort();
    });
    process.on('beforeExit', () => {
      if (!completed) {
        ac.abort();
      }
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
        test: opts.test,
        signal: ac.signal
      });

      const outputFile = join(dirname(import.meta.resolve(opts.test).replace(/^file:/, '')), 'results', 'result-' + Date.now() + '.json');
      await writeFile(outputFile, JSON.stringify(results));
      console.log(inspect(results, { depth: null }));
      console.log(`written to: ${outputFile}`);
    } catch (e) {
      console.error(e);
    }
    completed = true;

    resolve();
  });
}
