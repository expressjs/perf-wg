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
        await this.spawn(['-h']);
        this.isPresent = true;
      } catch (e) {
        // Set the status to the error we got
        this.status = e;
        this.isPresent = false;
      }
    }

    if (!this.isPresent) {
      this.status = this.status || 'not present';
      throw new Error('executable not present', {
        cause: this.status
      });
    }

    this.status = 'starting';

    const args = [
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
    args.push(url.toString());

    // Run the process
    const stdout = await this.spawn(args);

    const result = JSON.parse(stdout);
    if (!result.requests.average) {
      throw new Error(`${this.executable} produced invalid JSON output`);
    }

    return result;
  }

  async spawn (args = [], opts = {}) {
    return new Promise((resolve, reject) => {
      if (this.status === 'aborted') {
        return reject(new Error('Aborted before start'));
      }
      const proc = spawn(`${this.executable} ${shellQuote(args)}`, {
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
