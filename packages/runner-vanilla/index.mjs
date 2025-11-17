import { createRunner } from '@expressjs/perf-runner-local-docker';

export default createRunner({
  name: 'vanilla',
  runtime: 'node.js',
  apm: 'none',
  capabilities: ['profiling', 'flamegraphs', 'heap-snapshots', 'perf-data'],
  env: {
    RUNTIME_TYPE: 'vanilla'
  }
});
