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

  const server = await startServer(cwd, opts);
  const client = await startClient(opts, server); 

  // Gracefully handle aborted runs
  if (!client) {
    if (server) {
      await server.close();
    }
    await cleanup(cwd);
    return {};
  }

  // Wait for the client to finish, then the server
  const clientResults = await client.results();
  const serverResults = await server.results();

  await client.close();
  await server.close();

  await cleanup(cwd);

  return {
    options: {
      runner: 'local',
      node: opts.node,
      overrides: opts.overrides,
      test: opts.test
    },
    serverMetadata: server.metadata,
    clientMetadata: client.metadata,
    serverResults,
    clientResults
  };
}
