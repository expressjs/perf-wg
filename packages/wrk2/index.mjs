import { spawnSync, spawn } from 'node:child_process';
import { availableParallelism } from 'node:os';

export class Wrk2Benchmarker {
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
