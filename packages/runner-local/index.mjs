import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { setup, cleanup } from './setup.mjs';
import { startServer } from './server.mjs';
import { startClient } from './client.mjs';

export default async function runner (_opts = {}) {
  // Start up the server, then the client
  const opts = {
    ..._opts
  };

  const cwd = fileURLToPath(dirname(import.meta.resolve(opts.test)));
  await setup(cwd, opts);

  let server;
  let client;
  try {
    server = await startServer(cwd, opts);
    client = await startClient(opts, server);
    if (!client) return {};

    const clientResults = await client.results();
    const serverResults = await server.results();

    return {
      options: {
        runner: 'local',
        node: opts.node,
        overrides: opts.overrides,
        test: opts.test,
        flamegraph: !!opts.flamegraph
      },
      serverMetadata: server.metadata,
      clientMetadata: client.metadata,
      serverResults,
      clientResults
    };
  } finally {
    try {
      await client?.close();
    } finally {
      try {
        await server?.close();
      } finally {
        await cleanup(cwd);
      }
    }
  }
}
