import { normalize, join, dirname } from 'node:path';
import { writeFile, mkdir } from 'node:fs/promises';
import nv from '@pkgjs/nv';

export function help (opts = {}) {
  return `$ expf load [flags]

  Run a load test.

  Flags:

    --cwd=${opts.cwd || normalize(join(import.meta.dirname, '..', '..'))}
    --runner=@expressjs/perf-runner-docker
    --repo=https://github.com/expressjs/perf-wg.git
    --repo-ref=master
    --test=@expressjs/perf-load-example
    --node=lts_latest
    --overrides='{"express":"latest"}'
    --config=./expf.config.json
    --[no-]write
`
}

export default function main (_opts = {}) {
  if (_opts.help) {
    console.log(help());
    return;
  }
  return new Promise(async (resolve, reject) => {
    const cwd = normalize(join(import.meta.dirname, '..', '..'));

    let conf = {};
    try {
      conf = (await import(join(cwd, _opts.config || 'expf.config.json'), {
        with: {
          type: 'json'
        }
      })).default;
    } catch (err) {
      // Only throw if config was explicitly passed, not if we failed to load the default file
      if (_opts.config) {
        throw new Error('Failed to load config file', {
          cause: err
        });
      }
      // Warn when a config file was found but was not loadable
      if (err.code !== 'ERR_MODULE_NOT_FOUND') {
        process.emitWarning(err);
      }
    }

    const opts = {
      cwd,
      repo: 'https://github.com/expressjs/perf-wg.git',
      repoRef: 'master',
      runner: '@expressjs/perf-runner-docker',
      test: '@expressjs/perf-load-example',
      node: 'lts_latest',
      ...conf,
      ..._opts
    };

    let completed = false;

    // Setup some process and error handling
    const ac = opts.abortController ?? new AbortController();
    process.on('uncaughtException', (err) => {
      console.error(err);
      ac.abort();
    });
    process.on('unhandledRejection', (reason) => {
      console.error(reason);
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
      const vers = await nv(opts.node, {
        latestOfMajorOnly: true
      });

      const results = await runner({
        cwd: opts.cwd,
        repo: opts.repo,
        test: opts.test,
        node: vers?.[0]?.version,
        overrides: opts.overrides,
        signal: ac.signal
      });

      if (opts.write !== false) {
        const outputFile = join(dirname(import.meta.resolve(opts.test).replace(/^file:/, '')), 'results', 'result-' + Date.now() + '.json');
        await mkdir(dirname(outputFile), { recursive: true });
        await writeFile(outputFile, JSON.stringify(results, null, 2));
        console.log(`written to: ${outputFile}`);
      } else {
        console.log(results);
      }
    } catch (e) {
      console.error(e);
    }
    completed = true;

    resolve();
  });
}
