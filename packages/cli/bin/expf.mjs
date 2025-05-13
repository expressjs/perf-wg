import { parseArgs } from 'node:util';
import { argv } from 'node:process';

const { values, positionals } = parseArgs({
  args: argv,
  allowPositionals: true,
  options: {
    cwd: {
      type: 'string'
    },
    repo: {
      type: 'string'
    },

    runner: {
      type: 'string',
      short: 'u'
    },

    test: {
      type: 'string',
      short: 't'
    },

    // flamegraph: {
    //   type: 'boolean',
    //   short: 'f'
    // },
    // 'heap-profile': {
    //   type: 'boolean',
    //   short: 'p'
    // },
    // 'heap-snapshot': {
    //   type: 'boolean',
    //   short: 's'
    // },
    // 'cpu-profile': {
    //   type: 'boolean',
    //   short: 'c'
    // }
  }
});

switch (positionals[2]) {
  case 'load':
    try {
      (await import('../load.mjs')).default(values);
    } catch (e) {
      console.error(e);
    }
    break;
  case 'bench':
    try {
      (await import('../bench.mjs')).default(values);
    } catch (e) {
      console.error(e);
    }
    break;
  default:
    console.log('help output');
    console.log(positionals);
    console.log(values);
}
