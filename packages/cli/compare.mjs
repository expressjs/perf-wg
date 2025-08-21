import compare from 'autocannon-compare';
import autocannon from 'autocannon';
import { normalize, join } from 'node:path';
import { inspect } from 'node:util';

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

export default function main (_opts = {}, resultA, resultB) {
  if (_opts.help) {
    console.log(help());
    return;
  }
  return new Promise(async (resolve, reject) => {
    const opts = {
      cwd: normalize(join(import.meta.dirname, '..', '..')),
      ..._opts
    };
    const a = (await import(join(opts.cwd, resultA), { with: { type: 'json' } })).default.clientResults;
    const b = (await import(join(opts.cwd, resultB), { with: { type: 'json' } })).default.clientResults;
    const comp = compare(a, b);

    console.log(header`A Results: ${resultA}`);
    console.log(autocannon.printResult(a));

    console.log(header`B Results: ${resultB}`);
    console.log(autocannon.printResult(b));

    console.log(header`Comparison: ${comp.equal ? 'equal' : (comp.aWins) ? 'A Wins' : 'B Wins' }`);
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
    resolve();
  });
}
