import { createRunner } from '@expressjs/perf-runner-base';

export default createRunner({
  type: 'nsolid',
  runtime: 'N|Solid',
  apm: 'built-in',
  capabilities: ['profiling', 'flamegraphs', 'heap-snapshots', 'perf-data', 'nsolid-monitoring', 'cpu-profiling', 'heap-profiling'],
  nodeVersion: 'jod',
  os: 'latest',
  env: {
    RUNTIME_TYPE: 'nsolid',
    NSOLID_APPNAME: process.env.TEST ,
    NSOLID_TAGS: process.env.NSOLID_TAGS || 'benchmark,performance',
    NSOLID_SAAS: process.env.NSOLID_SAAS || '',
  }
});
