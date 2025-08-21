import { execFile } from 'node:child_process';
import { join, resolve } from 'node:path';
import { readFile } from 'node:fs/promises';
import ac from '@expressjs/perf-autocannon';
import { collectMetadata } from '@expressjs/perf-metadata';
import nv from '@pkgjs/nv';

export function buildContainer (opts = {}) {
  return new Promise(async (resolve, reject) => {
    const vers = await nv(opts.node, {
      latestOfMajorOnly: true
    });
    const nodeVer = vers?.[0]?.version || 'lts';
    // TODO: bookworm hardcoded until we figure out
    // https://github.com/nodejs/docker-node/issues/2101#issuecomment-3024653783
    const os = 'bookworm';
    const tag = `expf-runner:${nodeVer}-${os}`;

    // TODO: resolve node version alias to specific version
    const cp = execFile(
      join(import.meta.dirname, 'scripts', 'build.sh'),
      [
        nodeVer,
        'bookworm',
        tag
      ],
      { cwd: import.meta.dirname }
    );
    cp.on('exit', () => {
      resolve({
        tag,
        node: nodeVer
      });
    });
    cp.on('error', reject);
    cp.stdout.on('data', (d) => {
      process.stdout.write(d);
    });
    cp.stderr.on('data', (d) => {
      process.stderr.write(d);
    });
  });
};

export function startServer (opts = {}) {
  return new Promise((resolve, reject) => {
    if (opts?.signal.aborted) {
      return reject(opts.signal.reason);
    }

    const cp = execFile(
      join(import.meta.dirname, 'scripts', 'run.sh'),
      [
        // TODO: convert this to json, there is much more to pass?
        opts.cwd,
        opts.repo,
        opts.repoRef,
        opts.test,
        opts.tag
      ],
      { }
    );

    const server = {
      metadata: {
        url: new URL('http://localhost:3000'),
        dockerTag: opts.tag,
        nodeVersion: opts.node
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
        // Get results
        const results = await Promise.allSettled([
          readFile(join(opts.cwd, 'results', 'output.txt'), { encoding: 'utf8' }),
          readFile(join(opts.cwd, 'results', 'profile.svg'), { encoding: 'utf8' }),
          readFile(join(opts.cwd, 'results', 'perf.data')),
          readFile(join(opts.cwd, 'results', 'metadata.json'), { encoding: 'utf8' })
        ]);

        // System information from inside the container
        if (results[3].value) {
          Object.assign(server.metadata, JSON.parse(results[3].value));
        } else {
          Object.assign(server.metadata, {
            error: results[3].error
          });
        }
        return {
          output: results[0].value || results[0].error,
          flamegraph: results[1].value || results[1].error,
          rawPerfData: results[2].value || results[2].error
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
    cp.stderr.on('data', (d) => {
      process.stderr.write(d);
    });
  });
}

export async function startClient (_opts = {}, server) {
  const opts = {
    ..._opts
  };
  if (opts?.signal.aborted) {
    return;
  }

  const cannon = ac({
    url: server.metadata.url.toString(),
    requests: await (await import(opts.test)).requests()
  });

  opts?.signal.addEventListener('abort', () => {
    cannon.stop?.();
  });

  return {
    // TODO: autocannon settings
    metadata: collectMetadata(),
    close: async () => {
      cannon.stop?.();
    },
    results: () => {
      return cannon;
    }
  };
}

export default async function runner (_opts = {}) {
  // Start up the server, then the client
  const opts = {
    ..._opts
  };

  const containerMeta = await buildContainer(opts);
  opts.node = containerMeta.node;
  opts.tag = containerMeta.tag;

  const server = await startServer(opts);
  const client = await startClient(opts, server); 

  // Wait for the client to finish, then the server
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
