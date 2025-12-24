import { normalize, join, dirname } from 'node:path';
import { writeFile, mkdir } from 'node:fs/promises';
import nv from '@pkgjs/nv';
import autocannon from 'autocannon';

// TODO: Add description to each flag
export function help (opts = {}) {
  return `$ expf load [flags]

  Run a load test.

  Flags:

    --cwd=${opts.cwd || normalize(join(import.meta.dirname, '..', '..'))}
    --runner=@expressjs/perf-runner-local
    --repo=https://github.com/expressjs/perf-wg.git
    --repo-ref=master
    --test=@expressjs/perf-load-example
    --node=lts_latest
    --duration=60
    --overrides='{"express":"latest"}'
    --config=./expf.config.json
    --[no-]write
    --[no-]parallel
    --uws                              Enable uWebSockets.js via uwebsockets-express
                                       (auto-selects v1.3.13 for Express 4, v2.0.0 for Express 5)

  Runners:
    - @expressjs/perf-runner-vanilla: local docker based runner
      - Flags: --force-rebuild
    - @expressjs/perf-runner-nsolid: local docker based runner with nsolid
      - Flags: --force-rebuild

  Examples:

    # Express 5 (default) with uWebSockets.js
    expf load --uws

    # Express 4 with uWebSockets.js
    expf load --uws --overrides='{"express":"4.21.2"}'
`
}

function header (strs, ...values) {
  const val = strs.reduce((v, s, i) => {
    return v + s + (values[i] ? values[i] : '');
  }, '');
  return val + '\n' + Array(val.length).fill('=').join('');
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
      repo: null, // 'https://github.com/expressjs/perf-wg.git',
      repoRef: null, // 'master',
      runner: '@expressjs/perf-runner-local',
      test: '@expressjs/perf-load-example',
      node: 'lts_latest',
      ...conf,
      duration: 60,
      ..._opts
    };

    // Parse duration as integer if provided as string
    if (typeof opts.duration === 'string') {
      const parsedDuration = parseInt(opts.duration, 10);
      if (isNaN(parsedDuration) || parsedDuration <= 0) {
        throw new Error(`Invalid duration: ${opts.duration}. Duration must be a positive integer (seconds).`);
      }
      opts.duration = parsedDuration;
    }

    // Parse overrides json
    if (typeof opts.overrides === 'string') {
      const parsedOverrides = JSON.parse(opts.overrides);
      opts.overrides = parsedOverrides;
    }

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

    let vers;
    try {
      vers = await nv(opts.node, {
        latestOfMajorOnly: true
      });

      if (!vers?.[0]?.version) {
        throw Object.assign(new Error(`Unable to resolve node version`), {
          spec: opts.node
        });
      }
    } catch (e) {
      // If offline or cannt load node versions, use
      // the option as passed in without a default
      if (e.code === 'ENOTFOUND' && _opts.node) {
        vers = [{ version: _opts.node}];
      } else {
        throw e;
      }
    }

    const results = await runner({
      ...opts,
      node: vers?.[0]?.version,
      signal: ac.signal
    });

    if (opts.write !== false) {
      const outputFile = join(dirname(import.meta.resolve(opts.test).replace(/^file:/, '')), 'results', 'result-' + Date.now() + '.json');
      await mkdir(dirname(outputFile), { recursive: true });
      await writeFile(outputFile, JSON.stringify(results, null, 2));
      console.log(`written to: ${outputFile}`);
    } else {
      console.log(...Object.entries(results).flatMap(([k, v]) => {
        return ['\n', header`${k}`, '\n', v, '\n'];
      }));
    }

    for (const res of results.clientResults) {
      console.log(header`${res.url} ${res['2xx'] || '0'} 2xx's, ${res['non2xx'] || '0'} non-2xx's, ${res.errors || '0'} errors`);
      console.log(autocannon.printResult(res));
    }
    completed = true;

    resolve();
  });
}
