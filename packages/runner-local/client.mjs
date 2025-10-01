import { styleText } from 'node:util';
import { AutocannonBenchmarker } from '@expressjs/perf-autocannon';
import { Wrk2Benchmarker } from '@expressjs/perf-wrk2';

function runBenchmarker(instance, options) {
  console.log(styleText(['blue'], `Running ${instance.name} load...`));
  return new Promise((resolve, reject) => {
    const proc = instance.create(options);
    proc.stderr.pipe(process.stderr);

    let stdout = '';
    proc.stdout.setEncoding('utf8');
    proc.stdout.on('data', (chunk) => stdout += chunk);

    proc.once('close', (code) => {
      if (code) {
        let error_message = `${instance.name} failed with ${code}.`;
        if (stdout !== '') {
          error_message += ` Output: ${stdout}`;
        }
        reject(new Error(error_message), code);
        return;
      }

      const result = instance.processResults(stdout);
      resolve(result);
    });
  })
}


export async function startClient (opts = {}) {
  if (opts.signal.aborted) {
    return;
  }

  const autocannon = new AutocannonBenchmarker();
  const wrk2 = new Wrk2Benchmarker();
  const waitFor = [];

  if (!wrk2.present) {
    console.log(styleText(['bold', 'yellow'], 'Wrk2 not found. Please install it'));
  } else {
    waitFor.push(
      runBenchmarker(wrk2, {
        duration: 30,
        connections: 100,
        rate: 2000,
        port: 3000,
        path: '/'
      })
    );
    console.log('Running Wrk2');
  }

  if (!autocannon.present) {
    console.log(styleText(['bold', 'yellow'], 'Autocannon not found. Please install it with `npm i -g autocannon`'));
  } else {
    waitFor.push(
      runBenchmarker(autocannon, {
        duration: 30,
        connections: 100,
        port: 3000,
        path: '/',
      })
    );
    console.log('Running Autocannon');
  }

  return {
    metadata: {},
    close: async () => {
      // TODO: need to get the client classes into order for this
    },
    results: () => {
      return Promise.allSettled(waitFor);
    }
  };
}
