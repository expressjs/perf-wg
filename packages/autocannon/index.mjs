import { spawnSync, spawn } from 'node:child_process';
import autocannon from 'autocannon';

export function run (opts) {
  return new Promise((resolve, reject) => {
    autocannon(opts, (err, result) => {
      if (err) {
        return reject(err);
      }
      resolve(result);
    });
  });
}

export default async function main (_opts = {}) {
  const opts = {
    // TODO: maybe we don't want any defaults here?
    // we could move them all up into the cli to keep
    // them centralized in case we have multiple
    // client implementations or runners.
    url: 'http://localhost:3000',
    duration: 60,
    connections: 100,
    ..._opts
  };

  // Override requetst with built in suite of requets
  if (typeof opts.requests === 'string') {
    opts.requests = (await import(opts.requests)).default;
  }

  return run(opts);
}

export class AutocannonBenchmarker {
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
