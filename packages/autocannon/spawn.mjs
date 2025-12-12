import { availableParallelism } from 'node:os';
import { spawn } from 'node:child_process';
import { quote as shellQuote } from 'shell-quote';

export class AutocannonCLI {
  // NOTE: I don't use windows or have a windows machine to test on, so this
  // was just carried over from the previous implementation, someone
  // should go and test I didn't break this
  executable = process.platform === 'win32' ? 'autocannon.cmd' : 'autocannon';
  isPresent = null;
  status = null;
  procs = [];
  #results = [];

  duration = 60;
  connections = 100;
  method = 'GET';
  url = new URL('http://127.0.0.1:3000/');
  headers = {};
  body;

  constructor (opts = {}) {
    // autocannon options
    this.duration = opts.duration || this.duration;
    this.connections = opts.connections || this.connections;

    // request options
    this.method = opts.method || this.method;
    this.url = opts.url || this.url;
    this.headers = opts.headers || this.headers;
    this.body = opts.body || this.body;
  }

  async start (opts = {}) {
    // Check if present, but only once
    if (this.isPresent === null) {
      try {
        this.isPresent = this.spawn(['-h']);
        await this.isPresent;
        this.isPresent = true;
      } catch (e) {
        // Set the status to the error we got
        this.status = e;
        this.isPresent = false;
      }
    } if (typeof this.isPresent?.then === 'function') {
      try {
        await this.isPresent;
      } catch (e) {
        // ignore this one because it should have been caught already
        // in the start call that hit the first condition
      }
    }

    if (!this.isPresent) {
      this.status = this.status || 'not present';
      throw Object.assign(new Error('executable not present', {
        cause: this.status
      }), {
        code: 'EXECUTABLE_NOT_PRESENT',
      });
    }

    this.status = 'starting';

    const args = [
      // NOTE: use aggregating multiple results later
      // This doesnt work when workers is enabled, and
      // this is currently not working as expected at all.
      // AFAICT the requests and throughput histograms are not
      // correctly populated when passing this option. Even when
      // I copy what I see in autocannon to aggregate multiple
      //
      // '--skipAggregateResult',

      // -d/--duration SEC
      '-d', this.duration,

      // -c/--connections NUM
      '-c', this.connections,

      // -w/--workers NUM
      '-w', Math.min(this.connections, availableParallelism() || 8),

      // -j/--json
      '-j',

      // -n/--no-progress
      '-n',

      // -m/--method METHOD
      '-m', opts.method || this.method
    ];

    // -b/--body BODY
    const body = opts.body || this.body;
    if (body) {
      args.push('-b', typeof body === 'string' ? body : JSON.stringify(body));
    }

    // -H/--headers K=V
    for (const [header, value] of Object.entries({ ...this.headers, ...opts.headers })) {
      args.push('-H', `${header}=${value}`);
    }

    // url (positional)
    const url = opts.url ? new URL(opts.url, this.url) : this.url;

    // Run the process
    const stdout = await this.spawn(args, url);

    let result;
    try {
      result = JSON.parse(stdout);
    } catch (e) {
      throw Object.assign(e, {
        stdout
      })
    }

    this.#results.push(result);
    return result;
  }

  async spawn (args = [], url, opts = {}) {
    return new Promise((resolve, reject) => {
      if (this.status === 'aborted') {
        return reject(new Error('Aborted before start'));
      }
      let cmd;
      if (url) {
        cmd = `${this.executable} ${shellQuote(args)} ${url.toString()}`;
      } else {
        cmd = `${this.executable} ${shellQuote(args)}`;
      }

      const proc = spawn(cmd, {
        shell: true
      }, opts);

      this.procs.push(proc);

      let stderr = '';
      proc.stderr.setEncoding('utf8');
      proc.stderr.on('data', (chunk) => {
        stderr += chunk;
      });

      let stdout = '';
      proc.stdout.setEncoding('utf8');
      proc.stdout.on('data', (chunk) => {
        stdout += chunk;
      });

      const onError = (e, data) => {
        Object.assign(e, { stderr, stdout, ...data });
        this.status = e;
        reject(e);
      };

      proc.once('error', (e) => onError(e));

      proc.once('close', (code) => {
        if (code) {
          return onError(new Error(`${this.executable} failed with ${code}`, { code }));
        }
        resolve(stdout);
      });
    });
  }

  close () {
    this.procs.forEach((proc) => {
      proc.kill('SIGINT');
    });
    this.status = 'aborted';
  }
}
