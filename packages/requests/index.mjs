import { AutocannonCLI } from '@expressjs/perf-autocannon';
import { Wrk2CLI } from '@expressjs/perf-wrk2';

export function startLoad (opts = {}) {
  const requests = opts.requests || [{
    method: 'GET',
    path: '/',
    headers: {},
    body: undefined
  }];

  if (!opts.parallel && requests.length > 1) {
    console.log('Running multiple request types in paralle may have unreliable results.');
    console.warn('To enable this pass --parallel. Using only the first request from the test set.');
    requests = [requests[0]];
  }

  const requesters = [];

  if (opts.useAutocannon !== false) {
    const ac = new AutocannonCLI({
      duration: opts.duration,
      connections: opts.connections,
      method: opts.method,
      url: opts.url,
      headers: opts.headers,
      body: opts.body
    });
    requesters.push(ac);
  }

  if (opts.useWrk2 !== false) {
    const wrk = new Wrk2CLI({
      duration: opts.duration,
      connections: opts.connections,
      rate: opts.rate,
      method: opts.method,
      url: opts.url,
      headers: opts.headers,
      body: opts.body
    });
    requesters.push(wrk);
  }

  // Start here, await in .results()
  const toAwait = requesters.flatMap((requester) => {
    return requests.map((request) => {
      return requester.start(request);
    });
  });

  return {
    close: async () => {
      return Promise.allSettled(requesters.map((req) => {
        return req.close();
      }));
    },
    results: () => {
      return Promise.allSettled(toAwait);
    }
  };
}
