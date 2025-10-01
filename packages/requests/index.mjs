import { AutocannonCLI } from '@expressjs/perf-autocannon';
import { Wrk2CLI } from '@expressjs/perf-wrk2';

export function startLoad (opts = {}) {
  const requests = opts.requests || [{
    method: 'GET',
    path: '/',
    headers: {},
    body: undefined
  }];
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

  const toAwait = requesters.flatMap((requester) => {
    return requests.map((request) => {
      return requester.start(request);
    });
  })

  return {
    close: async () => {
      // TODO: need to implement this in the cli wrappers
    },
    results: () => {
      return Promise.allSettled(toAwait);
    }
  };

}
