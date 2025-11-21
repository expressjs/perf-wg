import { spawnSync, spawn } from 'node:child_process';
import { availableParallelism } from 'node:os';
import { styleText } from 'node:util';

// TODO: add options to load different servers
export function help () {
  return `$ expf local-bench

  Start Autocannon load to local HTTP server
`
}

class Wrk2Benchmarker {
  constructor() {
    this.name = 'wrk2';
    this.executable = 'wrk2';
    const result = spawnSync(this.executable, ['-h']);
    this.present = !(result.error && result.error.code === 'ENOENT');
  }

  create(options) {
    const duration = typeof options.duration === 'number' ?
      Math.max(options.duration, 1) :
      options.duration;
    const scheme = options.scheme || 'http';
    const args = [
      '-d', duration,
      '-c', options.connections,
      '-R', options.rate,
      '--latency',
      '-t', Math.min(options.connections, availableParallelism() || 8),
      `${scheme}://127.0.0.1:${options.port}${options.path}`,
    ];
    for (const field in options.headers) {
      args.push('-H', `${field}: ${options.headers[field]}`);
    }
    const child = spawn(this.executable, args);
    return child;
  }

  processResults(output) {
    // Capture only the Latency Distribution block (until a blank line or "Detailed Percentile spectrum:")
    const blockRe =
      /Latency Distribution \(HdrHistogram - Recorded Latency\)\s*\n([\s\S]*?)(?:\n\s*\n|^ {0,2}Detailed Percentile spectrum:|\Z)/m;

    const m = output.match(blockRe);
    if (!m) return undefined;

    const lines = m[1].trim().split('\n');

    // e.g.: " 50.000%  780.00us" or " 90.000%    1.23ms"
    const lineRe = /^\s*(\d{1,3}\.\d{3})%\s+([0-9.]+)\s*(ms|us)\s*$/;

    const points = [];
    for (const line of lines) {
      const lm = line.match(lineRe);
      if (!lm) continue;
      const pct = parseFloat(lm[1]);          // e.g. 99.900
      const val = parseFloat(lm[2]);          // numeric value
      const unit = lm[3];                     // "ms" | "us"
      const valueMs = unit === 'us' ? val / 1000 : val;
      if (Number.isFinite(pct) && Number.isFinite(valueMs)) {
        points.push({ percentile: pct, ms: valueMs });
      }
    }

    return points.length ? points : undefined;
  }
}

class AutocannonBenchmarker {
  constructor() {
    const shell = (process.platform === 'win32');
    this.name = 'autocannon';
    this.opts = { shell };
    this.executable = shell ? 'autocannon.cmd' : 'autocannon';
    const result = spawnSync(this.executable, ['-h'], this.opts);
    if (shell) {
      this.present = (result.status === 0);
    } else {
      this.present = !(result.error && result.error.code === 'ENOENT');
    }
  }

  create(options) {
    const args = [
      '-d', options.duration,
      '-c', options.connections,
      '-j',
      '-n',
    ];
    for (const field in options.headers) {
      if (this.opts.shell) {
        args.push('-H', `'${field}=${options.headers[field]}'`);
      } else {
        args.push('-H', `${field}=${options.headers[field]}`);
      }
    }
    const scheme = options.scheme || 'http';
    args.push(`${scheme}://127.0.0.1:${options.port}${options.path}`);
    const child = spawn(this.executable, args, this.opts);
    return child;
  }

  processResults(output) {
    let result;
    try {
      result = JSON.parse(output);
    } catch {
      return undefined;
    }
    if (!result || !result.requests || !result.requests.average) {
      return undefined;
    }
    return result.requests.average;
  }
}

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

// TODO: accept args to decide which load tool use
// For now, use both.
export async function startLoad () {
  const autocannon = new AutocannonBenchmarker();
  if (!autocannon.present) {
    console.log(styleText(['bold', 'yellow'], 'Autocannon not found. Please install it with `npm i -g autocannon`'));
  } else {
    const result = await runBenchmarker(autocannon, {
      duration: 30,
      connections: 100,
      port: 3000,
      path: '/',
    });
    console.log('Result Autocannon:', result)
  }

  const wrk2 = new Wrk2Benchmarker();
  if (!wrk2.present) {
    console.log(styleText(['bold', 'yellow'], 'Wrk2 not found. Please install it'));
  } else {
    const result = await runBenchmarker(wrk2, {
      duration: 30,
      connections: 100,
      rate: 2000,
      port: 3000,
      path: '/'
    });
    console.log('Result Wrk2:', result);
  }
}

export default async function main () {
  await startLoad();
}
