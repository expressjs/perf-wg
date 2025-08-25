import { createRunner } from '@expressjs/perf-runner-shared';

export default createRunner({
  type: 'vanilla',
  runtime: 'node.js',
  apm: 'none',
  capabilities: ['profiling', 'flamegraphs', 'heap-snapshots', 'perf-data'],
  env: {
    RUNTIME_TYPE: 'vanilla'
  }
});
