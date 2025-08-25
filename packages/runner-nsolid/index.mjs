import { createRunner } from '@expressjs/perf-runner-shared';

export default createRunner({
  type: 'nsolid',
  runtime: 'N|Solid',
  apm: 'built-in',
  capabilities: ['profiling', 'flamegraphs', 'heap-snapshots', 'perf-data', 'nsolid-monitoring', 'cpu-profiling', 'heap-profiling'],
  nodeVersion: 'iron',
  nodeBase: 'latest',
  env: {
    RUNTIME_TYPE: 'nsolid',
    NSOLID_APPNAME: 'express-benchmark',
    NSOLID_TAGS: 'benchmark,performance',
    NSOLID_SAAS: ''
  }
});
