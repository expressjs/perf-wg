import { parseArgs } from 'node:util';
import { argv } from 'node:process';

const { values, positionals } = parseArgs({
  args: argv,
  allowPositionals: true,
  options: {
    help: {
      type: 'boolean'
    },
    cwd: {
      type: 'string'
    },

    repo: {
      type: 'string'
    },
    'repo-ref': {
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

    node: {
      type: 'string',
      short: 'n'
    },

    overrides: {
      type: 'string',
      short: 'o'
    }
  }
});

switch (positionals[2]) {
  case 'compare':
    try {
      await (await import('../compare.mjs')).default(values, ...positionals.slice(3));
    } catch (e) {
      console.error(e);
    }
    break;
  case 'load':
    try {
      await (await import('../load.mjs')).default(values);
    } catch (e) {
      console.error(e);
    }
    break;
  case 'bench':
    try {
      await (await import('../bench.mjs')).default(values);
    } catch (e) {
      console.error(e);
    }
    break;
  default:
    console.log(`
Express Performance Testing CLI
===============================

${(await import('../compare.mjs')).help(values)}

${(await import('../load.mjs')).help(values)}

${(await import('../bench.mjs')).help(values)}
`
    );
}
