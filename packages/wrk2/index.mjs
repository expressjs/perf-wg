import { availableParallelism } from 'node:os';
import { spawn } from 'node:child_process';
import { quote as shellQuote } from 'shell-quote';

export class Wrk2CLI {
  executable = 'wrk2';

  // NOTE: keeping isPresent on the api because it seems useful
  // if it turns out not to be, we can remove the property and just
  // throw when not
  isPresent = null;
  #isPresentProc;

  status = null;
  procs = [];
  results = [];

  duration = 60;
  connections = 100;
  rate = 2000;
  method = 'GET';
  url = new URL('http://127.0.0.1:3000/');
  headers = {};
  body;

  constructor (opts = {}) {
    // autocannon options
    this.duration = opts.duration || this.duration;
    this.connections = opts.connections || this.connections;
    this.rate = opts.rate || this.rate;

    // request options
    this.method = opts.method || this.method;
    this.url = opts.url || this.url;
    this.headers = opts.headers || this.headers;
    this.body = opts.body || this.body;
  }

  async start (opts = {}) {
    // Check if the executable is present, throw if not
    await this.checkIsPresent();

    this.status = 'starting';

    const args = [
      '-d', this.duration,
      '-c', this.connections,
      '-R', this.rate,
      '-t', Math.min(this.connections, availableParallelism() || 4),
      '--latency'
    ];

    // TODO: I don't see docs on how to do this with wrk2
    if (opts.method || this.method) {
      throw new Error('method not yet supported');
    }

    // TODO: I don't see docs on how to do this with wrk2
    if (opts.body || this.body) {
      throw new Error('body not yet supported');
    }

    // -H/--headers K=V
    for (const [header, value] of Object.entries(opts.headers || this.headers)) {
      args.push('-H', `${header}: ${value}`);
    }

    // url (positional)
    const url = opts.url || opts.path ? new Url(opts.url || opts.path, this.url) : this.url;
    args.push(url.toString());

    // Run the process
    const stdout = await this.spawn(args);

    const result = this.processResults(stdout);
    if (!result.requests.average) {
      throw new Error(`${this.executable} produced invalid JSON output`);
    }

    this.results.push(result);
    return result;
  }

  async checkIsPresent () {
    if (!this.#isPresentProc) {
      try {
        this.#isPresentProc = this.spawn(['-h']);
        await this.#isPresentProc;
        this.isPresent = true;
      } catch (e) {
        this.isPresent = false;
        this.status = Object.assign(new Error('executable not present', {
          cause: e
        }), {
          code: 'EXECUTABLE_NOT_PRESENT',
        });
        throw this.status;
      }
    } else {
      try {
        await this.#isPresentProc;
      } catch (e) {
        // Ignored this error because it should
        // be handled by the first caller
        throw this.status;
      }

    }
  }

  async spawn (args = [], opts = {}) {
    return new Promise((resolve, reject) => {
      const proc = spawn(`${this.executable} ${shellQuote(args)}`, {
        shell: true
      }, opts);

      this.procs.push(proc);

      let stderr = '';
      proc.stderr.setEncoding('utf8');
      proc.stderr.on('data', (chunk) => {
        stderr += chunk
      });

      let stdout = '';
      proc.stdout.setEncoding('utf8');
      proc.stdout.on('data', (chunk) => {
        stdout += chunk
      });

      const onError = (e, data) => {
        Object.assign(e, { stderr, stdout, ...data });
        this.status = e;
        reject(e);
      }

      proc.once('error', (e) => onError(e));
      proc.once('close', (code) => {
        if (code) {
          return onError(new Error(`${this.executable} failed with ${code}`), { code });
        }

        resolve(stdout);
      });

    });
  }

  processResults (output) {
    // Capture only the Latency Distribution block (until a blank line or "Detailed Percentile spectrum:")
    const blockRe =
      /Latency Distribution \(HdrHistogram - Recorded Latency\)\s*\n([\s\S]*?)(?:\n\s*\n|^ {0,2}Detailed Percentile spectrum:|\Z)/m;

    const m = output.match(blockRe);
    if (!m) {
      return;
    }

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

  close () {
    this.procs.map((proc) => {
      proc.kill('SIGINT');
    });
    this.status = 'aborted';
  }
}
