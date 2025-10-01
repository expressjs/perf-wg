import { startLoad } from '@expressjs/perf-requests';

export async function startClient (opts = {}) {
  if (opts.signal.aborted) {
    return;
  }

  const load = startLoad(opts);

  return {
    metadata: {},
    close: async () => {
      // TODO: need to implement this
      // load.close();
    },
    results: () => {
      return load.results();
    }
  };
}
