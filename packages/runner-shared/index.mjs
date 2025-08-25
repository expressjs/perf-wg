import { execFile } from 'node:child_process';
import { join } from 'node:path';
import { readFile } from 'node:fs/promises';
import ac from '@expressjs/perf-autocannon';
import { collectMetadata } from '@expressjs/perf-metadata';
import nv from '@pkgjs/nv';

export function createRunner(runnerConfig = {}) {
  const {
    type = 'unknown',
    runtime = 'node.js',
    apm = 'none',
    capabilities = [],
    env = {},
    dockerFile = 'Dockerfile',
    nodeVersion,  // Allow runner-specific node version
    nodeBase      // Allow runner-specific base OS
  } = runnerConfig;

  async function buildContainer(opts = {}) {
    return new Promise(async (resolve, reject) => {
      // Use runner-specific version if provided, otherwise use CLI option
      let nodeVer, os;
      
      if (nodeVersion && nodeBase) {
        // Use runner-specific configuration
        nodeVer = nodeVersion;
        os = nodeBase;
      } else {
        // Fall back to CLI configuration
        const vers = await nv(opts.node, {
          latestOfMajorOnly: true
        });
        nodeVer = vers?.[0]?.version || 'lts';
        os = 'bookworm';
      }

      const cp = execFile(
        join(import.meta.dirname, 'scripts', 'build.sh'),
        [
          nodeVer,
          os,
          type // Pass runner type to build script
        ],
        { cwd: import.meta.dirname }
      );
      
      cp.on('exit', () => {
        resolve({
          tag: `expf-runner-${type}:${nodeVer}-${os}`,
          node: nodeVer,
          type,
          runtime,
          apm
        });
      });
      cp.on('error', reject);
      cp.stdout.on('data', (d) => process.stdout.write(d));
      cp.stderr.on('data', (d) => process.stderr.write(d));
    });
  }

  function startServer(opts = {}) {
    return new Promise((resolve, reject) => {
      if (opts?.signal.aborted) {
        return reject(opts.signal.reason);
      }

      const args = [
        opts.cwd,
        opts.repo,
        opts.repoRef,
        opts.test,
        opts.tag,
      ];

      if (opts.overrides) {
        args.push(opts.overrides);
      }

      // Pass runtime environment variables
      const envVars = { ...env, RUNTIME_TYPE: type };
      
      const cp = execFile(
        join(import.meta.dirname, 'scripts', 'run.sh'), 
        args, 
        { env: { ...process.env, ...envVars } }
      );

      const server = {
        metadata: {
          url: new URL('http://localhost:3000'),
          dockerTag: opts.tag,
          nodeVersion: opts.node,
          runnerType: type,
          runtime,
          apm,
          capabilities
        },
        status: 'starting',
        close: () => {
          return new Promise((closeResolve) => {
            cp.on('exit', () => {
              server.status = 'stopped';
              closeResolve();
            });
            cp.kill('SIGINT');
            server.status = 'closing';
          });
        },
        results: async () => {
          const results = await Promise.allSettled([
            readFile(join(opts.cwd, 'results', 'output.txt'), { encoding: 'utf8' }),
            readFile(join(opts.cwd, 'results', 'profile.svg'), { encoding: 'utf8' }),
            readFile(join(opts.cwd, 'results', 'perf.data')),
            readFile(join(opts.cwd, 'results', 'metadata.json'), { encoding: 'utf8' }),
            readFile(join(opts.cwd, 'results', 'package-lock.json'), { encoding: 'utf8' })
          ]);

          if (results[3].value) {
            Object.assign(server.metadata, JSON.parse(results[3].value));
          } else {
            Object.assign(server.metadata, { error: results[3].error });
          }
          
          return {
            output: results[0].value || results[0].error,
            flamegraph: results[1].value || results[1].error,
            rawPerfData: results[2].value || results[2].error,
            lockfile: results[4].value || results[4].error
          };
        }
      };

      opts?.signal.addEventListener('abort', () => {
        server.status = 'aborted';
        cp.kill('SIGINT');
        reject(new Error('aborted'));
      });
      
      cp.on('error', reject);
      cp.stdout.on('data', (d) => {
        process.stdout.write(d);
        if (server.status === 'starting' && d.toString('utf8').includes("Running")) {
          server.status = 'started';
          resolve(server);
        }
      });
      cp.stderr.on('data', (d) => process.stderr.write(d));
    });
  }

  async function startClient(_opts = {}, server) {
    const opts = { ..._opts };
    if (opts?.signal.aborted) return;

    const cannon = ac({
      url: server.metadata.url.toString(),
      requests: await (await import(opts.test)).requests()
    });

    opts?.signal.addEventListener('abort', () => {
      console.log('should stop client')
      cannon.stop?.();
    });

    return {
      metadata: collectMetadata(),
      close: async () => cannon.stop?.(),
      results: () => cannon
    };
  }

  async function runner(_opts = {}) {
    const opts = { ..._opts };

    const containerMeta = await buildContainer(opts);
    opts.node = containerMeta.node;
    opts.tag = containerMeta.tag;

    const server = await startServer(opts);
    const client = await startClient(opts, server); 

    const clientResults = await client.results();
    const serverResults = await server.results();

    await client.close();
    await server.close();

    return {
      serverMetadata: server.metadata,
      clientMetadata: client.metadata,
      serverResults,
      clientResults
    };
  }

  return runner;
}
