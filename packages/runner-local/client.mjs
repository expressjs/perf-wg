import { startLoad } from '@expressjs/perf-requests';
import { collectMetadata } from '@expressjs/perf-metadata';

export async function startClient (opts = {}) {
  if (opts.signal?.aborted) {
    return;
  }

  const test = await import(opts.test);
  const load = startLoad({
    ...opts,
    requests: await test.requests()
  });

  opts.signal?.addEventListener('abort', () => {
    load.close();
  });

  return {
    metadata: collectMetadata(),
    close: async () => {
      return load.close();
    },
    results: () => {
      return load.results();
    }
  };
}
