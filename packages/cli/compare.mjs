import compare from 'autocannon-compare';
import autocannon from 'autocannon';
import { normalize, join, dirname } from 'node:path';
import { inspect } from 'node:util';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export function help () {
  return `$ expf compare [flags] <resultA> <resultB>

  Compare two test results

  Flags:

    --cwd`;
}

function header (strs, ...values) {
  const val = strs.reduce((v, s, i) => {
    return v + s + (values[i] ? values[i] : '');
  }, '');
  return val + '\n' + Array(val.length).fill('=').join('');
}

function keyResults (results) {
  const seen = new Map();
  // Accept a list of results, a single result object, or nothing at all
  return [].concat(results ?? []).map((result) => {
    const url = result.url ?? '';
    const n = seen.get(url) ?? 0;
    seen.set(url, n + 1);
    return { key: `${url}#${n}`, label: url || `request ${n + 1}`, result };
  });
}

// Match up the result for each request in sample A with the result for
// the same request in sample B. Results are matched by url, so the order
// of requests may differ between the two samples. When a url appears
// multiple times (ex. one result per load generator) the occurrences
// are matched in order.
export function pairResults (a, b) {
  const keyedA = keyResults(a);
  const unmatchedB = new Map(keyResults(b).map((r) => [r.key, r]));

  const pairs = [];
  for (const { key, label, result } of keyedA) {
    const match = unmatchedB.get(key);
    if (!match) {
      console.warn(`No result for ${label} in sample B, skipping`);
      continue;
    }
    unmatchedB.delete(key);
    pairs.push({ label, a: result, b: match.result });
  }

  for (const { label } of unmatchedB.values()) {
    console.warn(`No result for ${label} in sample A, skipping`);
  }

  return pairs;
}

export default function main (_opts = {}, resultA, resultB) {
  if (_opts.help) {
    console.log(help());
    return;
  }
  // eslint-disable-next-line no-async-promise-executor
  return new Promise(async (resolve, reject) => {
    const opts = {
      cwd: normalize(join(__dirname, '..', '..')),
      ..._opts
    };
    // TODO: these are considered syntax errors according to semistandard, despite clearly not being so
    // likely an old version of eslint parsing under the hood. Just leaving for now.
    const resultsA = (await import(join(opts.cwd, resultA), { with: { type: 'json' } })).default.clientResults;
    const resultsB = (await import(join(opts.cwd, resultB), { with: { type: 'json' } })).default.clientResults;

    const pairs = pairResults(resultsA, resultsB);
    if (pairs.length === 0) {
      return reject(new Error(`No matching requests found to compare between ${resultA} and ${resultB}`));
    }

    for (const { label, a, b } of pairs) {
      // Only label each section when there is more than one request to tell apart
      const suffix = pairs.length > 1 ? ` (${label})` : '';
      const comp = compare(a, b);

      console.log(header`A Results: ${resultA}${suffix}`);
      console.log(autocannon.printResult(a));

      console.log(header`B Results: ${resultB}${suffix}`);
      console.log(autocannon.printResult(b));

      console.log(header`Comparison: ${comp.equal ? 'equal' : (comp.aWins) ? 'A Wins' : 'B Wins'}${suffix}`);
      console.log(inspect({
        // ...comp,
        diff: {
          rps: comp.requests.difference,
          throughput: comp.throughput.difference,
          latency: comp.latency.difference
        },
        a: {
          // ...a,
          avgRPS: a.requests.average,
          avgThroughput: a.throughput.average,
          avgLatency: a.latency.average,
          status: a.statusCodeStats
        },
        b: {
          // ...b,
          avgRPS: b.requests.average,
          avgThroughput: b.throughput.average,
          avgLatency: b.latency.average,
          status: b.statusCodeStats
        }
      }, {
        depth: 4,
        colors: true
      }));
    }
    resolve();
  });
}
