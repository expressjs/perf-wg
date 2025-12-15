import { AutocannonCLI } from '@expressjs/perf-autocannon';
import { Wrk2CLI } from '@expressjs/perf-wrk2';

export function startLoad (opts = {}) {
  let requests = opts.requests || [{
    method: 'GET',
    path: '/',
    headers: {},
    body: undefined
  }];

  if (requests.length === 0) {
    throw new Error('no requests specified');
  }

  if (requests.length > 1) {
    console.log('Running multiple request types in parallel may have unreliable results.');
    if (!opts.parallel) {
      console.warn('To enable this pass --parallel. Using only the first request from the test set.');
      requests = [requests[0]];
    }
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

  if (requesters.length === 0) {
    throw new Error('no clis available');
  }

  // Start here, await in .results()
  const toAwait = requests.flatMap((request) => {
    return requesters.map((requester) => {
      return requester.start(request);
    });
  });

  return {
    close: async () => {
      return Promise.allSettled(requesters.map((req) => {
        return req.close();
      }));
    },
    results: async () => {
      const r = await Promise.allSettled(toAwait);
      return r.reduce((a, r) => {
        if (r.status === 'rejected') {
          if (r.reason.code !== 'EXECUTABLE_NOT_PRESENT') {
            throw r.reason;
          }
        }
        if (r.status === 'fulfilled') {
          a.push(r.value);
        }
        return a;
      }, []);
    }
  };
}
